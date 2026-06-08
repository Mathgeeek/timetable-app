import { TeacherUnit, Assignment, ElectiveGroup, SpecialRoom, BlockedSlot, PeriodConfig, DEFAULT_PERIOD_CONFIG } from '@/app/types';

export interface SchedulingInput {
  units: TeacherUnit[];
  assignments: Assignment[];
  electiveGroups: ElectiveGroup[];
  specialRooms: SpecialRoom[];
  blockedSlots: BlockedSlot[];
  periodConfig?: PeriodConfig;
}

export interface SchedulingResult {
  /** 신규로 추가 배정된 수업 (기존 유지 + 신규) — 통계용 */
  newAssignments: Assignment[];
  /** ★ 배정 후 전체 시간표 (기존 + 신규 + 재배치 반영). DashboardPage는 이걸로 통째 교체해야 함 */
  allAssignments: Assignment[];
  failedUnits: { unit: TeacherUnit; reason: string }[];
  /** ★ 어쩔 수 없이 3연강이 발생한 교사 목록 (요일·교시 포함) */
  threeConsecutive: { name: string; day: string; periods: number[] }[];
  stats: { placed: number; failed: number; electiveGroupsPlaced: number; repaired: number };
}

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

/** 충돌 검사·점수 계산에 쓰는 최소 식별자 (TeacherUnit / Assignment 공통) */
interface Desc {
  name: string;
  grade: number;
  classNum: number;
  subject: string;
  unitId: string;
}
const unitDesc = (u: TeacherUnit): Desc => ({ name: u.name, grade: u.grade, classNum: u.classNum, subject: u.subject, unitId: u.id });
const asgDesc = (a: Assignment): Desc => ({ name: a.name, grade: a.grade, classNum: a.classNum, subject: a.subject, unitId: a.unitId });

/** 교시 목록에서 가장 긴 연속 강의 길이 */
function maxConsecutiveRun(periods: number[]): number {
  const s = [...new Set(periods)].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1] + 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

function makeAssignment(unit: TeacherUnit, day: string, period: number): Assignment {
  return {
    id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    unitId: unit.id,
    name: unit.name,
    subject: unit.subject,
    grade: unit.grade,
    classNum: unit.classNum,
    day,
    period,
    color: unit.color,
    isFixed: false,
  };
}

