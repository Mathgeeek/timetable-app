'use client';

import React, { useState, useEffect } from 'react';
import { TeacherUnit, Assignment, SpecialRoom, ElectiveGroup, BlockedSlot } from '@/app/types';
import { runScheduler } from '@/lib/schedulingEngine';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

interface DashboardProps {
  units: TeacherUnit[];
  classCount: { [grade: number]: number };
  specialRooms: SpecialRoom[];
  electiveGroups: ElectiveGroup[];
}

export default function DashboardPage({ units, classCount, specialRooms, electiveGroups }: DashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedClass, setSelectedClass] = useState<number>(1);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
    if (units.length > 0) setSelectedTeacher(units[0].name);
  }, [units]);

  const classesForGrade = classCount[selectedGrade] || 12;
  useEffect(() => {
    if (selectedClass > classesForGrade) setSelectedClass(1);
  }, [selectedGrade, classesForGrade, selectedClass]);

  // ── 드래그앤드롭 ────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.setData('text/plain', unitId);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent, day: string, period: number) => {
    e.preventDefault();
    const unitId = e.dataTransfer.getData('text/plain');
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    const targetGrade = unit.grade;
    const targetClass = unit.classNum;
    const targetTeacher = unit.name;

    // 배정 금지 슬롯 체크
    if (blockedSlots.some(b => b.teacherName === targetTeacher && b.day === day && b.period === period)) {
      alert(`⛔ ${targetTeacher} 선생님은 ${day}요일 ${period}교시가 배정 금지 슬롯으로 설정되어 있습니다.`);
      return;
    }

    if (assignments.some(a => a.day === day && a.period === period && a.name === targetTeacher)) {
      alert(`⚠️ ${targetTeacher} 선생님은 해당 교시에 이미 다른 학급 수업이 배정되어 있습니다!`);
      return;
    }

    if (assignments.some(a => a.day === day && a.period === period && a.grade === targetGrade && a.classNum === targetClass)) {
      alert(`⚠️ ${targetGrade}학년 ${targetClass}반은 ${period}교시에 이미 다른 수업이 있습니다!`);
      return;
    }

    const targetRoom = specialRooms.find(r => r.unitIds.includes(unit.id));
    if (targetRoom) {
      const roomBusyCount = assignments.filter(a =>
        a.day === day && a.period === period && targetRoom.unitIds.includes(a.unitId)
      ).length;
      if (roomBusyCount >= targetRoom.capacity) {
        alert(`⚠️ ${targetRoom.name}은(는) ${day}요일 ${period}교시에 이미 최대 수용량(${targetRoom.capacity}학급)이 사용 중입니다!`);
        return;
      }
    }

    const newAssignment: Assignment = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      unitId: unit.id,
      name: unit.name,
      subject: unit.subject,
      grade: targetGrade,
      classNum: targetClass,
      day,
      period,
      color: unit.color,
      isFixed: false,
    };
    setAssignments(prev => [...prev, newAssignment]);
  };

  // ── 셀 클릭: 수업 셀(고정 토글/삭제) + 빈 셀(교사뷰일 때 배정금지 토글) ──
  const handleCellClick = (placedUnit: Assignment) => {
    if (!placedUnit.isFixed) {
      setAssignments(prev => prev.map(a => a.id === placedUnit.id ? { ...a, isFixed: true } : a));
    } else {
      setAssignments(prev => prev.filter(a => a.id !== placedUnit.id));
    }
  };

  const handleEmptyCellClick = (day: string, period: number) => {
    if (viewMode !== 'TEACHER') return;
    const existing = blockedSlots.find(
      b => b.teacherName === selectedTeacher && b.day === day && b.period === period
    );
    if (existing) {
      setBlockedSlots(prev => prev.filter(b => b.id !== existing.id));
    } else {
      setBlockedSlots(prev => [...prev, {
        id: `block-${Date.now()}`,
        teacherName: selectedTeacher,
        day,
        period,
      }]);
    }
  };

  // ── 자동 배정 실행 ──────────────────────────────────────────────────────
  const handleAutoSchedule = () => {
    const totalRemaining = units.reduce((acc, u) => {
      const placed = assignments.filter(a => a.unitId === u.id).length;
      return acc + Math.max(0, u.totalHours - placed);
    }, 0);

    if (totalRemaining === 0) {
      alert('✅ 배정할 남은 수업이 없습니다. 모든 수업이 이미 배정되었습니다!');
      return;
    }

    if (!confirm(
      `🤖 자동 배정 알고리즘을 실행합니다.\n\n` +
      `📌 적용 규칙:\n` +
      `  • 1/4교시 수업 쏠림 방지\n` +
      `  • 3연강 금지 (교사/학급)\n` +
      `  • 선택과목 그룹 동시 배정 (${electiveGroups.length}개 그룹)\n` +
      `  • 특별실 수용량 제한 (${specialRooms.length}개 특별실)\n` +
      `  • 교사 하루 최대 5교시\n` +
      `  • 같은 과목 같은 날 중복 배정 회피\n\n` +
      `배정 대상: 잔여 ${totalRemaining}시수\n\n` +
      `계속 진행하시겠습니까?`
    )) return;

    setIsRunning(true);

    setTimeout(() => {
      try {
        const result = runScheduler({
          units,
          assignments,
          electiveGroups,
          specialRooms,
          blockedSlots,
        });

        setAssignments(prev => [...prev, ...result.newAssignments]);

        const failMsg = result.failedUnits.length > 0
          ? `\n\n⚠️ 배정 실패 ${result.failedUnits.length}건:\n` +
            result.failedUnits.slice(0, 5).map(f => `  • ${f.unit.name}(${f.unit.subject} ${f.unit.grade}-${f.unit.classNum}반): ${f.reason}`).join('\n') +
            (result.failedUnits.length > 5 ? `\n  ... 외 ${result.failedUnits.length - 5}건` : '')
          : '';

        alert(
          `✅ 자동 배정 완료!\n\n` +
          `• 신규 배정: ${result.stats.placed}건\n` +
          `• 선택과목 그룹 처리: ${result.stats.electiveGroupsPlaced}회\n` +
          `• 배정 실패: ${result.stats.failed}건` +
          failMsg
        );
      } catch (err) {
        alert(`❌ 배정 중 오류 발생: ${String(err)}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  };

  const uniqueTeachers = Array.from(new Set(units.map(u => u.name)));

  if (!isMounted) return <div className="text-slate-500 p-4">데이터 동기화 중...</div>;

  return (
    <div className="flex h-full w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">

      {/* 좌측 서랍장 */}
      <aside className="w-80 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-amber-400">시수 블록 서랍장</h1>
          <p className="text-xs text-slate-400 mt-1">엑셀에서 자동 변환된 유닛 리스트</p>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
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
                const assignedCount = assignments.filter(a => a.unitId === unit.id).length;
                return matchesView && (unit.totalHours - assignedCount > 0);
              })
              .map((unit) => {
                const assignedCount = assignments.filter(a => a.unitId === unit.id).length;
                const remainingHours = unit.totalHours - assignedCount;
                return (
                  <div
                    key={unit.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, unit.id)}
                    className={`p-4 rounded-xl border bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all duration-200 cursor-grab shadow-md group relative overflow-hidden ${unit.color}`}
                  >
                    <div className="absolute top-0 right-0 bg-slate-800 border-l border-b border-slate-700 px-2.5 py-1 rounded-bl-lg text-xs font-bold text-slate-300">
                      잔여 <span className="text-amber-400 font-extrabold">{remainingHours}</span> / {unit.totalHours}T
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-base text-slate-200 group-hover:text-white">
                        {unit.name} 교사
                      </span>
                    </div>
                    <div className="text-sm font-medium mt-2 text-slate-400">{unit.subject}</div>
                    <div className="text-xs text-slate-500 mt-1">대상: {unit.grade}학년 {unit.classNum}반</div>
                  </div>
                );
              })
          )}
        </div>
      </aside>

      {/* 우측 시간표 메인 뷰 */}
      <main className="flex-1 p-6 flex flex-col overflow-hidden">
        <div className="mb-6 flex justify-between items-end border-b border-slate-800 pb-4">
          <div className="flex gap-4 items-center">
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
                <select value={selectedGrade} onChange={(e) => setSelectedGrade(Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {[1, 2, 3].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
                <select value={selectedClass} onChange={(e) => setSelectedClass(Number(e.target.value))} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {Array.from({ length: classesForGrade }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                  {uniqueTeachers.map(t => <option key={t} value={t}>{t} 선생님</option>)}
                </select>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
                  빈 칸 클릭 → 배정 금지 토글
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* 자동 배정 버튼 */}
            <button
              onClick={handleAutoSchedule}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white shadow-lg shadow-violet-900/50 hover:shadow-violet-700/60 active:scale-95 transition-all duration-200 border border-violet-500/30"
            >
              <span className="text-base">{isRunning ? '⏳' : '✨'}</span>
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

        <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 overflow-auto backdrop-blur-sm shadow-xl flex flex-col">
          <div className="w-full border-collapse flex flex-col flex-1 min-w-3xl">
            <div className="grid grid-cols-6 border-b border-slate-800 pb-4 text-center font-semibold text-sm text-slate-300">
              <div className="text-left pl-2 text-slate-500 font-normal">교시</div>
              {DAYS.map((day) => <div key={day}>{day}요일</div>)}
            </div>

            <div className="flex-1 flex flex-col justify-between pt-2">
              {PERIODS.map((period) => (
                <div key={period} className="grid grid-cols-6 items-center py-2">
                  <div className="text-left pl-2 font-bold text-slate-400">{period}교시</div>
                  {DAYS.map((day) => {
                    const placedUnit = assignments.find(a => {
                      if (viewMode === 'CLASS') {
                        return a.grade === selectedGrade && a.classNum === selectedClass && a.day === day && a.period === period;
                      } else {
                        return a.name === selectedTeacher && a.day === day && a.period === period;
                      }
                    });

                    const isBlocked = viewMode === 'TEACHER' && blockedSlots.some(
                      b => b.teacherName === selectedTeacher && b.day === day && b.period === period
                    );

                    return (
                      <div
                        key={`${day}-${period}`}
                        className="px-1.5 h-full min-h-20"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day, period)}
                      >
                        {placedUnit ? (
                          // ── 배치된 수업 셀 ──────────────────────────────
                          <div
                            onClick={() => handleCellClick(placedUnit)}
                            title={placedUnit.isFixed ? '클릭하면 고정 해제됩니다' : '클릭하면 고정됩니다'}
                            className={`w-full h-full rounded-xl border p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-150 ${
                              placedUnit.isFixed
                                ? 'bg-slate-700 border-slate-500 ring-2 ring-slate-400/60 shadow-inner'
                                : `bg-slate-900/90 ${placedUnit.color} hover:brightness-110`
                            }`}
                          >
                            {placedUnit.isFixed ? (
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
                        ) : isBlocked ? (
                          // ── 배정 금지 슬롯 ──────────────────────────────
                          <div
                            onClick={() => handleEmptyCellClick(day, period)}
                            title="클릭하면 배정 금지 해제"
                            className="w-full h-full rounded-xl border border-red-900/60 bg-red-950/30 flex flex-col items-center justify-center cursor-pointer group hover:bg-red-950/50 transition-all"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(185,28,28,0.08) 4px, rgba(185,28,28,0.08) 8px)' }}
                          >
                            <span className="text-lg">⛔</span>
                            <span className="text-[9px] text-red-400/70 font-bold mt-0.5">배정 금지</span>
                          </div>
                        ) : (
                          // ── 빈 셀 ──────────────────────────────────────
                          <div
                            onClick={() => handleEmptyCellClick(day, period)}
                            className={`w-full h-full rounded-xl border border-dashed hover:border-slate-600 bg-slate-950/30 flex items-center justify-center text-xl font-light transition-all ${
                              viewMode === 'TEACHER'
                                ? 'border-slate-700 text-slate-700 hover:text-slate-500 cursor-pointer hover:bg-red-950/10'
                                : 'border-slate-800 text-slate-800 cursor-default'
                            }`}
                            title={viewMode === 'TEACHER' ? '클릭하면 배정 금지 슬롯으로 설정' : ''}
                          >
                            {viewMode === 'TEACHER' ? '✕' : '+'}
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
