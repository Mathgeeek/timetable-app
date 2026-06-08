// app/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { parseScheduleFile } from '@/lib/parseSchedule';
import { ElectiveGroup, PeriodConfig, DEFAULT_PERIOD_CONFIG, SpecialRoom, TeacherUnit } from '@/app/types';
import ElectiveGroupBuilder from '@/app/components/setup/ElectiveGroupBuilder';
import SpecialRoomManager from '@/app/components/setup/SpecialRoomManager';
import PeriodConfigPanel from '@/app/components/setup/PeriodConfigPanel';

const DashboardPage = dynamic(() => import('@/app/components/DashboardPage'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-slate-950 text-slate-400 p-8">대시보드 로딩 중...</div>
});

type MenuState = 'CONFIG_PANEL' | 'START_TIMETABLE' | 'ELECTIVE_GROUP' | 'SPECIAL_ROOM' | 'PERIOD_CONFIG';

export default function RootMainPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuState>('CONFIG_PANEL');
  const [globalUnits, setGlobalUnits] = useState<TeacherUnit[]>([]);
  const [classCount, setClassCount] = useState<{ [grade: number]: number }>({ 1: 12, 2: 12, 3: 12 });
  const [specialRooms, setSpecialRooms] = useState<SpecialRoom[]>([]);
  const [electiveGroups, setElectiveGroups] = useState<ElectiveGroup[]>([]);
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig>(DEFAULT_PERIOD_CONFIG);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const triggerFileBrowser = () => {
    fileInputRef.current?.click();
  };

  // 표준 양식 다운로드
  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/schedule-template.xlsx';
    link.download = '교사별_시수표_표준양식.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await parseScheduleFile(file);

    if (!result.success) {
      alert(`파싱 오류: ${result.error}`);
      return;
    }

    const COLORS = [
      'border-blue-500 text-blue-400 bg-blue-500/10',
      'border-emerald-500 text-emerald-400 bg-emerald-500/10',
      'border-purple-500 text-purple-400 bg-purple-500/10',
      'border-amber-500 text-amber-400 bg-amber-500/10',
      'border-rose-500 text-rose-400 bg-rose-500/10',
      'border-cyan-500 text-cyan-400 bg-cyan-500/10',
      'border-indigo-500 text-indigo-400 bg-indigo-500/10',
      'border-orange-500 text-orange-400 bg-orange-500/10',
    ];
    const teacherColorMap: Record<string, string> = {};
    let colorIndex = 0;
    const units: TeacherUnit[] = [];

    for (const row of result.data) {
      if (!teacherColorMap[row.teacherName]) {
        teacherColorMap[row.teacherName] = COLORS[colorIndex % COLORS.length];
        colorIndex++;
      }
      const color = teacherColorMap[row.teacherName];

      for (const gradeKey of ['grade1', 'grade2', 'grade3'] as const) {
        const gradeNum = gradeKey === 'grade1' ? 1 : gradeKey === 'grade2' ? 2 : 3;
        const gradeHours = row.hours[gradeKey];
        for (const [classNum, hours] of Object.entries(gradeHours)) {
          units.push({
            id: `${row.index}-${gradeNum}-${classNum}`,
            name: row.teacherName,
            subject: row.subjectFull,
            grade: gradeNum,
            classNum: Number(classNum),
            totalHours: hours,
            color,
          });
        }
      }
    }

    setGlobalUnits(units);
    setClassCount(result.meta.classCountByGrade);
    alert(`✅ ${result.meta.totalRows}명의 교사, ${units.length}개 유닛 생성 완료!`);
  };

  if (!isMounted) return <div className="min-h-screen bg-slate-950 text-slate-400 p-8">로딩 중...</div>;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        className="hidden"
      />

      {/* 좌측 사이드바 */}
      <aside className="w-72 border-r border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-6 backdrop-blur-md">
        <div className="mb-2">
          <h1 className="text-lg font-bold tracking-tight bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            시간표 일과 마스터
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">관리자 콘솔 v1.0</p>
        </div>

        <div className="flex flex-col gap-3 flex-1">
          <button
            onClick={() => setActiveMenu('CONFIG_PANEL')}
            className={`w-full p-4 rounded-xl text-left text-sm font-semibold transition-all duration-200 border cursor-pointer ${
              activeMenu === 'CONFIG_PANEL'
                ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            기초시간표 설정 메뉴
          </button>

          <button
            onClick={() => setActiveMenu('START_TIMETABLE')}
            className={`w-full p-4 rounded-xl text-left text-sm font-bold transition-all duration-200 border cursor-pointer flex justify-between items-center ${
              activeMenu === 'START_TIMETABLE'
                ? 'bg-amber-500/10 border-amber-500/60 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <span>✨ 기초시간표 작성 시작</span>
            {globalUnits.length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-xs px-2 py-0.5 rounded-full font-extrabold animate-pulse">
                {globalUnits.length}개 유닛 로드됨
              </span>
            )}
          </button>

          {['일과 변경 관리 (준비중)', '시간표 열람 및 조회', '환경 설정'].map((label, index) => (
            <div key={index} className="w-full p-4 rounded-xl text-left text-sm font-medium bg-slate-900/10 border border-slate-900/40 text-slate-600">
              {label}
            </div>
          ))}
        </div>

        <div className="text-xs text-slate-600 text-center border-t border-slate-950 pt-4">
          행정망 보안 세션 활성화됨
        </div>
      </aside>

      {/* 우측 콘텐츠 */}
      <main className="flex-1 p-8 flex flex-col overflow-hidden relative">

        {/* 1. 기초시간표 설정 메뉴 (대시보드) */}
        {activeMenu === 'CONFIG_PANEL' && (
          <div className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">기초시간표 빌더 패널</h2>
              <p className="text-sm text-slate-400 mt-1">학기 초 시간표 자동 연산 및 기초 데이터 세팅을 위한 핵심 단계입니다.</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* 시수표 양식 다운로드 */}
              <div onClick={downloadTemplate} className="h-48 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-300 hover:bg-slate-900/80 hover:border-slate-700 group">
                <span className="text-2xl mb-2">📥</span>
                <h3 className="text-base font-bold text-slate-200">교사별 시수표 양식 다운로드</h3>
                <p className="text-xs text-slate-500 mt-2">표준 템플릿 파일 획득</p>
              </div>

              {/* 시수표 엑셀 업로드 */}
              <div
                onClick={triggerFileBrowser}
                className={`h-48 border rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-300 group ${
                  globalUnits.length > 0
                    ? 'bg-emerald-950/20 border-emerald-500/40 hover:bg-emerald-950/40'
                    : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/80 hover:border-amber-500/50 shadow-md'
                }`}
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                  {globalUnits.length > 0 ? '✅' : '🚀'}
                </span>
                <h3 className="text-base font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                  {globalUnits.length > 0 ? '시수표 업로드 완료' : '교사별 시수표 업로드'}
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                  {globalUnits.length > 0 ? `${globalUnits.length}개의 데이터 블록 분석 완료` : '엑셀 파일을 찾아 시스템에 유닛화 등록'}
                </p>
              </div>

              {/* 선택 과목 그룹화 버튼 (수정된 부분) */}
              <div 
                onClick={() => {
                  if (globalUnits.length === 0) {
                    alert('먼저 교사별 시수표 엑셀을 업로드해주세요!');
                    return;
                  }
                  setActiveMenu('ELECTIVE_GROUP');
                }}
                className="h-48 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/80 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">⛓️</span>
                <h3 className="text-base font-bold text-slate-300 group-hover:text-blue-400">선택 과목(동시 수업) 그룹화</h3>
                <p className="text-xs text-slate-500 mt-2">동시간대 묶음 수업 설정</p>
              </div>

              {/* 특별실 배정 */}
              <div
                onClick={() => {
                  if (globalUnits.length === 0) {
                    alert('먼저 교사별 시수표 엑셀을 업로드해주세요!');
                    return;
                  }
                  setActiveMenu('SPECIAL_ROOM');
                }}
                className="h-48 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all group"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏫</span>
                <h3 className="text-base font-bold text-slate-300 group-hover:text-emerald-400">교과 특별실 배정</h3>
                <p className="text-xs text-slate-500 mt-2">음악실, 과학실 등 전용 교실 설정</p>
              </div>

              {/* 교시 설정 */}
              <div
                onClick={() => setActiveMenu('PERIOD_CONFIG')}
                className={`h-48 border rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer transition-all group ${
                  Object.values(periodConfig).some(g => Object.values(g).some(v => v < 7))
                    ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/40'
                    : 'bg-slate-900/40 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/80'
                }`}
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🗓️</span>
                <h3 className="text-base font-bold text-slate-300 group-hover:text-amber-400">학년별 교시 운영 설정</h3>
                <p className="text-xs text-slate-500 mt-2">요일·학년별 최대 교시 수 조정</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. 동시수업 그룹화 메뉴 렌더링 (추가된 부분) */}
        {activeMenu === 'ELECTIVE_GROUP' && (
          <div className="w-full h-full flex flex-col">
            <ElectiveGroupBuilder 
              initialUnits={globalUnits} 
              groups={electiveGroups} 
              setGroups={setElectiveGroups} 
            />
          </div>
        )}

        {/* 2-1. 특별실 관리 메뉴 렌더링 */}
        {activeMenu === 'SPECIAL_ROOM' && (
          <div className="w-full h-full flex flex-col">
            <SpecialRoomManager 
              initialUnits={globalUnits} 
              rooms={specialRooms} 
              setRooms={setSpecialRooms} 
            />
          </div>
        )}

        {/* 3. 교시 운영 설정 */}
        {activeMenu === 'PERIOD_CONFIG' && (
          <div className="w-full h-full flex flex-col">
            <PeriodConfigPanel config={periodConfig} onChange={setPeriodConfig} />
          </div>
        )}

        {/* 4. 기초 시간표 작성 시작 렌더링 */}
        {activeMenu === 'START_TIMETABLE' && (
          <div className="w-full h-full flex flex-col">
            <DashboardPage
              units={globalUnits}
              classCount={classCount}
              specialRooms={specialRooms}
              electiveGroups={electiveGroups}
              periodConfig={periodConfig}
            />
          </div>
        )}

      </main>
    </div>
  );
}