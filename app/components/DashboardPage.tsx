'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TeacherUnit, Assignment, SpecialRoom, ElectiveGroup, BlockedSlot, PeriodConfig, DEFAULT_PERIOD_CONFIG } from '@/app/types';
import { runScheduler } from '@/lib/schedulingEngine';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

interface FailedEntry { unit: TeacherUnit; reason: string; }

interface DashboardProps {
  units: TeacherUnit[];
  classCount: { [grade: number]: number };
  specialRooms: SpecialRoom[];
  electiveGroups: ElectiveGroup[];
  periodConfig?: PeriodConfig;
}

export default function DashboardPage({
  units, classCount, specialRooms, electiveGroups, periodConfig = DEFAULT_PERIOD_CONFIG
}: DashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // ── 뷰 상태 ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedClass, setSelectedClass] = useState<number>(1);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');

  // ── 수업 교환 모드 ────────────────────────────────────────────────────────
  const [swapMode, setSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState<Assignment | null>(null);

  // ── 실패 교사 패널 ────────────────────────────────────────────────────────
  const [failedUnits, setFailedUnits] = useState<FailedEntry[]>([]);
  const [failedPanelOpen, setFailedPanelOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (units.length > 0) setSelectedTeacher(units[0].name);
  }, [units]);

  // Esc 키로 교환 모드 취소
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && swapMode) { setSwapMode(false); setSwapSource(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swapMode]);

  const classesForGrade = classCount[selectedGrade] || 12;
  useEffect(() => {
    if (selectedClass > classesForGrade) setSelectedClass(1);
  }, [selectedGrade, classesForGrade, selectedClass]);

  // ── 충돌 검사 ────────────────────────────────────────────────────────────
  const checkConflicts = useCallback((
    targetTeacher: string, targetGrade: number, targetClass: number, unitId: string,
    day: string, period: number, excludeIds: string[] = []
  ): string | null => {
    const base = assignments.filter(a => !excludeIds.includes(a.id));
    if (blockedSlots.some(b => b.teacherName === targetTeacher && b.day === day && b.period === period))
      return `⛔ ${targetTeacher} 선생님 — ${day}요일 ${period}교시는 배정 금지 슬롯입니다.`;
    if (base.some(a => a.day === day && a.period === period && a.name === targetTeacher))
      return `⚠️ ${targetTeacher} 선생님은 ${day}요일 ${period}교시에 이미 다른 수업이 있습니다.`;
    if (base.some(a => a.day === day && a.period === period && a.grade === targetGrade && a.classNum === targetClass))
      return `⚠️ ${targetGrade}학년 ${targetClass}반은 ${day}요일 ${period}교시에 이미 다른 수업이 있습니다.`;
    const room = specialRooms.find(r => r.unitIds.includes(unitId));
    if (room) {
      const usage = base.filter(a => a.day === day && a.period === period && room.unitIds.includes(a.unitId)).length;
      if (usage >= room.capacity)
        return `⚠️ ${room.name}은(는) ${day}요일 ${period}교시 수용량(${room.capacity})을 초과합니다.`;
    }
    return null;
  }, [assignments, blockedSlots, specialRooms]);

  // ── 드래그앤드롭 ──────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.setData('text/plain', `unit:${unitId}`);
  };
  const handleAssignmentDragStart = (e: React.DragEvent, a: Assignment) => {
    if (a.isFixed || swapMode) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', `move:${a.id}`);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, day: string, period: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');

    if (data.startsWith('move:')) {
      const id = data.slice(5);
      const src = assignments.find(a => a.id === id);
      if (!src) return;
      const conflict = checkConflicts(src.name, src.grade, src.classNum, src.unitId, day, period, [id]);
      if (conflict) { alert(conflict); return; }
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, day, period } : a));
      return;
    }

    const unitId = data.startsWith('unit:') ? data.slice(5) : data;
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;
    const conflict = checkConflicts(unit.name, unit.grade, unit.classNum, unit.id, day, period);
    if (conflict) { alert(conflict); return; }
    setAssignments(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      unitId: unit.id, name: unit.name, subject: unit.subject,
      grade: unit.grade, classNum: unit.classNum, day, period,
      color: unit.color, isFixed: false,
    }]);
  };

  // ── 셀 클릭 (고정 토글 / 교환 모드) ──────────────────────────────────────
  const handleCellClick = (clicked: Assignment) => {
    // ── 교환 모드 ──
    if (swapMode) {
      if (!swapSource) {
        setSwapSource(clicked);
        return;
      }
      if (swapSource.id === clicked.id) {
        setSwapSource(null);
        return;
      }
      // 양방향 충돌 검사 (서로 제외)
      const excludeIds = [swapSource.id, clicked.id];
      const errA = checkConflicts(swapSource.name, swapSource.grade, swapSource.classNum, swapSource.unitId, clicked.day, clicked.period, excludeIds);
      const errB = checkConflicts(clicked.name, clicked.grade, clicked.classNum, clicked.unitId, swapSource.day, swapSource.period, excludeIds);
      if (errA || errB) {
        alert(`🔄 교환 불가\n\n${errA || errB}`);
        setSwapSource(null);
        return;
      }
      setAssignments(prev => prev.map(a => {
        if (a.id === swapSource.id) return { ...a, day: clicked.day, period: clicked.period };
        if (a.id === clicked.id) return { ...a, day: swapSource.day, period: swapSource.period };
        return a;
      }));
      setSwapSource(null);
      setSwapMode(false);
      return;
    }

    // ── 일반 모드: 좌클릭 = 고정 토글 ──
    setAssignments(prev => prev.map(a =>
      a.id === clicked.id ? { ...a, isFixed: !a.isFixed } : a
    ));
  };

  const handleCellRightClick = (e: React.MouseEvent, clicked: Assignment) => {
    e.preventDefault();
    if (swapMode) return;
    if (clicked.isFixed && !confirm(`🔒 고정 수업을 삭제하시겠습니까?\n${clicked.name} — ${clicked.subject} (${clicked.grade}-${clicked.classNum}반)`)) return;
    setAssignments(prev => prev.filter(a => a.id !== clicked.id));
  };

  const handleEmptyCellClick = (day: string, period: number) => {
    if (swapMode) { setSwapSource(null); setSwapMode(false); return; }
    if (viewMode !== 'TEACHER') return;
    const existing = blockedSlots.find(b => b.teacherName === selectedTeacher && b.day === day && b.period === period);
    if (existing) {
      setBlockedSlots(prev => prev.filter(b => b.id !== existing.id));
    } else {
      setBlockedSlots(prev => [...prev, { id: `block-${Date.now()}`, teacherName: selectedTeacher, day, period }]);
    }
  };

  // ── 자동 배정 ─────────────────────────────────────────────────────────────
  const handleAutoSchedule = () => {
    const totalRemaining = units.reduce((acc, u) =>
      acc + Math.max(0, u.totalHours - (placedCountMap.get(u.id) ?? 0)), 0);
    if (totalRemaining === 0) { alert('✅ 모든 수업이 배정되었습니다!'); return; }
    if (!confirm(
      `🤖 자동 배정을 실행합니다.\n\n📌 적용 규칙:\n  • 1/4교시 쏠림 방지\n  • 3연강 금지\n  • 선택과목 그룹 동시 배정 (${electiveGroups.length}개)\n  • 특별실 수용량 제한 (${specialRooms.length}개)\n  • 같은 과목 같은 날 중복 회피\n\n배정 대상: 잔여 ${totalRemaining}시수\n계속하시겠습니까?`
    )) return;

    setIsRunning(true);
    setTimeout(() => {
      try {
        const result = runScheduler({ units, assignments, electiveGroups, specialRooms, blockedSlots, periodConfig });
        // ★ 재배치(이동)가 반영된 전체 시간표로 통째 교체
        setAssignments(result.allAssignments);
        setFailedUnits(result.failedUnits);
        if (result.failedUnits.length > 0) setFailedPanelOpen(true);

        // 실패 사유를 유형별로 분류
        const overCapacity = [...new Set(result.failedUnits.filter(f => f.reason.includes('시수 초과')).map(f => f.reason))];
        const conflictTeachers = [...new Set(result.failedUnits.map(f => f.unit.name))];
        const repairMsg = result.stats.repaired > 0 ? `\n• 재배치로 자리 확보: ${result.stats.repaired}건` : '';

        // 3연강 교사 메시지 (4연강은 절대 발생 안 함)
        const tc = result.threeConsecutive;
        let threeMsg = '';
        if (tc.length > 0) {
          const byTeacher = [...new Set(tc.map(t => t.name))];
          threeMsg =
            `\n\n🟠 부득이하게 3연강이 배정된 교사 (${byTeacher.length}명):\n` +
            tc.slice(0, 8).map(t => `  • ${t.name} — ${t.day} ${t.periods.join('·')}교시`).join('\n') +
            (tc.length > 8 ? `\n  … 외 ${tc.length - 8}건` : '');
        }

        alert(
          `✅ 자동 배정 완료!\n\n• 신규 배정: ${result.stats.placed}건${repairMsg}\n• 선택과목 그룹: ${result.stats.electiveGroupsPlaced}회\n• 배정 실패: ${result.stats.failed}건\n• 4연강: 0건 (절대 금지) / 3연강: ${tc.length}건` +
          (result.failedUnits.length > 0
            ? (overCapacity.length > 0
                ? `\n\n⛔ 미배정 원인은 "시수 초과"입니다 (알고리즘으로 해결 불가):\n${overCapacity.slice(0, 5).map(r => '  ' + r).join('\n')}\n\n→ 시수표 또는 학년별 교시설정을 조정해 주세요.`
                : `\n\n⚠️ 좌측 [실패 교사 패널]에서 상세 내역을 확인하세요.\n영향 교사: ${conflictTeachers.slice(0, 3).join(', ')}${conflictTeachers.length > 3 ? ` 외 ${conflictTeachers.length - 3}명` : ''}`)
            : '\n\n🎉 모든 수업이 완벽히 배정되었습니다!') +
          threeMsg
        );
      } catch (err) {
        alert(`❌ 배정 중 오류: ${String(err)}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  };

  // ── 실패 교사 패널: 교사별 그룹핑 ──────────────────────────────────────
  const failedByTeacher = failedUnits.reduce<Record<string, FailedEntry[]>>((acc, f) => {
    if (!acc[f.unit.name]) acc[f.unit.name] = [];
    acc[f.unit.name].push(f);
    return acc;
  }, {});

  const uniqueTeachers = [...new Set(units.map(u => u.name))];

  // 유닛별 배정 수를 한 번만 계산 (사이드바 filter+map 중복 스캔 방지)
  const placedCountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignments) m.set(a.unitId, (m.get(a.unitId) ?? 0) + 1);
    return m;
  }, [assignments]);

  if (!isMounted) return <div className="text-slate-500 p-4">데이터 동기화 중...</div>;

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">

      {/* ── 좌측 사이드바 ─────────────────────────────────────────────────── */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col backdrop-blur-sm overflow-hidden">

        {/* 서랍장 헤더 */}
        <div className="p-6 pb-3 shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-amber-400">시수 블록 서랍장</h1>
          <p className="text-xs text-slate-400 mt-1">엑셀에서 자동 변환된 유닛 리스트</p>
        </div>

        {/* 유닛 목록 */}
        <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-3 pb-3">
          {units.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-12 border border-dashed border-slate-800 rounded-xl">
              업로드된 시수표 데이터가 없습니다.<br />메뉴판에서 엑셀을 먼저 등록해 주세요.
            </div>
          ) : (
            units
              .filter(unit => {
                const matchesView = viewMode === 'CLASS'
                  ? unit.grade === selectedGrade && unit.classNum === selectedClass
                  : unit.name === selectedTeacher;
                return matchesView && unit.totalHours - (placedCountMap.get(unit.id) ?? 0) > 0;
              })
              .map(unit => {
                const remaining = unit.totalHours - (placedCountMap.get(unit.id) ?? 0);
                return (
                  <div
                    key={unit.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, unit.id)}
                    className={`p-4 rounded-xl border bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all duration-200 cursor-grab shadow-md group relative overflow-hidden ${unit.color}`}
                  >
                    <div className="absolute top-0 right-0 bg-slate-800 border-l border-b border-slate-700 px-2.5 py-1 rounded-bl-lg text-xs font-bold text-slate-300">
                      잔여 <span className="text-amber-400 font-extrabold">{remaining}</span> / {unit.totalHours}T
                    </div>
                    <span className="font-semibold text-base text-slate-200 group-hover:text-white">{unit.name} 교사</span>
                    <div className="text-sm font-medium mt-2 text-slate-400">{unit.subject}</div>
                    <div className="text-xs text-slate-500 mt-1">{unit.grade}학년 {unit.classNum}반</div>
                  </div>
                );
              })
          )}
        </div>

        {/* ── 실패 교사 패널 ──────────────────────────────────────────────── */}
        {failedUnits.length > 0 && (
          <div className="shrink-0 border-t border-slate-800">
            {/* 패널 토글 헤더 */}
            <button
              onClick={() => setFailedPanelOpen(p => !p)}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-sm">⚠️</span>
                <span className="text-sm font-bold text-red-400">배정 실패</span>
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {Object.keys(failedByTeacher).length}명
                </span>
              </div>
              <span className="text-slate-500 text-xs">{failedPanelOpen ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>

            {/* 교사별 실패 목록 */}
            {failedPanelOpen && (
              <div className="px-4 pb-4 max-h-64 overflow-y-auto flex flex-col gap-2">
                {Object.entries(failedByTeacher).map(([teacherName, entries]) => {
                  const uniqSubjects = [...new Set(entries.map(e => `${e.unit.subject} ${e.unit.grade}-${e.unit.classNum}반`))];
                  return (
                    <div key={teacherName} className="bg-red-950/30 border border-red-900/40 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-red-300">{teacherName} 교사</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setViewMode('TEACHER');
                              setSelectedTeacher(teacherName);
                            }}
                            className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300 transition-all"
                            title="이 교사 시간표로 이동"
                          >
                            🔍 보기
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {uniqSubjects.slice(0, 4).map(s => (
                          <span key={s} className="text-[10px] text-red-400/80 bg-red-900/20 px-2 py-0.5 rounded">
                            • {s}
                          </span>
                        ))}
                        {uniqSubjects.length > 4 && (
                          <span className="text-[10px] text-slate-500">... 외 {uniqSubjects.length - 4}건</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1.5">{entries[0].reason}</div>
                    </div>
                  );
                })}
                <button
                  onClick={() => { setFailedUnits([]); setFailedPanelOpen(false); }}
                  className="text-xs text-slate-600 hover:text-slate-400 text-center mt-1 transition-all"
                >
                  패널 닫기
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── 우측 메인 뷰 ──────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 flex flex-col overflow-hidden">

        {/* 툴바 */}
        <div className="mb-6 flex justify-between items-end border-b border-slate-800 pb-4">
          <div className="flex gap-4 items-center flex-wrap">
            {/* 뷰 모드 토글 */}
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex">
              <button onClick={() => setViewMode('CLASS')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'CLASS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                반별 보기
              </button>
              <button onClick={() => setViewMode('TEACHER')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'TEACHER' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                교사별 보기
              </button>
            </div>

            {viewMode === 'CLASS' ? (
              <div className="flex gap-2">
                <select value={selectedGrade} onChange={e => setSelectedGrade(Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {[1, 2, 3].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
                <select value={selectedClass} onChange={e => setSelectedClass(Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {Array.from({ length: classesForGrade }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {uniqueTeachers.map(t => <option key={t} value={t}>{t} 선생님</option>)}
                </select>
                {!swapMode && (
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">빈 칸 클릭 → 배정 금지 토글</span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* 비고정 초기화 */}
            {assignments.some(a => !a.isFixed) && !swapMode && (
              <button
                onClick={() => {
                  if (!confirm('⚠️ 🔒 고정되지 않은 배치를 모두 지웁니다. 계속하시겠습니까?')) return;
                  setAssignments(prev => prev.filter(a => a.isFixed));
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-700/60 text-slate-400 hover:text-red-400 transition-all"
              >
                🗑️ 비고정 초기화
              </button>
            )}

            {/* 🔄 수업 교환 모드 */}
            <button
              onClick={() => { setSwapMode(p => !p); setSwapSource(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all duration-200 ${
                swapMode
                  ? 'bg-amber-500 border-amber-400 text-slate-900 shadow-lg shadow-amber-500/30 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-amber-950/40 hover:border-amber-600/50 hover:text-amber-400'
              }`}
              title="두 수업 셀을 순서대로 클릭하면 교환합니다 (Esc: 취소)"
            >
              <span>🔄</span>
              <span>{swapMode ? (swapSource ? `"${swapSource.subject}" 선택됨 — 교환할 수업 클릭` : '교환할 첫 번째 수업 클릭') : '수업 교환 모드'}</span>
              {swapMode && <span className="text-xs bg-black/20 px-1.5 py-0.5 rounded">Esc 취소</span>}
            </button>

            {/* 자동 배정 */}
            <button
              onClick={handleAutoSchedule}
              disabled={isRunning || swapMode}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white shadow-lg shadow-violet-900/50 active:scale-95 transition-all border border-violet-500/30"
            >
              <span>{isRunning ? '⏳' : '✨'}</span>
              <span>{isRunning ? '배정 중...' : '남은 수업 자동 배정'}</span>
              <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">알고리즘 가동</span>
            </button>

            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-100">
                {viewMode === 'CLASS' ? `${selectedGrade}학년 ${selectedClass}반` : `${selectedTeacher} 교사 일과`}
              </h2>
            </div>
          </div>
        </div>

        {/* 시간표 그리드 */}
        <div className={`flex-1 border border-slate-800 rounded-2xl p-6 overflow-auto backdrop-blur-sm shadow-xl flex flex-col transition-all ${
          swapMode ? 'bg-amber-950/10 border-amber-800/40' : 'bg-slate-900/40'
        }`}>
          <div className="w-full border-collapse flex flex-col flex-1 min-w-3xl">
            <div className="grid grid-cols-6 border-b border-slate-800 pb-4 text-center font-semibold text-sm text-slate-300">
              <div className="text-left pl-2 text-slate-500 font-normal">교시</div>
              {DAYS.map(day => <div key={day}>{day}요일</div>)}
            </div>

            <div className="flex-1 flex flex-col justify-between pt-2">
              {PERIODS.map(period => (
                <div key={period} className="grid grid-cols-6 items-center py-2">
                  <div className="text-left pl-2 font-bold text-slate-400">{period}교시</div>
                  {DAYS.map(day => {
                    const placedUnit = assignments.find(a =>
                      viewMode === 'CLASS'
                        ? a.grade === selectedGrade && a.classNum === selectedClass && a.day === day && a.period === period
                        : a.name === selectedTeacher && a.day === day && a.period === period
                    );
                    const isBlocked = viewMode === 'TEACHER' && blockedSlots.some(
                      b => b.teacherName === selectedTeacher && b.day === day && b.period === period
                    );
                    const maxPeriod = viewMode === 'CLASS' ? (periodConfig[selectedGrade]?.[day] ?? 7) : 7;
                    const isOutOfRange = period > maxPeriod;
                    const isSwapSelected = swapSource?.id === placedUnit?.id;

                    return (
                      <div
                        key={`${day}-${period}`}
                        className="px-1.5 h-full min-h-20"
                        onDragOver={isOutOfRange ? undefined : handleDragOver}
                        onDrop={isOutOfRange ? undefined : e => handleDrop(e, day, period)}
                      >
                        {placedUnit ? (
                          // ── 배치된 수업 셀 ─────────────────────────────
                          <div
                            draggable={!placedUnit.isFixed && !swapMode}
                            onDragStart={e => handleAssignmentDragStart(e, placedUnit)}
                            onClick={() => handleCellClick(placedUnit)}
                            onContextMenu={e => handleCellRightClick(e, placedUnit)}
                            title={swapMode
                              ? (swapSource ? '이 수업과 교환' : '교환할 수업 선택')
                              : (placedUnit.isFixed ? '좌클릭: 고정 해제 | 우클릭: 삭제' : '좌클릭: 고정 | 우클릭: 삭제 | 드래그: 이동')}
                            className={`w-full h-full rounded-xl border p-2 flex flex-col justify-center items-center text-center transition-all duration-150 relative ${
                              isSwapSelected
                                ? 'bg-amber-500/30 border-amber-400 ring-2 ring-amber-400 cursor-crosshair scale-95'
                                : swapMode
                                  ? 'cursor-crosshair hover:ring-2 hover:ring-amber-500/60 ' + (placedUnit.isFixed ? 'opacity-50' : `bg-slate-900/90 ${placedUnit.color} hover:brightness-110`)
                                  : placedUnit.isFixed
                                    ? 'cursor-pointer bg-slate-700 border-slate-500 ring-2 ring-slate-400/60 shadow-inner'
                                    : `cursor-grab active:cursor-grabbing bg-slate-900/90 ${placedUnit.color} hover:brightness-110`
                            }`}
                          >
                            {isSwapSelected && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[9px] text-slate-900 font-black">1</span>
                            )}
                            {placedUnit.isFixed && !isSwapSelected ? (
                              <>
                                <span className="text-2xl leading-none mb-1">🔒</span>
                                <span className="text-xs font-bold text-slate-200">{viewMode === 'CLASS' ? `${placedUnit.name} 교사` : `${placedUnit.grade}-${placedUnit.classNum}반`}</span>
                                <span className="text-xs text-slate-400 mt-0.5">{placedUnit.subject}</span>
                                <span className="absolute top-1 right-1.5 text-[9px] font-bold text-slate-400 bg-slate-600 px-1 py-0.5 rounded">고정</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs font-bold">{viewMode === 'CLASS' ? `${placedUnit.name} 교사` : `${placedUnit.grade}-${placedUnit.classNum}반`}</span>
                                <span className="text-xs opacity-80 mt-0.5">{placedUnit.subject}</span>
                              </>
                            )}
                          </div>
                        ) : isOutOfRange ? (
                          // ── 미운영 교시 ────────────────────────────────
                          <div className="w-full h-full rounded-xl border border-slate-900 bg-slate-950/60 flex items-center justify-center"
                            style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(15,23,42,0.4) 5px, rgba(15,23,42,0.4) 10px)' }}>
                            <span className="text-[10px] text-slate-700 font-bold">미운영</span>
                          </div>
                        ) : isBlocked ? (
                          // ── 배정 금지 슬롯 ─────────────────────────────
                          <div
                            onClick={() => handleEmptyCellClick(day, period)}
                            className="w-full h-full rounded-xl border border-red-900/60 bg-red-950/30 flex flex-col items-center justify-center cursor-pointer hover:bg-red-950/50 transition-all"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(185,28,28,0.08) 4px, rgba(185,28,28,0.08) 8px)' }}
                          >
                            <span className="text-lg">⛔</span>
                            <span className="text-[9px] text-red-400/70 font-bold mt-0.5">배정 금지</span>
                          </div>
                        ) : (
                          // ── 빈 셀 ──────────────────────────────────────
                          <div
                            onClick={() => handleEmptyCellClick(day, period)}
                            className={`w-full h-full rounded-xl border border-dashed bg-slate-950/30 flex items-center justify-center text-xl font-light transition-all ${
                              swapMode
                                ? 'border-amber-800/40 text-amber-900 cursor-default'
                                : viewMode === 'TEACHER'
                                  ? 'border-slate-700 text-slate-700 hover:text-slate-500 cursor-pointer hover:bg-red-950/10 hover:border-slate-600'
                                  : 'border-slate-800 text-slate-800 cursor-default'
                            }`}
                          >
                            {!swapMode && (viewMode === 'TEACHER' ? '✕' : '+')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
