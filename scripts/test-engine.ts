// 엔진 검증용 임시 테스트 (npx tsx scripts/test-engine.ts)
import { runScheduler } from '../lib/schedulingEngine';
import { TeacherUnit, PeriodConfig } from '../app/types';

const PC: PeriodConfig = {
  1: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
  2: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
  3: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
};

function mk(id: string, name: string, subject: string, grade: number, classNum: number, hours: number): TeacherUnit {
  return { id, name, subject, grade, classNum, totalHours: hours, color: 'bg-blue-500' };
}

// ── 시나리오 1: 정상 케이스 (전 학급·교사 시수가 운영교시 이내) ──────────
// 1학년 1~3반, 교사 3명, 각 교사가 각 반에 5시간씩 → 반당 15시간 (35 이내), 교사당 15시간
function scenario1() {
  const units: TeacherUnit[] = [];
  const teachers = ['김국어', '이수학', '박영어'];
  for (let t = 0; t < 3; t++) {
    for (let c = 1; c <= 3; c++) {
      units.push(mk(`s1-${t}-${c}`, teachers[t], teachers[t].slice(1), 1, c, 5));
    }
  }
  const r = runScheduler({ units, assignments: [], electiveGroups: [], specialRooms: [], blockedSlots: [], periodConfig: PC });
  const totalHours = units.reduce((s, u) => s + u.totalHours, 0);
  console.log(`[시나리오1 정상] 총시수 ${totalHours} / 배정 ${r.stats.placed} / 재배치 ${r.stats.repaired} / 실패 ${r.stats.failed}`);
  console.log(`  → ${r.stats.failed === 0 ? '✅ 미배정 0건 (성공)' : '❌ 미배정 발생'}`);
}

// ── 시나리오 2: 그리디가 막히기 쉬운 빡빡한 케이스 ──────────────────────
// 1학년 1반에 교사 7명이 각각 5시간 → 반 35시간 = 운영 35교시 (정확히 꽉 참, 가능)
// 동시에 각 교사는 다른 반에도 수업 → 충돌 유발, 재배치 필요
function scenario2() {
  const units: TeacherUnit[] = [];
  const teachers = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  // 1반: 7명 × 5시간 = 35
  for (let t = 0; t < 7; t++) units.push(mk(`s2-a-${t}`, teachers[t], `과목${t}`, 1, 1, 5));
  // 2반: 같은 교사 7명 × 5시간 = 35 (교사들이 두 반 모두 가르침 → 충돌 다발)
  for (let t = 0; t < 7; t++) units.push(mk(`s2-b-${t}`, teachers[t], `과목${t}`, 1, 2, 5));
  const r = runScheduler({ units, assignments: [], electiveGroups: [], specialRooms: [], blockedSlots: [], periodConfig: PC });
  const totalHours = units.reduce((s, u) => s + u.totalHours, 0);
  console.log(`[시나리오2 빡빡] 총시수 ${totalHours} / 배정 ${r.stats.placed} / 재배치 ${r.stats.repaired} / 실패 ${r.stats.failed}`);
  console.log(`  → ${r.stats.failed === 0 ? '✅ 미배정 0건 (성공)' : '❌ 미배정 ' + r.stats.failed + '건'}`);
}

// ── 시나리오 3: 시수 초과 (수학적 불가) ─────────────────────────────────
// 1학년 1반에 40시간 배정 → 운영 35교시 초과
function scenario3() {
  const units: TeacherUnit[] = [];
  for (let t = 0; t < 8; t++) units.push(mk(`s3-${t}`, `E${t}`, `과목${t}`, 1, 1, 5)); // 8×5=40 > 35
  const r = runScheduler({ units, assignments: [], electiveGroups: [], specialRooms: [], blockedSlots: [], periodConfig: PC });
  console.log(`[시나리오3 시수초과] 총시수 40 / 배정 ${r.stats.placed} / 실패 ${r.stats.failed}`);
  const overMsg = r.failedUnits[0]?.reason ?? '(실패 없음)';
  console.log(`  → 실패 사유 예: ${overMsg}`);
  console.log(`  → ${overMsg.includes('시수 초과') ? '✅ 시수초과 진단 정확' : '❌ 진단 부정확'}`);
}

// ── 시나리오 4: 특별실 1개(미술실) 공유 — 재배치로 충돌 해소 ──────────────
// 미술실(capacity 1)을 쓰는 미술 수업이 여러 반. 그리디로 막혀도 재배치로 풀려야 함.
function scenario4() {
  const units: TeacherUnit[] = [];
  // 미술 교사 2명이 각자 여러 반 담당 (모두 미술실 사용)
  const artUnits: string[] = [];
  let idx = 0;
  for (const [teacher, classes] of [['박우용', [1, 2, 3, 4]], ['정혜진', [5, 6, 7, 8]]] as [string, number[]][]) {
    for (const c of classes) {
      const id = `s4-${idx++}`;
      units.push(mk(id, teacher, '미술', 1, c, 2)); // 각 반 2시간
      artUnits.push(id);
    }
  }
  const specialRooms = [{ id: 'art', name: '미술실', capacity: 1, unitIds: artUnits }];
  const r = runScheduler({ units, assignments: [], electiveGroups: [], specialRooms, blockedSlots: [], periodConfig: PC });
  const total = units.reduce((s, u) => s + u.totalHours, 0);
  console.log(`[시나리오4 미술실1개] 총시수 ${total} / 배정 ${r.stats.placed} / 재배치 ${r.stats.repaired} / 실패 ${r.stats.failed}`);
  console.log(`  → ${r.stats.failed === 0 ? '✅ 미배정 0건 (성공)' : '❌ 미배정 ' + r.stats.failed + '건'}`);
}