export function runScheduler(input: SchedulingInput): SchedulingResult {
  const periodConfig = input.periodConfig ?? DEFAULT_PERIOD_CONFIG;

  // ── 빠른 충돌 조회용 인덱스 ────────────────────────────────────────────────
  const teacherSlotSet = new Set<string>(); // `${day}-${period}-${name}`
  const classSlotSet = new Set<string>();   // `${day}-${period}-${grade}-${classNum}`
  const roomSlotCount = new Map<string, number>(); // `${roomId}-${day}-${period}` → count

  // 기존 배정은 깊은 복사 (React state 객체 직접 변형 방지)
  const working: Assignment[] = input.assignments.map(a => ({ ...a }));
  const newAssignments: Assignment[] = [];
  const placedCount = new Map<string, number>();
  let repaired = 0;

  const roomOf = (unitId: string): SpecialRoom | undefined =>
    input.specialRooms.find(r => r.unitIds.includes(unitId));

  function addToIndex(a: Assignment) {
    teacherSlotSet.add(`${a.day}-${a.period}-${a.name}`);
    classSlotSet.add(`${a.day}-${a.period}-${a.grade}-${a.classNum}`);
    const room = roomOf(a.unitId);
    if (room) {
      const k = `${room.id}-${a.day}-${a.period}`;
      roomSlotCount.set(k, (roomSlotCount.get(k) ?? 0) + 1);
    }
  }
  function removeFromIndex(a: Assignment) {
    teacherSlotSet.delete(`${a.day}-${a.period}-${a.name}`);
    classSlotSet.delete(`${a.day}-${a.period}-${a.grade}-${a.classNum}`);
    const room = roomOf(a.unitId);
    if (room) {
      const k = `${room.id}-${a.day}-${a.period}`;
      roomSlotCount.set(k, Math.max(0, (roomSlotCount.get(k) ?? 0) - 1));
    }
  }

  for (const a of working) {
    addToIndex(a);
    placedCount.set(a.unitId, (placedCount.get(a.unitId) ?? 0) + 1);
  }

  const remaining = (unit: TeacherUnit): number =>
    unit.totalHours - (placedCount.get(unit.id) ?? 0);

  function recordPlacement(a: Assignment) {
    working.push(a);
    addToIndex(a);
    newAssignments.push(a);
    placedCount.set(a.unitId, (placedCount.get(a.unitId) ?? 0) + 1);
  }

  /** 배치된 수업을 다른 칸으로 이동 (인덱스 동기화) */
  function moveAssignment(a: Assignment, day: string, period: number) {
    removeFromIndex(a);
    a.day = day;
    a.period = period;
    addToIndex(a);
  }

  const inRange = (grade: number, day: string, period: number): boolean =>
    period <= (periodConfig[grade]?.[day] ?? 7);

  const isBlocked = (name: string, day: string, period: number): boolean =>
    input.blockedSlots.some(b => b.teacherName === name && b.day === day && b.period === period);

  /** 교사가 해당 요일에 갖는 교시 목록 (특정 배정 제외 가능) */
  function teacherPeriodsOn(name: string, day: string, excludeId?: string): number[] {
    return working
      .filter(a => a.name === name && a.day === day && a.id !== excludeId)
      .map(a => a.period);
  }

  // ── 절대 하드 제약 (빠른 인덱스 기반, 신규 배치용) ────────────────────────
  // ★ 4연강은 절대 금지 (교사). 학급 연속 교시는 정상이므로 제약하지 않음.
  function canPlaceHard(d: Desc, day: string, period: number): boolean {
    if (!inRange(d.grade, day, period)) return false;
    if (isBlocked(d.name, day, period)) return false;
    if (teacherSlotSet.has(`${day}-${period}-${d.name}`)) return false;
    if (classSlotSet.has(`${day}-${period}-${d.grade}-${d.classNum}`)) return false;
    const room = roomOf(d.unitId);
    if (room && (roomSlotCount.get(`${room.id}-${day}-${period}`) ?? 0) >= room.capacity) return false;
    if (maxConsecutiveRun([...teacherPeriodsOn(d.name, day), period]) >= 4) return false; // 4연강 금지
    return true;
  }

  /** 하드 제약 (특정 배정 1건을 무시하고 검사 — 재배치용, 배열 스캔) */
  function canPlaceHardExcluding(d: Desc, day: string, period: number, excludeId: string): boolean {
    if (!inRange(d.grade, day, period)) return false;
    if (isBlocked(d.name, day, period)) return false;
    if (working.some(a => a.id !== excludeId && a.day === day && a.period === period && a.name === d.name)) return false;
    if (working.some(a => a.id !== excludeId && a.day === day && a.period === period && a.grade === d.grade && a.classNum === d.classNum)) return false;
    const room = roomOf(d.unitId);
    if (room) {
      const cnt = working.filter(a => a.id !== excludeId && a.day === day && a.period === period && room.unitIds.includes(a.unitId)).length;
      if (cnt >= room.capacity) return false;
    }
    if (maxConsecutiveRun([...teacherPeriodsOn(d.name, day, excludeId), period]) >= 4) return false; // 4연강 금지
    return true;
  }

  // ── 엄격 제약 (교사 3연강 금지) ────────────────────────────────────────────
  function canPlaceStrict(d: Desc, day: string, period: number): boolean {
    if (!canPlaceHard(d, day, period)) return false;
    if (maxConsecutiveRun([...teacherPeriodsOn(d.name, day), period]) >= 3) return false; // 3연강 금지
    return true;
  }

  // ── 슬롯 선호도 점수 ──────────────────────────────────────────────────────
  function scoreSlot(d: Desc, day: string, period: number): number {
    let score = 100;
    const total14 = working.filter(a => a.period === 1 || a.period === 4).length;
    const totalOther = working.filter(a => a.period !== 1 && a.period !== 4).length;
    if ((period === 1 || period === 4) && total14 > totalOther * 0.4) score -= 25;
    if (working.some(a => a.grade === d.grade && a.classNum === d.classNum && a.day === day && a.subject === d.subject)) score -= 40;
    const teacherDayLoad = working.filter(a => a.name === d.name && a.day === day).length;
    const classDayLoad = working.filter(a => a.grade === d.grade && a.classNum === d.classNum && a.day === day).length;
    score -= teacherDayLoad * 8;
    score -= classDayLoad * 5;
    if ([2, 3, 5, 6].includes(period)) score += 12;
    if (period === 7) score -= 10;
    score += Math.random() * 2;
    return score;
  }

  function findBestSlot(d: Desc, strict: boolean): { day: string; period: number } | null {
    const canFn = strict ? canPlaceStrict : canPlaceHard;
    let best: { day: string; period: number; score: number } | null = null;
    for (const day of DAYS) for (const period of PERIODS) {
      if (!canFn(d, day, period)) continue;
      const s = scoreSlot(d, day, period);
      if (!best || s > best.score) best = { day, period, score: s };
    }
    return best;
  }

  /** 임의 배정(이동 대상)을 위한 '완전히 빈' 슬롯 찾기 (자기 자신 제외) */
  function findEmptySlotExcluding(d: Desc, excludeId: string, forbid?: { day: string; period: number }): { day: string; period: number } | null {
    let best: { day: string; period: number; score: number } | null = null;
    for (const day of DAYS) for (const period of PERIODS) {
      if (forbid && forbid.day === day && forbid.period === period) continue;
      if (!canPlaceHardExcluding(d, day, period, excludeId)) continue;
      const s = scoreSlot(d, day, period);
      if (!best || s > best.score) best = { day, period, score: s };
    }
    return best;
  }

  function countValidSlots(d: Desc, strict: boolean): number {
    const canFn = strict ? canPlaceStrict : canPlaceHard;
    let n = 0;
    for (const day of DAYS) for (const period of PERIODS) if (canFn(d, day, period)) n++;
    return n;
  }

  // 선택과목(동시배정) 멤버 집합 — 재배치로 옮기면 "같은 시간" 묶음이 깨지므로 이동 금지
  const electiveUnitIds = new Set(input.electiveGroups.flatMap(g => g.unitIds));
  const isElectiveAssignment = (a: Assignment): boolean => electiveUnitIds.has(a.unitId);

  // ── 재배치(Repair): 막힌 수업을 위해 기존 비고정 수업을 옆 칸으로 밀어내기 ──
  // U를 놓을 칸을 찾되, 그 칸을 막고 있는 비고정 수업을 빈 칸으로 이동시켜 자리를 만든다 (깊이 1).
  function tryRepairPlace(unit: TeacherUnit): boolean {
    const d = unitDesc(unit);
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (!inRange(d.grade, day, period)) continue;
        if (isBlocked(d.name, day, period)) continue;

        // 이 칸을 막는 충돌 수업들 (교사 충돌 / 학급 충돌)
        const blockers: Assignment[] = [];
        const pushBlocker = (a: Assignment) => { if (!blockers.some(b => b.id === a.id)) blockers.push(a); };
        for (const a of working) {
          if (a.day !== day || a.period !== period) continue;
          if (a.name === d.name) pushBlocker(a);                                  // 교사 충돌
          if (a.grade === d.grade && a.classNum === d.classNum) pushBlocker(a);   // 학급 충돌
        }

        // ★ 특별실 꽉 참 충돌: 같은 특별실을 쓰는 수업을 옮겨 자리 확보
        const room = roomOf(d.unitId);
        if (room) {
          const occupants = working.filter(a => a.day === day && a.period === period && room.unitIds.includes(a.unitId));
          const need = occupants.length - room.capacity + 1; // 비워야 하는 칸 수
          if (need > 0) {
            // 이미 blocker로 잡힌 것 제외하고, 옮길 점유 수업 추가
            const movable = occupants.filter(o => !blockers.some(b => b.id === o.id));
            for (let k = 0; k < need && k < movable.length; k++) pushBlocker(movable[k]);
          }
        }

        // 고정 수업 또는 선택과목(동시배정) 수업이 막고 있으면 이 칸은 포기 (이동 불가)
        if (blockers.some(b => b.isFixed || isElectiveAssignment(b))) continue;
        // 충돌이 너무 많으면(3건 초과) 깊이1 재배치로는 무리 → 다음 칸
        if (blockers.length > 3) continue;

        // 충돌 수업들을 각각 빈 칸으로 이동 시도
        const moves: { a: Assignment; oldDay: string; oldPeriod: number }[] = [];
        let ok = true;
        for (const b of blockers) {
          const dest = findEmptySlotExcluding(asgDesc(b), b.id, { day, period });
          if (!dest) { ok = false; break; }
          moves.push({ a: b, oldDay: b.day, oldPeriod: b.period });
          moveAssignment(b, dest.day, dest.period);
        }

        // 이동 후 U를 놓을 수 있는지 최종 확인 (특별실 수용량 등 포함)
        if (ok && canPlaceHard(d, day, period)) {
          recordPlacement(makeAssignment(unit, day, period));
          repaired++;
          return true;
        }

        // 실패 → 이동 롤백
        for (let i = moves.length - 1; i >= 0; i--) {
          moveAssignment(moves[i].a, moves[i].oldDay, moves[i].oldPeriod);
        }
      }
    }
    return false;
  }

  // ── 선택과목 그룹 ─────────────────────────────────────────────────────────
  let electiveGroupsPlaced = 0;
  const failedUnits: { unit: TeacherUnit; reason: string }[] = [];

  // ── Phase 1: 선택과목 그룹 동시 배정 ────────────────────────────────────
  for (const group of input.electiveGroups) {
    const groupUnits = input.units.filter(u => group.unitIds.includes(u.id));
    if (groupUnits.length === 0) continue;

    const maxRem = Math.max(...groupUnits.map(u => remaining(u)));
    for (let iter = 0; iter < maxRem; iter++) {
      const toPlace = groupUnits.filter(u => remaining(u) > 0);
      if (toPlace.length === 0) break;

      for (const useStrict of [true, false]) {
        const canFn = useStrict ? canPlaceStrict : canPlaceHard;
        let best: { day: string; period: number; score: number } | null = null;
        for (const day of DAYS) for (const period of PERIODS) {
          if (!toPlace.every(u => canFn(unitDesc(u), day, period))) continue;
          const s = scoreSlot(unitDesc(toPlace[0]), day, period);
          if (!best || s > best.score) best = { day, period, score: s };
        }
        if (best) {
          for (const u of toPlace) recordPlacement(makeAssignment(u, best.day, best.period));
          electiveGroupsPlaced++;
          break;
        }
      }
    }
  }

  // ── Phase 2: 일반 유닛 배정 (라운드로빈 + MCF + 2패스) ─────────────────
  const regularUnits = input.units.filter(u => !electiveUnitIds.has(u.id));
  const maxRounds = regularUnits.reduce((max, u) => Math.max(max, remaining(u)), 0);

  for (let round = 0; round < maxRounds; round++) {
    const candidates = regularUnits.filter(u => remaining(u) > 0);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => countValidSlots(unitDesc(a), true) - countValidSlots(unitDesc(b), true));

    for (const unit of candidates) {
      if (remaining(unit) <= 0) continue;
      let slot = findBestSlot(unitDesc(unit), true);  // 1차: 3연강 포함 엄격
      if (!slot) slot = findBestSlot(unitDesc(unit), false); // 2차: 3연강 완화
      if (slot) recordPlacement(makeAssignment(unit, slot.day, slot.period));
    }
  }

  // ── Phase 3: 재배치 패스 — 남은 '일반' 수업을 기존 비고정 수업 밀어내며 채우기 ──
  // (선택과목은 동시배정 묶음이 깨질 수 있어 재배치 대상에서 제외)
  for (const unit of regularUnits) {
    let guard = 0;
    while (remaining(unit) > 0 && guard < 50) {
      guard++;
      if (!tryRepairPlace(unit)) break;
    }
  }

  // ── 최종 잔여 진단 ────────────────────────────────────────────────────────
  // 학급별/교사별 수용량 사전 계산 (불가능 사유 판별용)
  const classCapacity = (grade: number): number =>
    DAYS.reduce((sum, day) => sum + (periodConfig[grade]?.[day] ?? 7), 0);

  const classDemand = new Map<string, number>(); // `${grade}-${classNum}` → 시수합
  const teacherDemand = new Map<string, number>();
  for (const u of input.units) {
    classDemand.set(`${u.grade}-${u.classNum}`, (classDemand.get(`${u.grade}-${u.classNum}`) ?? 0) + u.totalHours);
    teacherDemand.set(u.name, (teacherDemand.get(u.name) ?? 0) + u.totalHours);
  }
  const teacherCapacity = (name: string): number => {
    const blocked = input.blockedSlots.filter(b => b.teacherName === name).length;
    return DAYS.length * PERIODS.length - blocked; // 35 - 배정금지
  };

  for (const unit of input.units) {
    const rem = remaining(unit);
    if (rem <= 0) continue;

    const cKey = `${unit.grade}-${unit.classNum}`;
    const cDemand = classDemand.get(cKey) ?? 0;
    const cCap = classCapacity(unit.grade);
    const tDemand = teacherDemand.get(unit.name) ?? 0;
    const tCap = teacherCapacity(unit.name);

    let reason: string;
    if (cDemand > cCap) {
      reason = `⛔ ${unit.grade}학년 ${unit.classNum}반 시수 초과: 주당 배정 ${cDemand}시간 > 운영 ${cCap}교시 (시수표 또는 교시설정 조정 필요)`;
    } else if (tDemand > tCap) {
      reason = `⛔ ${unit.name} 교사 시수 초과: 주당 ${tDemand}시간 > 가용 ${tCap}칸 (배정금지 ${input.blockedSlots.filter(b => b.teacherName === unit.name).length}칸)`;
    } else if (electiveUnitIds.has(unit.id)) {
      reason = `선택과목 동시배정 공통 슬롯 부족 — 그룹 구성 또는 교시설정 확인 필요`;
    } else {
      reason = `다른 수업과의 충돌로 자동배정 실패 — 고정 수업 위치 조정 후 재시도 권장`;
    }
    for (let i = 0; i < rem; i++) failedUnits.push({ unit, reason });
  }

  // ── 3연강 발생 교사 탐지 (4연강은 하드 금지라 발생 불가, 3연강만 집계) ──────
  const threeConsecutive: { name: string; day: string; periods: number[] }[] = [];
  const teacherNames = [...new Set(working.map(a => a.name))];
  for (const name of teacherNames) {
    for (const day of DAYS) {
      const periods = working.filter(a => a.name === name && a.day === day).map(a => a.period);
      const sorted = [...new Set(periods)].sort((a, b) => a - b);
      // 길이 3 이상의 연속 구간 추출
      let run: number[] = [];
      const flush = () => {
        if (run.length >= 3) threeConsecutive.push({ name, day, periods: [...run] });
        run = [];
      };
      for (let i = 0; i < sorted.length; i++) {
        if (i === 0 || sorted[i] === sorted[i - 1] + 1) run.push(sorted[i]);
        else { flush(); run = [sorted[i]]; }
      }
      flush();
    }
  }

  return {
    newAssignments,
    allAssignments: working,
    failedUnits,
    threeConsecutive,
    stats: { placed: newAssignments.length, failed: failedUnits.length, electiveGroupsPlaced, repaired },
  };
}
