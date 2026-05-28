'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// 💡 전역에서 공통으로 사용할 유닛 타입 정의
interface TeacherUnit {
  id: string;
  name: string;
  subject: string;
  grade: number;
  classNum: number;
  totalHours: number;
  color: string;
}

const DashboardPage = dynamic(() => import('@/app/components/DashboardPage'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-slate-950 text-slate-400 p-8">대시보드 로딩 중...</div>
});

// 메뉴 네비게이션 상태 타입
type MenuState = 'CONFIG_PANEL' | 'START_TIMETABLE';

export default function RootMainPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuState>('CONFIG_PANEL');
  
  // 💡 [핵심] 업로드된 엑셀 유닛 데이터가 저장될 '어딘가' (부모 상태)
  const [globalUnits, setGlobalUnits] = useState<TeacherUnit[]>([]);
  
  // 파일 탐색기를 프론트엔드 버튼과 연결하기 위한 훅
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 카드 클릭 시 파일 탐색기를 강제로 여는 함수
  const triggerFileBrowser = () => {
    fileInputRef.current?.click();
  };

  // 💡 사용자가 파일을 선택했을 때 실행되는 함수 (추후 팀원 B의 xlsx 파싱 로직이 여기 합쳐집니다!)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // [임시 알림] 파일명이 정상적으로 찍히는지 확인
    alert(`[파일 감지] ${file.name} 시수표를 분석합니다.`);

    // ──────────────────────────────────────────────────────────
    // ✨ [WEEKEND STEP] 일요일에 팀원 B가 짠 xlsx 코드가 들어올 자리
    // ──────────────────────────────────────────────────────────
    // 지금은 연동 테스트를 위해 올려주신 시수표 기반의 데이터 블록 4개가 파싱되었다고 가정합니다.
    const mockParsedFromExcel: TeacherUnit[] = [
      { id: 'excel-1', name: '배부신', subject: '국어', grade: 1, classNum: 1, totalHours: 3, color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
      { id: 'excel-2', name: '배부신', subject: '국어', grade: 1, classNum: 2, totalHours: 3, color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
      { id: 'excel-3', name: '홍예원', subject: '공통수학 I', grade: 1, classNum: 1, totalHours: 4, color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
      { id: 'excel-4', name: '홍예원', subject: '공통수학 I', grade: 1, classNum: 2, totalHours: 4, color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
      { id: 'excel-5', name: '박범석', subject: '공통수학 I', grade: 1, classNum: 5, totalHours: 4, color: 'border-purple-500 text-purple-400 bg-purple-500/10' },
    ];

    setGlobalUnits(mockParsedFromExcel);
    alert(`성공적으로 교사 시수 블록들이 생성되어 시스템에 저장되었습니다!\n왼쪽 사이드바의 [기초시간표 작성 시작] 메뉴가 활성화됩니다.`);
  };

  if (!isMounted) return <div className="min-h-screen bg-slate-950 text-slate-400 p-8">로딩 중...</div>;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      
      {/* 💡 숨겨진 실제 파일 브라우저 인풋 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />

      {/* ================= 1. 좌측 메인 내비게이션 사이드바 ================= */}
      <aside className="w-72 border-r border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-6 backdrop-blur-md">
        <div className="mb-2">
          <h1 className="text-lg font-bold tracking-tight bg-linear-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            시간표 일과 마스터
          </h1>
          <p className="text-xxs text-slate-500 mt-0.5">Tauri 관리자 콘솔 v1.0</p>
        </div>

        {/* 메인 메뉴 버튼 그룹 */}
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

          {/* 💡 [원하셨던 핵심 기능] 엑셀이 업로드되면 이 버튼을 눌러 대시보드로 진입합니다 */}
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
              <span className="bg-amber-500 text-slate-950 text-xxs px-2 py-0.5 rounded-full font-extrabold animate-pulse">
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

        <div className="text-xxs text-slate-600 text-center border-t border-slate-950 pt-4">
          행정망 보안 세션 활성화됨
        </div>
      </aside>

      {/* ================= 2. 우측 메인 콘텐츠 영역 ================= */}
      <main className="flex-1 p-8 flex flex-col overflow-hidden relative">
        
        {/* [화면 1] 4대 카드 판넬 메뉴 */}
        {activeMenu === 'CONFIG_PANEL' && (
          <div className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto animate-fadeIn">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">기초시간표 빌더 패널</h2>
              <p className="text-sm text-slate-400 mt-1">학기 초 시간표 자동 연산 및 기초 데이터 세팅을 위한 핵심 단계입니다.</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div onClick={() => alert('양식을 다운로드합니다.')} className="h-48 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-300 hover:bg-slate-900/80 hover:border-slate-700 group">
                <span className="text-2xl mb-2">📥</span>
                <h3 className="text-base font-bold text-slate-200">교사별 시수표 양식 다운로드</h3>
                <p className="text-xs text-slate-500 mt-2">표준 템플릿 파일 획득</p>
              </div>

              {/* 💡 [수정] 클릭 시 파일 탐색기를 강제 구동하도록 설계 변경 */}
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

              <div className="h-48 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center text-slate-500">
                <span className="text-2xl mb-2 opacity-40">⛓️</span>
                <h3 className="text-base font-bold opacity-60">선택 과목(동시 수업) 그룹화</h3>
              </div>

              <div className="h-48 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center text-slate-500">
                <span className="text-2xl mb-2 opacity-40">🏫</span>
                <h3 className="text-base font-bold opacity-60">교과 특별실 배정</h3>
              </div>
            </div>
          </div>
        )}

        {/* [화면 2] 대시보드 조립판 메뉴 (업로드한 전역 데이터를 props로 실어 보냄) */}
        {activeMenu === 'START_TIMETABLE' && (
          <div className="w-full h-full flex flex-col animate-fadeIn">
            <DashboardPage units={globalUnits} />
          </div>
        )}
      </main>

    </div>
  );
}