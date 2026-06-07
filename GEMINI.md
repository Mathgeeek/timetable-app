# Project Overview
이 프로젝트는 학교 현장에서 교사들이 사용하는 '시간표 일과 마스터(Timetable App)'입니다. 
관리자(수업계 교사)가 기초 시간표의 제약 조건(동시수업, 교과교실 등)을 설정하여 자동 배정하고, 일반 교사들이 접속하여 시간표를 확인 및 상호 교환 요청을 할 수 있는 시스템입니다.

# Tech Stack
- Framework: Next.js (App Router 기반)
- Language: TypeScript
- Styling: Tailwind CSS
- Database/BaaS: Firebase (실시간 동기화 필수)

# Architecture & Directory Structure
컴포넌트는 역할에 따라 엄격하게 분리하여 관리합니다.
- `app/types/index.ts`: 시스템 전체에서 공유하는 공통 타입(인터페이스) 정의
- `app/components/common/`: 여러 페이지에서 재사용되는 UI 컴포넌트 (예: UnitSidebar)
- `app/components/setup/`: 관리자용 제약 조건 설정 페이지 (예: ElectiveGroupBuilder)
- `app/components/viewer/`: 일반 교사용 시간표 조회 및 교환 모드 페이지
- `lib/`: 순수 비즈니스 로직 및 헬퍼 함수 (예: 엑셀 파싱, 자동 배정 엔진)

# Coding Conventions & Rules
1. 모든 컴포넌트는 함수형으로 작성하며, 상태 관리가 필요한 경우 상단에 `'use client';`를 명시한다.
2. 새로운 데이터 구조가 필요할 때는 반드시 `app/types/index.ts`에 먼저 정의한 후 `import`하여 사용한다.
3. 실시간 시간표 동기화 및 결재(수락/거절) 알림이 핵심이므로, 데이터베이스 CRUD 코드를 작성할 때는 Firebase의 Realtime DB 또는 Firestore 문법에 맞게 최적화한다.
4. UI를 짤 때는 Tailwind CSS를 활용하되, 다크 모드(`bg-slate-900`, `text-slate-100` 등) 톤앤매너를 유지한다.

# Domain Glossary (학교 도메인 용어 사전)
AI가 변수명이나 UI 텍스트를 작성할 때 아래의 용어 규칙을 엄격히 따릅니다.
- **Unit (유닛):** 특정 교사가 특정 반에 들어가야 하는 1시간짜리 수업 블록.
- **Elective Group (선택과목/동시수업):** 물리, 화학 등 동일 시간에 무조건 같이 묶여서 배정되어야 하는 수업들의 그룹.
- **Special Room (교과교실/특별실):** 컴퓨터실, 과학실 등 특정 교과가 겹치지 않게 사용해야 하는 공간.
- **Constraint (제약 조건):** 시간표 배정 알고리즘이 지켜야 할 필수 규칙 (예: 3연강 금지, 특정 교시 고정 등).