// app/components/setup/ElectiveGroupBuilder.tsx
'use client';

import React, { useState } from 'react';
import { TeacherUnit, ElectiveGroup } from '@/app/types';
import UnitSidebar from '@/app/components/common/UnitSidebar';

interface ElectiveGroupBuilderProps {
  // 상위 페이지에서 엑셀 파싱된 전체 유닛을 넘겨받는다고 가정합니다
  initialUnits: TeacherUnit[];
}

export default function ElectiveGroupBuilder({ initialUnits }: ElectiveGroupBuilderProps) {
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
      
      {/* 왼쪽: 재사용 가능한 시수 블록 서랍장 */}
      <UnitSidebar units={initialUnits} usedUnitIds={usedUnitIds} />

      {/* 오른쪽: 그룹화 빌더 메인 화면 */}
      <main className="flex-1 p-8 flex flex-col overflow-y-auto">
        <div className="mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">선택 과목 (동시 수업) 그룹화</h2>
            <p className="text-sm text-slate-400 mt-1">좌측 서랍장에서 수업을 드래그하여 무조건 같은 시간에 묶여야 할 수업들을 그룹핑하세요.</p>
          </div>
          <button 
            onClick={handleSaveToDB}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            설정 저장하기
          </button>
        </div>

        {/* 그룹 리스트 컨테이너 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => (
            <div 
              key={group.groupId}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToGroup(e, group.groupId)}
              className="bg-slate-900 border border-slate-700 rounded-xl p-5 min-h-75 flex flex-col shadow-md transition-colors hover:border-slate-500"
            >
              <input 
                type="text" 
                value={group.groupName}
                onChange={(e) => setGroups(prev => prev.map(g => g.groupId === group.groupId ? { ...g, groupName: e.target.value } : g))}
                className="bg-transparent text-lg font-bold text-amber-400 border-b border-slate-700 pb-1 mb-4 focus:outline-none focus:border-amber-400"
              />
              
              <div className="flex-1 flex flex-col gap-2">
                {group.unitIds.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-lg">
                    이곳에 수업 블록을 드롭하세요
                  </div>
                ) : (
                  group.unitIds.map(unitId => {
                    const unit = initialUnits.find(u => u.id === unitId);
                    if (!unit) return null;
                    return (
                      <div key={unit.id} className="bg-slate-800 p-3 rounded-lg flex justify-between items-center border border-slate-700">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{unit.subject} ({unit.name})</p>
                          <p className="text-xs text-slate-400">{unit.grade}학년 {unit.classNum}반</p>
                        </div>
                        <button onClick={() => handleRemoveUnit(group.groupId, unit.id)} className="text-slate-500 hover:text-red-400 text-sm">
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
            className="border-2 border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 rounded-xl min-h-75 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 transition-all"
          >
            <span className="text-3xl mb-2">+</span>
            <span>새 동시수업 그룹 추가</span>
          </button>
        </div>
      </main>
    </div>
  );
}