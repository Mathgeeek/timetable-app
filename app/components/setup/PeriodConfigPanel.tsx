'use client';

import React from 'react';
import { PeriodConfig } from '@/app/types';

const DAYS = ['월', '화', '수', '목', '금'];
const GRADES = [1, 2, 3];

interface Props {
  config: PeriodConfig;
  onChange: (config: PeriodConfig) => void;
}

export default function PeriodConfigPanel({ config, onChange }: Props) {
  function update(grade: number, day: string, value: number) {
    onChange({
      ...config,
      [grade]: { ...config[grade], [day]: value },
    });
  }

  function setAllSameDay(day: string, value: number) {
    const next = { ...config };
    for (const g of GRADES) next[g] = { ...next[g], [day]: value };
    onChange(next);
  }

  function setAllSameGrade(grade: number, value: number) {
    const next = { ...config };
    next[grade] = Object.fromEntries(DAYS.map(d => [d, value]));
    onChange(next);
  }

  function setAll(value: number) {
    const next: PeriodConfig = {};
    for (const g of GRADES) next[g] = Object.fromEntries(DAYS.map(d => [d, value]));
    onChange(next);
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 overflow-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">학년별 요일별 교시 설정</h2>
        <p className="text-sm text-slate-400 mt-1">
          각 학년·요일마다 운영할 최대 교시 수를 설정합니다. 초과 교시에는 수업이 배정되지 않습니다.
        </p>
      </div>

      {/* 빠른 전체 설정 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold">전체 일괄 설정:</span>
        {[5, 6, 7].map(n => (
          <button
            key={n}
            onClick={() => setAll(n)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
          >
            전체 {n}교시
          </button>
        ))}
      </div>

      {/* 설정 테이블 */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left p-4 text-slate-500 font-normal w-28">학년 \ 요일</th>
              {DAYS.map(day => (
                <th key={day} className="p-4 text-center text-slate-300 font-semibold">
                  <div className="flex flex-col items-center gap-1.5">
                    <span>{day}요일</span>
                    {/* 요일 전체 일괄 */}
                    <div className="flex gap-1">
                      {[5, 6, 7].map(n => (
                        <button
                          key={n}
                          onClick={() => setAllSameDay(day, n)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-all"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADES.map((grade, gi) => (
              <tr key={grade} className={gi < GRADES.length - 1 ? 'border-b border-slate-800/60' : ''}>
                <td className="p-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-slate-200">{grade}학년</span>
                    {/* 학년 전체 일괄 */}
                    <div className="flex gap-1">
                      {[5, 6, 7].map(n => (
                        <button
                          key={n}
                          onClick={() => setAllSameGrade(grade, n)}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-all"
                        >
                          {n}교시
                        </button>
                      ))}
                    </div>
                  </div>
                </td>
                {DAYS.map(day => {
                  const val = config[grade]?.[day] ?? 7;
                  return (
                    <td key={day} className="p-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {/* 교시 수 표시 */}
                        <div className={`text-lg font-extrabold ${val < 7 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {val}교시
                        </div>

                        {/* 슬라이더 */}
                        <input
                          type="range"
                          min={1}
                          max={7}
                          value={val}
                          onChange={e => update(grade, day, Number(e.target.value))}
                          className="w-24 accent-amber-400 cursor-pointer"
                        />

                        {/* 교시 블록 시각화 */}
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5, 6, 7].map(p => (
                            <button
                              key={p}
                              onClick={() => update(grade, day, p)}
                              className={`w-5 h-5 rounded text-[9px] font-bold transition-all border ${
                                p <= val
                                  ? 'bg-amber-500/80 border-amber-400 text-slate-900'
                                  : 'bg-slate-800 border-slate-700 text-slate-600'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 현재 설정 요약 */}
      <div className="flex gap-3 flex-wrap">
        {GRADES.map(grade => {
          const vals = DAYS.map(d => config[grade]?.[d] ?? 7);
          const allSame = vals.every(v => v === vals[0]);
          return (
            <div key={grade} className="bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3 text-xs">
              <span className="font-bold text-slate-300">{grade}학년</span>
              <span className="text-slate-500 ml-2">
                {allSame ? `전 요일 ${vals[0]}교시` : DAYS.map((d, i) => `${d}:${vals[i]}`).join(' ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
