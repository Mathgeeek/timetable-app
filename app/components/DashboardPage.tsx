'use client';

import React, { useState, useEffect } from 'react';
import { TeacherUnit, Assignment } from '@/app/types';


const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

interface DashboardProps {
  units: TeacherUnit[];
  classCount: { [grade: number]: number };
}

export default function DashboardPage({ units, classCount }: DashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedGrade, setSelectedGrade] = useState<number>(1);
  const [selectedClass, setSelectedClass] = useState<number>(1);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
    if (units.length > 0) {
      setSelectedTeacher(units[0].name);
    }
  }, [units]);

  const classesForGrade = classCount[selectedGrade] || 12;

  useEffect(() => {
    if (selectedClass > classesForGrade) {
      setSelectedClass(1);
    }
  }, [selectedGrade, classesForGrade, selectedClass]);

  const handleDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.setData('text/plain', unitId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, day: string, period: number) => {
    e.preventDefault();
    const unitId = e.dataTransfer.getData('text/plain');
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;

    // 언제나 유닛 블록 자체의 원래 반과 학년 정보가 주 타겟이 됩니다.
    const targetGrade = unit.grade;
    const targetClass = unit.classNum;
    const targetTeacher = unit.name;

    // 1. 교사 중복 검사: 같은 교시에 해당 교사가 이미 다른 학급 수업이 잡혀있는지 검사
    const isTeacherBusy = assignments.some(
      a => a.day === day && a.period === period && a.name === targetTeacher
    );
    if (isTeacherBusy) {
      alert(`⚠️ ${targetTeacher} 선생님은 해당 교시에 이미 다른 학급 수업이 배정되어 있습니다!`);
      return;
    }

    // 2. 반 중복 검사: 해당 학급의 그 교시에 이미 다른 수업이 차 있는지 검사
    const isClassBusy = assignments.some(
      a => a.day === day && a.period === period && a.grade === targetGrade && a.classNum === targetClass
    );
    if (isClassBusy) {
      alert(`⚠️ ${targetGrade}학년 ${targetClass}반은 ${period}교시에 이미 다른 수업이 있습니다!`);
      return;
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
      isFixed: false
    };

    // 충돌 검사를 철저히 마쳤으므로 기존 시간표 유실 없이 안전하게 결합합니다.
    setAssignments(prev => [...prev, newAssignment]);
  };

  const handleCellClick = (currentAssignment: Assignment) => {
    if (!currentAssignment.isFixed) {
      setAssignments(prev => prev.map(a => a.id === currentAssignment.id ? { ...a, isFixed: true } : a));
    } else {
      setAssignments(prev => prev.filter(a => a.id !== currentAssignment.id));
    }
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
              업로드된 시수표 데이터가 없습니다.<br/>메뉴판에서 엑셀을 먼저 등록해 주세요.
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
              <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
                {uniqueTeachers.map(t => <option key={t} value={t}>{t} 선생님</option>)}
              </select>
            )}
          </div>

          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-100">
              {viewMode === 'CLASS' ? `${selectedGrade}학년 ${selectedClass}반` : `${selectedTeacher} 교사 일과`}
            </h2>
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

                    return (
                      <div key={`${day}-${period}`} className="px-1.5 h-full min-h-20" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, day, period)}>
                        {placedUnit ? (
                          <div onClick={() => handleCellClick(placedUnit)} className={`w-full h-full rounded-xl border p-2 flex flex-col justify-center items-center text-center cursor-pointer relative bg-slate-900/90 ${placedUnit.color} ${placedUnit.isFixed ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}>
                            {placedUnit.isFixed && <span className="absolute top-1 right-1 text-amber-400 text-xs font-bold">📌</span>}
                            <span className="text-xs font-bold">{viewMode === 'CLASS' ? `${placedUnit.name} 교사` : `${placedUnit.grade}-${placedUnit.classNum}반`}</span>
                            <span className="text-xs opacity-80 mt-0.5">{placedUnit.subject}</span>
                          </div>
                        ) : (
                          <div className="w-full h-full rounded-xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-950/30 flex items-center justify-center cursor-pointer text-slate-800 hover:text-slate-500 text-xl font-light">+</div>
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