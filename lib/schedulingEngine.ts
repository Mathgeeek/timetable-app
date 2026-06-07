import { TeacherUnit, Assignment, ElectiveGroup, SpecialRoom, BlockedSlot } from '@/app/types';

export interface SchedulingInput {
  units: TeacherUnit[];
  assignments: Assignment[];
  electiveGroups: ElectiveGroup[];
  specialRooms: SpecialRoom[];
  blockedSlots: BlockedSlot[];
}

export interface SchedulingResult {
  newAssignments: Assignment[];
  failedUnits: { unit: TeacherUnit; reason: string }[];
  stats: { placed: number; failed: number; electiveGroupsPlaced: number };
}

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function hasThreeConsecutive(periods: number[]): boolean {
  const s = [...periods].sort((a, b) => a - b);
  for (let i = 0; i + 2 < s.length; i++) {
    if (s[i + 1] === s[i] + 1 && s[i + 2] === s[i] + 2) return true;
  }
  return false;
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
  // ── 빠른 충돌 조회용 인덱스 ────────────────────────────────────────────────
  // key: `${day}-${period}-${name}` or `${day}-${period}-${grade}-${classNum}`
  const teacherSlotSet = new Set<string>();
  const classSlotSet = new Set<string>();
  const roomSlotCount = new Map<string, number>(); // `${roomId}-${day}-${period}` → count

  const working: Assignment[] = [];
  const newAssignments: Assignment[] = [];
  const failedUnits: { unit: TeacherUnit; reason: string }[] = [];
  const placedCount = new Map<string, number>();

  function addToIndex(a: Assignment) {
    teacherSlotSet.add(`${a.day}-${a.period}-${a.name}`);
    classSlotSet.add(`${a.day}-${a.period}-${a.grade}-${a.classNum}`);
    const room = input.specialRooms.find(r => r.unitIds.includes(a.unitId));
    if (room) {
      const k = `${room.id}-${a.day}-${a.period}`;
      roomSlotCount.set(k, (roomSlotCount.get(k) ?? 0) + 1);
    }
  }

  // 기존 배정 인덱싱
  for (const a of input.assignments) {
    working.push(a);
    addToIndex(a);
    placedCount.set(a.unitId, (placedCount.get(a.unitId) ?? 0) + 1);
  }

  function remaining(unit: TeacherUnit): number {
    return unit.totalHours - (placedCount.get(unit.id) ?? 0);
  }

  function recordPlacement(a: Assignment) {
    working.push(a);
    addToIndex(a);
    newAssignments.push(a);
    placedCount.set(a.unitId, (placedCount.get(a.unitId) ?? 0) + 1);
  }

  // ── 절대 하드 제약 (충돌, 특별실, 배정금지) ──────────────────────────────
  function canPlaceHard(unit: TeacherUnit, day: string, period: number): boolean {
    if (input.blockedSlots.some(b => b.teacherName === unit.name && b.day === day && b.period === period)) return false;
    if (teacherSlotSet.has(`${day}-${period}-${unit.name}`)) return false;
    if (classSlotSet.has(`${day}-${period}-${unit.grade}-${unit.classNum}`)) return false;
    const room = input.specialRooms.find(r => r.unitIds.includes(unit.id));
    if (room) {
      const usage = roomSlotCount.get(`${room.id}-${day}-${period}`) ?? 0;
      if (usage >= room.capacity) return false;
    }
    return true;
  }

  // ── 엄격 제약 (3연강 추가) ────────────────────────────────────────────────
  function canPlaceStrict(unit: TeacherUnit, day: string, period: number): boolean {
    if (!canPlaceHard(unit, day, period)) return false;

    // 교사 3연강 금지
    const teacherPeriods = working.filter(a => a.name === unit.name && a.day === day).map(a => a.period);
    if (hasThreeConsecutive([...teacherPeriods, period])) return false;

    // 학급 3연강 금지
    const classPeriods = working.filter(a => a.grade === unit.grade && a.classNum === unit.classNum && a.day === day).map(a => a.period);
    if (hasThreeConsecutive([...classPeriods, period])) return false;

    return true;
  }

  // ── 슬롯 선호도 점수 ──────────────────────────────────────────────────────
  function scoreSlot(unit: TeacherUnit, day: string, period: number): number {
    let score = 100;

    // 1/4교시 쏠림 방지
    const total14 = working.filter(a => a.period === 1 || a.period === 4).length;
    const totalOther = working.filter(a => a.period !== 1 && a.period !== 4).length;
    if ((period === 1 || period === 4) && total14 > totalOther * 0.4) score -= 25;

    // 같은 과목 같은 날 회피
    if (working.some(a => a.grade === unit.grade && a.classNum === unit.classNum && a.day === day && a.subject === unit.subject)) {
      score -= 40;
    }

    // 교사/학급 요일 부하 분산
    const teacherDayLoad = working.filter(a => a.name === unit.name && a.day === day).length;
    const classDayLoad = working.filter(a => a.grade === unit.grade && a.classNum === unit.classNum && a.day === day).length;
    score -= teacherDayLoad * 8;
    score -= classDayLoad * 5;

    // 중간 교시 선호, 7교시 회피
    if ([2, 3, 5, 6].includes(period)) score += 12;
    if (period === 7) score -= 10;

    score += Math.random() * 2;
    return score;
  }

  // ── 슬롯 탐색 (strict / hard 선택) ─────────────────────────────────────
  function findBestSlot(unit: TeacherUnit, strict: boolean): { day: string; period: number } | null {
    const canFn = strict ? canPlaceStrict : canPlaceHard;
    let best: { day: string; period: number; score: number } | null = null;
    for (const day of DAYS) {
      for (const period of PERIODS) {
        if (!canFn(unit, day, period)) continue;
        const s = scoreSlot(unit, day, period);
        if (!best || s > best.score) best = { day, period, score: s };
      }
    }
    return best;
  }

  function countValidSlots(unit: TeacherUnit, strict: boolean): number {
    const canFn = strict ? canPlaceStrict : canPlaceHard;
    let n = 0;
    for (const day of DAYS) for (const period of PERIODS) if (canFn(unit, day, period)) n++;
    return n;
  }

  // ── 선택과목 그룹에 속하는 unitId 집합 ──────────────────────────────────
  const electiveUnitIds = new Set(input.electiveGroups.flatMap(g => g.unitIds));
  let electiveGroupsPlaced = 0;

  // ── Phase 1: 선택과목 그룹 배정 ─────────────────────────────────────────
  for (const group of input.electiveGroups) {
    const groupUnits = input.units.filter(u => group.unitIds.includes(u.id));
    if (groupUnits.length === 0) continue;

    const maxRem = Math.max(...groupUnits.map(u => remaining(u)));
    for (let iter = 0; iter < maxRem; iter++) {
      const toPlace = groupUnits.filter(u => remaining(u) > 0);
      if (toPlace.length === 0) break;

      // strict → hard fallback
      for (const useStrict of [true, false]) {
        const canFn = useStrict ? canPlaceStrict : canPlaceHard;
        let best: { day: string; period: number; score: number } | null = null;
        for (const day of DAYS) {
          for (const period of PERIODS) {
            if (!toPlace.every(u => canFn(u, day, period))) continue;
            const s = scoreSlot(toPlace[0], day, period);
            if (!best || s > best.score) best = { day, period, score: s };
          }
        }
        if (best) {
          for (const u of toPlace) recordPlacement(makeAssignment(u, best.day, best.period));
          electiveGroupsPlaced++;
          break;
        }
        if (!useStrict) {
          toPlace.forEach(u => failedUnits.push({ unit: u, reason: `선택과목 그룹 "${group.groupName}" 공통 슬롯 없음` }));
        }
      }
    }
  }

  // ── Phase 2: 일반 유닛 배정 (라운드로빈 + MCF + 2패스) ─────────────────
  const regularUnits = input.units.filter(u => !electiveUnitIds.has(u.id) && remaining(u) > 0);
  if (regularUnits.length === 0) {
    return { newAssignments, failedUnits, stats: { placed: newAssignments.length, failed: failedUnits.length, electiveGroupsPlaced } };
  }

  const maxRounds = Math.max(...regularUnits.map(u => u.totalHours));

  for (let round = 0; round < maxRounds; round++) {
    // 이번 라운드에서 배치가 필요한 유닛들
    const candidates = regularUnits.filter(u => remaining(u) > 0);
    if (candidates.length === 0) break;

    // MCF: 유효 슬롯 수 오름차순 (가장 꽉 막힌 유닛 먼저)
    candidates.sort((a, b) => countValidSlots(a, true) - countValidSlots(b, true));

    for (const unit of candidates) {
      if (remaining(unit) <= 0) continue;

      // 1차 시도: 3연강 포함 엄격 제약
      let slot = findBestSlot(unit, true);

      // 2차 시도: 3연강 제약 제거 (불가피한 경우 허용)
      if (!slot) slot = findBestSlot(unit, false);

      if (slot) {
        recordPlacement(makeAssignment(unit, slot.day, slot.period));
      } else {
        failedUnits.push({ unit, reason: '유효 슬롯 없음 — 시간표 공간 부족 (교사/학급 충돌 해소 불가)' });
      }
    }
  }

  // 최종 잔여 확인
  for (const unit of regularUnits) {
    const rem = remaining(unit);
    if (rem > 0) {
      for (let i = 0; i < rem; i++) {
        failedUnits.push({ unit, reason: '배정 슬롯 부족 (전체 시간표 공간 초과)' });
      }
    }
  }

  return {
    newAssignments,
    failedUnits,
    stats: { placed: newAssignments.length, failed: failedUnits.length, electiveGroupsPlaced },
  };
}
