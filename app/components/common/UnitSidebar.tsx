// app/components/common/UnitSidebar.tsx
'use client';

import React from 'react';
import { TeacherUnit } from '@/app/types';

interface UnitSidebarProps {
  units: TeacherUnit[];
  // 사용된(또는 그룹화된) 유닛의 ID 배열 (해당 유닛은 목록에서 숨기거나 표시를 다르게 하기 위함)
  usedUnitIds?: string[]; 
}

export default function UnitSidebar({ units, usedUnitIds = [] }: UnitSidebarProps) {
  // 드래그 시작 시 유닛 ID를 전달하는 함수
  const handleDragStart = (e: React.DragEvent, unitId: string) => {
    e.dataTransfer.setData('text/plain', unitId);
  };

  // 사용되지 않은(남은) 유닛만 필터링
  const availableUnits = units.filter(unit => !usedUnitIds.includes(unit.id));

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-6 backdrop-blur-sm h-full">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-amber-400">시수 블록 서랍장</h1>
        <p className="text-xs text-slate-400 mt-1">마우스로 끌어서 배치하세요</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
        {availableUnits.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-12 border border-dashed border-slate-800 rounded-xl">
            남은 시수 유닛이 없습니다.
          </div>
        ) : (
          availableUnits.map((unit) => (
            <div
              key={unit.id}
              draggable
              onDragStart={(e) => handleDragStart(e, unit.id)}
              className={`p-4 rounded-xl border bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all duration-200 cursor-grab shadow-md group relative overflow-hidden ${unit.color}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-semibold text-base text-slate-200 group-hover:text-white">
                  {unit.name} 교사
                </span>
              </div>
              <div className="text-sm font-medium mt-2 text-slate-400">{unit.subject}</div>
              <div className="text-xs text-slate-500 mt-1">대상: {unit.grade}학년 {unit.classNum}반</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}