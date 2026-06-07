// app/components/setup/ElectiveGroupBuilder.tsx
'use client';

import React, { useState } from 'react';
import { TeacherUnit, ElectiveGroup } from '@/app/types';
import TeacherClassGrid from '@/app/components/setup/TeacherClassGrid';

interface ElectiveGroupBuilderProps {
  // 상위 페이지에서 엑셀 파싱된 전체 유닛을 넘겨받는다고 가정합니다
  initialUnits: TeacherUnit[];
}

export default function ElectiveGroupBuilder({ initialUnits }: ElectiveGroupBuilderProps) {
  // 현재 선택된 학년 (1, 2, 3)
  const [selectedGrade, setSelectedGrade] = useState(1);

  // 생성된 동시수업 그룹들을 관리하는 상태 (추후 이 데이터를 Firebase에 저장)
  const [groups, setGroups] = useState<ElectiveGroup[]>([
    // 예시용 초기 데이터 하나 생성
    { groupId: 'group_1', groupName: '2학년 과학탐구 동시수업', unitIds: [] }
  ]);

  // 어떤 유닛이 이미 그룹에 묶였는지 추적 (서랍장에서 숨기기 위함)
  const usedUnitIds = groups.flatMap(g => g.unitIds);

  // 드래그 오버 허용
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // 그룹 안으로 유닛을 떨어뜨렸을 때 (Drop)
  const handleDropToGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    const unitId = e.dataTransfer.getData('text/plain');
    
    if (!unitId || usedUnitIds.includes(unitId)) return;

    // 해당 그룹에 유닛 ID 추가
    setGroups(prev => prev.map(group => 
      group.groupId === targetGroupId 
        ? { ...group, unitIds: [...group.unitIds, unitId] }
        : group
    ));
  };

  // 그룹에서 유닛 빼기
  const handleRemoveUnit = (groupId: string, unitIdToRemove: string) => {
    setGroups(prev => prev.map(group => 
      group.groupId === groupId
        ? { ...group, unitIds: group.unitIds.filter(id => id !== unitIdToRemove) }
        : group
    ));
  };

  // 새 그룹 추가하기
  const handleAddGroup = () => {
    const newGroup: ElectiveGroup = {
      groupId: `group_${Date.now()}`,
      groupName: '새 동시수업 그룹',
      unitIds: []
    };
    setGroups(prev => [...prev, newGroup]);
  };

  // Firebase 저장 시뮬레이션 버튼 함수
  const handleSaveToDB = () => {
    console.log('Firebase /constraints/electiveGroups 에 저장될 데이터:', groups);
    alert('데이터가 성공적으로 저장되었습니다! (콘솔 확인)');
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      
      {/* 왼쪽: 교사-학급 그리드 (과목명 유닛들) */}
      <section className="flex-[3] flex flex-col overflow-hidden border-r border-slate-800">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800">
          <h2 className="text-lg font-bold text-amber-400">수업 유닛 현황 (교사/학급)</h2>
          <p className="text-xs text-slate-400">과목명을 드래그하여 오른쪽 그룹으로 이동시키세요.</p>
        </div>
        
        <TeacherClassGrid units={initialUnits} usedUnitIds={usedUnitIds} selectedGrade={selectedGrade} />

        {/* 하단 학년 선택 탭 */}
        <div className="flex bg-slate-900 border-t border-slate-800 p-1">
          {[1, 2, 3].map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                selectedGrade === grade 
                  ? 'bg-blue-600 text-white shadow-inner' 
                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              {grade}학년
            </button>
          ))}
        </div>
      </section>

      {/* 오른쪽: 동시수업 그룹화 빌더 */}
      <section className="flex-[2] flex flex-col overflow-hidden bg-slate-950">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
          <div>
            <h2 className="text-xl font-bold text-slate-100">동시수업 그룹 설정</h2>
            <p className="text-xs text-slate-400 mt-1">동일 시간에 진행될 수업들을 묶으세요.</p>
          </div>
          <button 
            onClick={handleSaveToDB}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            저장
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 그룹 리스트 컨테이너 */}
          <div className="grid grid-cols-1 gap-4">
            {groups.map(group => (
              <div 
                key={group.groupId}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToGroup(e, group.groupId)}
                className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-h-[150px] flex flex-col shadow-md transition-colors hover:border-slate-500"
              >
                <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-2">
                  <input 
                    type="text" 
                    value={group.groupName}
                    onChange={(e) => setGroups(prev => prev.map(g => g.groupId === group.groupId ? { ...g, groupName: e.target.value } : g))}
                    className="bg-transparent text-md font-bold text-amber-400 focus:outline-none focus:ring-0 w-full"
                    placeholder="그룹명 입력..."
                  />
                  <button 
                    onClick={() => setGroups(prev => prev.filter(g => g.groupId !== group.groupId))}
                    className="ml-2 text-slate-500 hover:text-red-400 text-xs"
                  >
                    삭제
                  </button>
                </div>
                
                <div className="flex-1 flex flex-wrap gap-2 content-start">
                  {group.unitIds.length === 0 ? (
                    <div className="w-full h-20 flex items-center justify-center text-slate-600 text-xs border-2 border-dashed border-slate-800 rounded-lg italic">
                      여기에 수업 유닛을 드롭하세요
                    </div>
                  ) : (
                    group.unitIds.map(unitId => {
                      const unit = initialUnits.find(u => u.id === unitId);
                      if (!unit) return null;
                      return (
                        <div key={unit.id} className={`${unit.color || 'bg-slate-800'} p-2 rounded border border-white/10 flex items-center gap-2 shadow-sm`}>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight">{unit.subject}</span>
                            <span className="text-[10px] text-white/80 leading-tight">{unit.name} ({unit.grade}-{unit.classNum})</span>
                          </div>
                          <button onClick={() => handleRemoveUnit(group.groupId, unit.id)} className="text-white/50 hover:text-white text-xs">
                            ✕
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}

            {/* 새 그룹 추가 버튼 */}
            <button 
              onClick={handleAddGroup}
              className="border-2 border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 transition-all group"
            >
              <span className="text-2xl mb-1 group-hover:scale-125 transition-transform">+</span>
              <span className="text-sm font-medium">새 동시수업 그룹 추가</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}