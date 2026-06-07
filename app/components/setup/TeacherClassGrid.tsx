'use client';

import React from 'react';
import { TeacherUnit } from '@/app/types';

interface TeacherClassGridProps {
  units: TeacherUnit[];
  usedUnitIds: string[];
  selectedGrade: number;
}

export default function TeacherClassGrid({ units, usedUnitIds, selectedGrade }: TeacherClassGridProps) {
  // 현재 선택된 학년의 유닛들만 필터링
  const filteredUnits = units.filter(u => u.grade === selectedGrade);

  // 교사 목록 (해당 학년 수업이 있는 교사만, 중복 제거 및 정렬)
  const teachers = Array.from(new Set(filteredUnits.map(u => u.name))).sort();
  
  // 학급 목록 (해당 학년만, 중복 제거 및 정렬)
  const classList = Array.from(new Set(filteredUnits.map(u => `${u.grade}-${u.classNum}`))).sort((a, b) => {
    const [, cA] = a.split('-').map(Number);
    const [, cB] = b.split('-').map(Number);
    return cA - cB;
  });

  const handleDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.setData('text/plain', unitId);
  };

  // 데이터 맵핑: teacher -> classKey -> units[]
  const gridData: Record<string, Record<string, TeacherUnit[]>> = {};
  teachers.forEach(t => {
    gridData[t] = {};
    classList.forEach(c => {
      gridData[t][c] = [];
    });
  });

  filteredUnits.forEach(unit => {
    const classKey = `${unit.grade}-${unit.classNum}`;
    if (gridData[unit.name] && gridData[unit.name][classKey]) {
      gridData[unit.name][classKey].push(unit);
    }
  });

  return (
    <div className="flex-1 overflow-auto bg-slate-900/50">
      <table className="min-w-full border-collapse table-fixed">
        <thead className="sticky top-0 z-20 bg-slate-900 shadow-sm">
          <tr>
            <th className="sticky left-0 z-30 bg-slate-900 p-2 border border-slate-700 text-xs font-bold text-amber-400 w-24">
              교사 \ 학급
            </th>
            {classList.map(cls => (
              <th key={cls} className="p-2 border border-slate-700 text-xs font-bold text-slate-300 w-20">
                {cls}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teachers.map(teacher => (
            <tr key={teacher}>
              <td className="sticky left-0 z-10 bg-slate-900 p-2 border border-slate-700 text-sm font-medium text-slate-200">
                {teacher}
              </td>
              {classList.map(cls => {
                const cellUnits = gridData[teacher][cls];
                return (
                  <td key={`${teacher}-${cls}`} className="p-1 border border-slate-700 min-h-12 vertical-top">
                    <div className="flex flex-wrap gap-1">
                      {cellUnits.map(unit => {
                        const isUsed = usedUnitIds.includes(unit.id);
                        return (
                          <div
                            key={unit.id}
                            draggable={!isUsed}
                            onDragStart={(e) => handleDragStart(e, unit.id)}
                            className={`
                              px-2 py-1 rounded text-[10px] font-medium transition-all
                              ${isUsed 
                                ? 'bg-slate-800 text-slate-600 border border-slate-700 opacity-50 cursor-not-allowed' 
                                : `cursor-grab hover:scale-105 active:scale-95 border border-white/10 shadow-sm ${unit.color || 'bg-blue-600 text-white'}`
                              }
                            `}
                            title={`${unit.subject} (${unit.grade}-${unit.classNum})`}
                          >
                            {unit.subject}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