// ── 시나리오 5: 4연강 절대 금지 + 3연강 보고 ─────────────────────────────
// 한 교사가 한 반에 7시간(월~금 중 한 반) → 같은 반이라 하루 최대 몰릴 수 있음.
// 4연강이 0이어야 하고, 불가피한 3연강은 보고되어야 함.
function scenario5() {
  const units: TeacherUnit[] = [];
  // 1교사가 1반을 주 7시간 (좁은 학급 → 연강 압력)
  units.push(mk('s5-a', '한교사', '집중과목', 1, 1, 7));
  // 같은 반 나머지를 다른 교사들이 채워 28칸 사용 (35칸 중)
  for (let t = 0; t < 4; t++) units.push(mk(`s5-b${t}`, `B${t}`, `과목${t}`, 1, 1, 7));
  const r = runScheduler({ units, assignments: [], electiveGroups: [], specialRooms: [], blockedSlots: [], periodConfig: PC });
  // working에서 4연강 직접 검사
  const four = r.allAssignments.filter(a => a.name === '한교사');
  const byDay: Record<string, number[]> = {};
  for (const a of four) (byDay[a.day] ??= []).push(a.period);
  let max = 0;
  for (const day in byDay) {
    const s = [...new Set(byDay[day])].sort((x, y) => x - y);
    let cur = 1, best = 1;
    for (let i = 1; i < s.length; i++) { if (s[i] === s[i - 1] + 1) { cur++; best = Math.max(best, cur); } else cur = 1; }
    max = Math.max(max, best);
  }
  console.log(`[시나리오5 연강] 배정 ${r.stats.placed} / 실패 ${r.stats.failed} / 한교사 최대연강 ${max} / 3연강보고 ${r.threeConsecutive.length}건`);
  console.log(`  → ${max <= 3 ? '✅ 4연강 없음' : '❌ 4연강 발생!'}`);
  if (r.threeConsecutive.length > 0) {
    console.log(`     3연강 예: ${r.threeConsecutive.slice(0, 3).map(t => `${t.name} ${t.day} ${t.periods.join('·')}`).join(' / ')}`);
  }
}

// ── 시나리오 6: 3연강 강제 발생 (보고 검증) + 4연강 차단 ────────────────
// 1학년 1반: 월요일만 7교시 운영, 나머지 요일 0교시 → 모든 수업이 월요일에 몰림.
// 한 교사가 1반에 3시간 → 월요일에 3연강이 불가피.
function scenario6() {
  const pc: PeriodConfig = {
    1: { 월: 3, 화: 0, 수: 0, 목: 0, 금: 0 }, // 월요일 3교시만 운영 → 3칸뿐
    2: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
    3: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
  };
  const units: TeacherUnit[] = [
    mk('s6-a', '몰림교사', '과목A', 1, 1, 3), // 3시간을 3칸에 → 1·2·3교시 강제 3연강
  ];
  const r = runScheduler({ units, assignments: [], electiveGroups: [], specialRooms: [], blockedSlots: [], periodConfig: pc });
  // 몰림교사 최대연강
  const mine = r.allAssignments.filter(a => a.name === '몰림교사').map(a => a.period).sort((x, y) => x - y);
  let cur = 1, best = mine.length ? 1 : 0;
  for (let i = 1; i < mine.length; i++) { if (mine[i] === mine[i - 1] + 1) { cur++; best = Math.max(best, cur); } else cur = 1; }
  const has4 = r.allAssignments.some(a => {
    const ps = r.allAssignments.filter(x => x.name === a.name && x.day === a.day).map(x => x.period).sort((m, n) => m - n);
    let c = 1, b = 1; for (let i = 1; i < ps.length; i++) { if (ps[i] === ps[i - 1] + 1) { c++; b = Math.max(b, c); } else c = 1; } return b >= 4;
  });
  console.log(`[시나리오6 연강강제] 배정 ${r.stats.placed} / 실패 ${r.stats.failed} / 몰림교사 연강 ${best} / 3연강보고 ${r.threeConsecutive.length}건 / 4연강존재 ${has4}`);
  console.log(`  → ${!has4 ? '✅ 4연강 절대 없음' : '❌ 4연강 발생!'} / ${r.threeConsecutive.length > 0 ? '✅ 3연강 보고됨' : '⚠️ 3연강 보고 안됨'}`);
  if (r.threeConsecutive.length > 0) console.log(`     ${r.threeConsecutive.map(t => `${t.name} ${t.day} ${t.periods.join('·')}`).join(' / ')}`);
}

scenario1();
scenario2();
scenario3();
scenario4();
scenario5();
scenario6();
