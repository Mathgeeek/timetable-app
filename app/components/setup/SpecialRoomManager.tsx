'use client';

import React, { useState } from 'react';
import { TeacherUnit, SpecialRoom } from '@/app/types';
import TeacherClassGrid from '@/app/components/setup/TeacherClassGrid';

interface SpecialRoomManagerProps {
  initialUnits: TeacherUnit[];
  rooms: SpecialRoom[];
  setRooms: React.Dispatch<React.SetStateAction<SpecialRoom[]>>;
}

// 기본 특별실 정의
const DEFAULT_ROOMS: { name: string; capacity: number; subjectKeywords: string[] }[] = [
  { name: '음악실', capacity: 1, subjectKeywords: ['음악', '음감', '음창'] },
  { name: '미술실', capacity: 1, subjectKeywords: ['미술', '미감', '미창'] },
  { name: '체육관/운동장', capacity: 4, subjectKeywords: ['체육', '운동', '운건'] },
  { name: '컴퓨터실', capacity: 2, subjectKeywords: ['정보', '컴퓨터', '공학', '인공지능'] },
  { name: '과학탐구실', capacity: 2, subjectKeywords: ['과탐', '과학실', '물리실', '화학실', '생명실'] },
  { name: '정보탐색실', capacity: 2, subjectKeywords: ['정보탐색', '인지'] },
];

function autoMatchUnitsToRoom(units: TeacherUnit[], keywords: string[]): string[] {
  return units
    .filter(u => keywords.some(kw =>
      u.subject.toLowerCase().includes(kw.toLowerCase())
    ))
    .map(u => u.id);
}

export default function SpecialRoomManager({ initialUnits, rooms, setRooms }: SpecialRoomManagerProps) {
  const [selectedGrade, setSelectedGrade] = useState(1);

  const usedUnitIds = rooms.flatMap(r => r.unitIds);

  // 기본 특별실 일괄 등록
  const handleAddDefaultRooms = () => {
    const newRooms: SpecialRoom[] = DEFAULT_ROOMS
      .filter(def => !rooms.some(r => r.name.includes(def.name.split('/')[0])))
      .map(def => ({
        id: `room_default_${def.name}_${Date.now()}`,
        name: def.name,
        capacity: def.capacity,
        unitIds: autoMatchUnitsToRoom(initialUnits, def.subjectKeywords),
      }));

    if (newRooms.length === 0) {
      alert('이미 모든 기본 특별실이 등록되어 있습니다.');
      return;
    }

    setRooms(prev => [...prev, ...newRooms]);
    const autoMatched = newRooms.filter(r => r.unitIds.length > 0);
    alert(
      `✅ ${newRooms.length}개 기본 특별실이 추가되었습니다.\n` +
      `📌 자동 매칭된 특별실: ${autoMatched.length}개\n\n` +
      newRooms.map(r => `• ${r.name} (수용 ${r.capacity}반) — ${r.unitIds.length}개 유닛 자동 연결`).join('\n') +
      '\n\n수용 인원은 실제 학교 상황에 맞게 수정해 주세요.'
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropToRoom = (e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    const unitId = e.dataTransfer.getData('text/plain');
    
    if (!unitId || usedUnitIds.includes(unitId)) return;

    setRooms(prev => prev.map(room => 
      room.id === roomId 
        ? { ...room, unitIds: [...room.unitIds, unitId] }
        : room
    ));
  };

  const handleRemoveUnit = (roomId: string, unitIdToRemove: string) => {
    setRooms(prev => prev.map(room => 
      room.id === roomId
        ? { ...room, unitIds: room.unitIds.filter(id => id !== unitIdToRemove) }
        : room
    ));
  };

  const handleAddRoom = () => {
    const newRoom: SpecialRoom = {
      id: `room_${Date.now()}`,
      name: '새 특별실',
      capacity: 1,
      unitIds: []
    };
    setRooms(prev => [...prev, newRoom]);
  };

  const handleSaveToDB = () => {
    alert('특별실 데이터가 성공적으로 저장되었습니다!');
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      
      {/* 왼쪽: 수업 유닛 그리드 */}
      <section className="flex-3 flex flex-col overflow-hidden border-r border-slate-800">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800">
          <h2 className="text-lg font-bold text-emerald-400">특별실 사용 수업 선택</h2>
          <p className="text-xs text-slate-400 font-light">특별실이 필요한 수업 유닛을 오른쪽으로 드래그하세요.</p>
        </div>
        
        <TeacherClassGrid units={initialUnits} usedUnitIds={usedUnitIds} selectedGrade={selectedGrade} />

        <div className="flex bg-slate-900 border-t border-slate-800 p-1">
          {[1, 2, 3].map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                selectedGrade === grade 
                  ? 'bg-emerald-600 text-white shadow-inner' 
                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              {grade}학년
            </button>
          ))}
        </div>
      </section>

      {/* 오른쪽: 특별실 관리 */}
      <section className="flex-2 flex flex-col overflow-hidden bg-slate-950">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
          <div>
            <h2 className="text-xl font-bold text-slate-100">특별실 설정</h2>
            <p className="text-xs text-slate-400 mt-1 font-light italic">동시 사용 가능한 학급 수(수용량)를 설정하세요.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddDefaultRooms}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              title="음악실·미술실·체육관·컴퓨터실 등 기본 특별실을 한 번에 추가합니다"
            >
              🏫 기본 특별실 자동 등록
            </button>
            <button
              onClick={handleSaveToDB}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
            >
              저장
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {rooms.map(room => (
              <div 
                key={room.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToRoom(e, room.id)}
                className="bg-slate-900 border border-slate-700 rounded-xl p-5 min-h-40 flex flex-col shadow-md transition-all hover:border-emerald-500/50"
              >
                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                  <div className="flex-1 flex items-center gap-3">
                    <input 
                      type="text" 
                      value={room.name}
                      onChange={(e) => setRooms(prev => prev.map(r => r.id === room.id ? { ...r, name: e.target.value } : r))}
                      className="bg-transparent text-lg font-bold text-emerald-400 focus:outline-none w-1/2"
                      placeholder="특별실명..."
                    />
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Capacity</span>
                      <input 
                        type="number" 
                        min="1"
                        value={room.capacity}
                        onChange={(e) => setRooms(prev => prev.map(r => r.id === room.id ? { ...r, capacity: parseInt(e.target.value) || 1 } : r))}
                        className="bg-transparent text-sm font-bold text-white w-8 text-center focus:outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => setRooms(prev => prev.filter(r => r.id !== room.id))}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex-1 flex flex-wrap gap-2 content-start">
                  {room.unitIds.length === 0 ? (
                    <div className="w-full h-24 flex flex-col items-center justify-center text-slate-600 text-xs border-2 border-dashed border-slate-800 rounded-xl italic gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      여기에 수업 유닛을 드롭하세요
                    </div>
                  ) : (
                    room.unitIds.map(unitId => {
                      const unit = initialUnits.find(u => u.id === unitId);
                      if (!unit) return null;
                      return (
                        <div key={unit.id} className={`${unit.color || 'bg-slate-800'} px-3 py-2 rounded-lg border border-white/10 flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-200`}>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight">{unit.subject}</span>
                            <span className="text-[10px] text-white/80 leading-tight">{unit.name} ({unit.grade}-{unit.classNum})</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveUnit(room.id, unit.id)} 
                            className="text-white/40 hover:text-white transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}

            <button 
              onClick={handleAddRoom}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-xl p-8 flex flex-col items-center justify-center text-slate-500 hover:text-emerald-400 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-emerald-900/30 group-hover:scale-110 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-bold">새 특별실 추가</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}