'use client';

import React from 'react';
import { PeriodConfig, PeriodTime } from '@/app/types';
import PeriodConfigPanel from './PeriodConfigPanel';

const PERIODS = [1, 2, 3, 4, 5, 6, 7];
const GRADES = [1, 2, 3] as const;

interface Props {
  schoolName: string;
  onSchoolNameChange: (v: string) => void;
  classCount: { [grade: number]: number };
  onClassCountChange: (v: { [grade: number]: number }) => void;
  periodConfig: PeriodConfig;
  onPeriodConfigChange: (v: PeriodConfig) => void;
  periodTimes: PeriodTime[];
  onPeriodTimesChange: (v: PeriodTime[]) => void;
  useSeparateTimeByGrade: boolean;
  onUseSeparateTimeByGradeChange: (v: boolean) => void;
  periodTimesByGrade: { [grade: number]: PeriodTime[] };
  onPeriodTimesByGradeChange: (v: { [grade: number]: PeriodTime[] }) => void;
}

export default function SchoolInfoPanel({
  schoolName, onSchoolNameChange,
  classCount, onClassCountChange,
  periodConfig, onPeriodConfigChange,
  periodTimes, onPeriodTimesChange,
  useSeparateTimeByGrade, onUseSeparateTimeByGradeChange,
  periodTimesByGrade, onPeriodTimesByGradeChange,
}: Props) {

  const handleSeparateToggle = (checked: boolean) => {
    if (checked) {
      // 통합 시간을 각 학년에 복사
      onPeriodTimesByGradeChange({
        1: periodTimes.map(t => ({ ...t })),
        2: periodTimes.map(t => ({ ...t })),
        3: periodTimes.map(t => ({ ...t })),
      });
    }
    onUseSeparateTimeByGradeChange(checked);
  };

  const updateUnifiedTime = (periodIdx: number, field: 'start' | 'end', value: string) => {
    const next = periodTimes.map((t, i) => i === periodIdx ? { ...t, [field]: value } : t);
    onPeriodTimesChange(next);
  };

  const updateGradeTime = (grade: number, periodIdx: number, field: 'start' | 'end', value: string) => {
    const gradeArr = (periodTimesByGrade[grade] ?? periodTimes).map((t, i) =>
      i === periodIdx ? { ...t, [field]: value } : t
    );
    onPeriodTimesByGradeChange({ ...periodTimesByGrade, [grade]: gradeArr });
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto flex flex-col gap-8 py-2 pb-12">

        {/* 헤더 */}
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">학교 기본 정보 입력</h2>
          <p className="text-sm text-slate-400 mt-1">학교명, 학급 수, 교시 운영 시간을 설정합니다.</p>
        </div>

        {/* ── 학교명 ─────────────────────────────────────────────────────── */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-300 mb-4">학교명</h3>
          <input
            type="text"
            value={schoolName}
            onChange={e => onSchoolNameChange(e.target.value)}
            placeholder="예) OO고등학교"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all text-base"
          />
        </section>

        {/* ── 학급 수 ────────────────────────────────────────────────────── */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-300 mb-4">학년별 학급 수</h3>
          <div className="flex gap-4">
            {GRADES.map(grade => (
              <div key={grade} className="flex-1 bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col items-center gap-3">
                <span className="text-sm font-semibold text-slate-300">{grade}학년</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onClassCountChange({ ...classCount, [grade]: Math.max(1, (classCount[grade] ?? 1) - 1) })}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-lg flex items-center justify-center transition-all"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={classCount[grade] ?? 12}
                    onChange={e => onClassCountChange({ ...classCount, [grade]: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-14 text-center bg-slate-900 border border-slate-600 rounded-lg py-1.5 text-lg font-bold text-amber-400 focus:outline-none focus:border-amber-500/60 transition-all"
                  />
                  <button
                    onClick={() => onClassCountChange({ ...classCount, [grade]: Math.min(20, (classCount[grade] ?? 12) + 1) })}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-lg flex items-center justify-center transition-all"
                  >+</button>
                </div>
                <span className="text-xs text-slate-500">{classCount[grade] ?? 12}학급</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 교시 운영 시간 ──────────────────────────────────────────────── */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-300">교시별 운영 시간</h3>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useSeparateTimeByGrade}
                onChange={e => handleSeparateToggle(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                학년별로 운영시간이 달라요
              </span>
            </label>
          </div>

          {!useSeparateTimeByGrade ? (
            /* ── 통합 시간표 ── */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 px-3 text-slate-500 font-normal w-16">교시</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-semibold">시작 시간</th>
                    <th className="text-center py-2 px-1 text-slate-600 font-normal w-6">~</th>
                    <th className="text-center py-2 px-3 text-slate-400 font-semibold">종료 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, idx) => (
                    <tr key={p} className={idx < PERIODS.length - 1 ? 'border-b border-slate-800/40' : ''}>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-300">{p}교시</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="time"
                          value={periodTimes[idx]?.start ?? ''}
                          onChange={e => updateUnifiedTime(idx, 'start', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/60 transition-all text-center"
                        />
                      </td>
                      <td className="py-2.5 px-1 text-center text-slate-600">~</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="time"
                          value={periodTimes[idx]?.end ?? ''}
                          onChange={e => updateUnifiedTime(idx, 'end', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/60 transition-all text-center"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── 학년별 시간표 ── */
            <div className="flex flex-col gap-5">
              {GRADES.map(grade => {
                const times = periodTimesByGrade[grade] ?? periodTimes;
                return (
                  <div key={grade} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                    <div className="text-xs font-bold text-amber-400 mb-3">{grade}학년</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700/60">
                            <th className="text-left py-1.5 px-2 text-slate-500 font-normal w-14">교시</th>
                            <th className="text-center py-1.5 px-2 text-slate-400 font-medium">시작</th>
                            <th className="py-1.5 px-1 w-4"></th>
                            <th className="text-center py-1.5 px-2 text-slate-400 font-medium">종료</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PERIODS.map((p, idx) => (
                            <tr key={p} className={idx < PERIODS.length - 1 ? 'border-b border-slate-700/30' : ''}>
                              <td className="py-2 px-2">
                                <span className="font-bold text-slate-400 text-xs">{p}교시</span>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="time"
                                  value={times[idx]?.start ?? ''}
                                  onChange={e => updateGradeTime(grade, idx, 'start', e.target.value)}
                                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-500/60 transition-all text-center"
                                />
                              </td>
                              <td className="py-2 px-1 text-center text-slate-600 text-xs">~</td>
                              <td className="py-2 px-2">
                                <input
                                  type="time"
                                  value={times[idx]?.end ?? ''}
                                  onChange={e => updateGradeTime(grade, idx, 'end', e.target.value)}
                                  className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-500/60 transition-all text-center"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 학년별 교시 운영 설정 (기존 PeriodConfigPanel) ─────────────── */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-300 mb-4">학년별 교시 운영 설정</h3>
          <PeriodConfigPanel config={periodConfig} onChange={onPeriodConfigChange} />
        </section>

      </div>
    </div>
  );
}
