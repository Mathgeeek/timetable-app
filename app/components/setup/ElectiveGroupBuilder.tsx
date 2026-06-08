'use client';

import React, { useState, useRef } from 'react';
import { TeacherUnit, ElectiveGroup } from '@/app/types';
import TeacherClassGrid from '@/app/components/setup/TeacherClassGrid';
import { parseElectiveFile, subjectMatches, ParsedElectiveGroup } from '@/lib/parseElectiveFile';

interface Props {
  initialUnits: TeacherUnit[];
  groups: ElectiveGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ElectiveGroup[]>>;
}

// ── 자동 파싱 결과에서 unitId 매칭 ─────────────────────────────────────────
function matchUnitsToGroup(
  parsed: ParsedElectiveGroup,
  units: TeacherUnit[],
  grade: number
): { unitId: string; classNum: number; subject: string; matched: boolean }[] {
  return parsed.classSubjects.map(({ classNum, subject }) => {
    const found = units.find(
      u => u.grade === grade && u.classNum === classNum && subjectMatches(u.subject, subject)
    );
    return { unitId: found?.id ?? '', classNum, subject, matched: !!found };
  });
}

export default function ElectiveGroupBuilder({ initialUnits, groups, setGroups }: Props) {
  const [selectedGrade, setSelectedGrade] = useState(3);
  const [autoGrade, setAutoGrade] = useState(3);

  // 파일 업로드 상태
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedGroups, setParsedGroups] = useState<ParsedElectiveGroup[] | null>(null);
  const [selectedParsed, setSelectedParsed] = useState<Set<string>>(new Set());

  const usedUnitIds = groups.flatMap(g => g.unitIds);

  // ── 드래그 앤 드롭 (수동 그룹) ──────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDropToGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    const unitId = e.dataTransfer.getData('text/plain');
    if (!unitId || usedUnitIds.includes(unitId)) return;
    setGroups(prev => prev.map(g =>
      g.groupId === targetGroupId ? { ...g, unitIds: [...g.unitIds, unitId] } : g
    ));
  };

  const handleRemoveUnit = (groupId: string, unitIdToRemove: string) => {
    setGroups(prev => prev.map(g =>
      g.groupId === groupId ? { ...g, unitIds: g.unitIds.filter(id => id !== unitIdToRemove) } : g
    ));
  };

  const handleAddGroup = () => {
    setGroups(prev => [...prev, {
      groupId: `group_${Date.now()}`,
      groupName: '새 동시수업 그룹',
      unitIds: [],
    }]);
  };

  // ── 파일 업로드 → 자동 파싱 ──────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setParseError(null);
    setParsedGroups(null);
    setSelectedParsed(new Set());
    try {
      const result = await parseElectiveFile(file);
      setParsedGroups(result);
      // 전체 선택
      setSelectedParsed(new Set(result.map(g => g.groupName)));
    } catch (err) {
      setParseError(String(err));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── 선택된 자동 파싱 그룹을 ElectiveGroup으로 적용 ─────────────────────
  const handleApplyParsed = () => {
    if (!parsedGroups) return;

    const toApply = parsedGroups.filter(pg => selectedParsed.has(pg.groupName));
    const newGroups: ElectiveGroup[] = [];

    for (const pg of toApply) {
      const matchResults = matchUnitsToGroup(pg, initialUnits, autoGrade);
      const matchedIds = matchResults.filter(r => r.matched).map(r => r.unitId);

      if (matchedIds.length === 0) continue;

      // 이미 같은 이름 그룹이 있으면 덮어쓰기
      const existing = groups.find(g => g.groupName === `3학년 ${pg.groupName}`);
      if (existing) {
        setGroups(prev => prev.map(g =>
          g.groupId === existing.groupId
            ? { ...g, unitIds: [...new Set([...g.unitIds, ...matchedIds])] }
            : g
        ));
      } else {
        newGroups.push({
          groupId: `group_auto_${pg.groupName}_${Date.now()}`,
          groupName: `3학년 ${pg.groupName}`,
          unitIds: matchedIds,
        });
      }
    }

    if (newGroups.length > 0) {
      setGroups(prev => [...prev, ...newGroups]);
    }

    const applied = toApply.length;
    const noMatch = toApply.filter(pg =>
      matchUnitsToGroup(pg, initialUnits, autoGrade).every(r => !r.matched)
    ).length;

    alert(
      `✅ ${applied - noMatch}개 그룹이 적용되었습니다.` +
      (noMatch > 0 ? `\n⚠️ ${noMatch}개 그룹은 매칭되는 유닛이 없어 건너뛰었습니다.\n(시수표 과목명과 편성안 과목명을 확인해 주세요)` : '')
    );
    setParsedGroups(null);
  };

  const toggleSelectParsed = (name: string) => {
    setSelectedParsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">

      {/* ── 왼쪽: 유닛 그리드 ─────────────────────────────────────────────── */}
      <section className="flex-3 flex flex-col overflow-hidden border-r border-slate-800">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800">
          <h2 className="text-lg font-bold text-amber-400">수업 유닛 현황 (교사/학급)</h2>
          <p className="text-xs text-slate-400">과목명을 드래그하여 오른쪽 그룹으로 이동시키세요.</p>
        </div>
        <TeacherClassGrid units={initialUnits} usedUnitIds={usedUnitIds} selectedGrade={selectedGrade} />
        <div className="flex bg-slate-900 border-t border-slate-800 p-1">
          {[1, 2, 3].map(grade => (
            <button key={grade} onClick={() => setSelectedGrade(grade)}
              className={`flex-1 py-3 text-sm font-bold transition-all ${
                selectedGrade === grade ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              {grade}학년
            </button>
          ))}
        </div>
      </section>

      {/* ── 오른쪽: 그룹 설정 ──────────────────────────────────────────────── */}
      <section className="flex-2 flex flex-col overflow-hidden bg-slate-950">
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/30">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100">동시수업 그룹 설정</h2>
              <p className="text-xs text-slate-400 mt-1">동일 시간에 진행될 수업들을 묶으세요.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* 수동 그룹 추가 */}
              <button onClick={handleAddGroup}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-all">
                ＋ 수동 추가
              </button>
              {/* 파일 업로드 버튼 */}
              <input ref={fileInputRef} type="file" accept=".cell,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              >
                <span>{isLoading ? '⏳' : '📂'}</span>
                <span>{isLoading ? '파싱 중...' : '편성안 파일로 자동 불러오기'}</span>
              </button>
            </div>
          </div>

          {/* 파싱 에러 */}
          {parseError && (
            <div className="mt-3 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300">
              ❌ {parseError}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── 자동 파싱 결과 패널 ──────────────────────────────────────────── */}
          {parsedGroups && (
            <div className="bg-emerald-950/20 border border-emerald-700/40 rounded-2xl overflow-hidden">
              {/* 패널 헤더 */}
              <div className="p-4 border-b border-emerald-800/30 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-emerald-400">
                    📋 {parsedGroups.length}개 그룹 감지됨
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">적용할 그룹을 선택하고 아래 버튼을 누르세요.</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 학년 선택 */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>대상 학년:</span>
                    {[1, 2, 3].map(g => (
                      <button key={g} onClick={() => setAutoGrade(g)}
                        className={`px-2 py-1 rounded font-bold transition-all ${
                          autoGrade === g ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}>
                        {g}학년
                      </button>
                    ))}
                  </div>
                  {/* 전체 선택 */}
                  <button
                    onClick={() => {
                      if (selectedParsed.size === parsedGroups.length) setSelectedParsed(new Set());
                      else setSelectedParsed(new Set(parsedGroups.map(g => g.groupName)));
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 bg-slate-800 rounded transition-all"
                  >
                    {selectedParsed.size === parsedGroups.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <button onClick={() => setParsedGroups(null)}
                    className="text-xs text-slate-600 hover:text-slate-300 px-2 py-1 bg-slate-800 rounded transition-all">
                    닫기
                  </button>
                </div>
              </div>

              {/* 그룹 카드 목록 */}
              <div className="p-4 grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {parsedGroups.map(pg => {
                  const matchResults = matchUnitsToGroup(pg, initialUnits, autoGrade);
                  const matchedCount = matchResults.filter(r => r.matched).length;
                  const totalCount = matchResults.length;
                  const isSelected = selectedParsed.has(pg.groupName);
                  const hasMatch = matchedCount > 0;

                  return (
                    <div
                      key={pg.groupName}
                      onClick={() => toggleSelectParsed(pg.groupName)}
                      className={`rounded-xl border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-900/30 border-emerald-600/50'
                          : 'bg-slate-900/60 border-slate-700/50 opacity-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] transition-all ${
                            isSelected ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                          <span className="text-sm font-bold text-amber-400">{pg.groupName}</span>
                          <span className="text-xs text-slate-400">{pg.description}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          matchedCount === totalCount
                            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/50'
                            : matchedCount > 0
                              ? 'bg-amber-900/50 text-amber-400 border border-amber-700/50'
                              : 'bg-red-900/50 text-red-400 border border-red-700/50'
                        }`}>
                          {hasMatch ? `${matchedCount}/${totalCount} 매칭` : '⚠️ 미매칭'}
                        </span>
                      </div>

                      {/* 반별 과목 칩 */}
                      <div className="flex flex-wrap gap-1">
                        {matchResults.map(r => (
                          <span key={r.classNum}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                              r.matched
                                ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/50'
                                : 'bg-red-900/20 text-red-400 border-red-800/40'
                            }`}>
                            {r.classNum}반: {r.subject}
                            {r.matched ? ' ✓' : ' ?'}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 적용 버튼 */}
              <div className="p-4 border-t border-emerald-800/30 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  {selectedParsed.size}개 선택됨
                </span>
                <button
                  onClick={handleApplyParsed}
                  disabled={selectedParsed.size === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all"
                >
                  ✅ 선택 그룹 적용
                </button>
              </div>
            </div>
          )}

          {/* ── 기존 그룹 리스트 ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4">
            {groups.map(group => (
              <div
                key={group.groupId}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToGroup(e, group.groupId)}
                className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-h-[7rem] flex flex-col shadow-md hover:border-slate-500 transition-colors"
              >
                <div className="flex justify-between items-start mb-3 border-b border-slate-800 pb-2">
                  <input
                    type="text"
                    value={group.groupName}
                    onChange={(e) => setGroups(prev => prev.map(g =>
                      g.groupId === group.groupId ? { ...g, groupName: e.target.value } : g
                    ))}
                    className="bg-transparent text-md font-bold text-amber-400 focus:outline-none w-full"
                    placeholder="그룹명 입력..."
                  />
                  <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded mr-2 shrink-0">
                    {group.unitIds.length}개 유닛
                  </span>
                  <button
                    onClick={() => setGroups(prev => prev.filter(g => g.groupId !== group.groupId))}
                    className="text-slate-500 hover:text-red-400 text-xs shrink-0"
                  >
                    삭제
                  </button>
                </div>

                <div className="flex-1 flex flex-wrap gap-2 content-start">
                  {group.unitIds.length === 0 ? (
                    <div className="w-full h-16 flex items-center justify-center text-slate-600 text-xs border-2 border-dashed border-slate-800 rounded-lg italic">
                      여기에 수업 유닛을 드롭하세요
                    </div>
                  ) : (
                    group.unitIds.map(unitId => {
                      const unit = initialUnits.find(u => u.id === unitId);
                      if (!unit) return null;
                      return (
                        <div key={unit.id} className={`${unit.color} p-2 rounded border border-white/10 flex items-center gap-2 shadow-sm`}>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white leading-tight">{unit.subject}</span>
                            <span className="text-[10px] text-white/80 leading-tight">{unit.name} ({unit.grade}-{unit.classNum})</span>
                          </div>
                          <button onClick={() => handleRemoveUnit(group.groupId, unit.id)} className="text-white/50 hover:text-white text-xs">✕</button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}

            {/* 수동 그룹 추가 버튼 */}
            <button
              onClick={handleAddGroup}
              className="border-2 border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/50 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 transition-all group"
            >
              <span className="text-2xl mb-1 group-hover:scale-125 transition-transform">+</span>
              <span className="text-sm font-medium">새 동시수업 그룹 수동 추가</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
