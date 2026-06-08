// 엑셀에서 뽑아낸 기초 시수 유닛 데이터
export interface TeacherUnit {
  id: string;
  name: string;
  subject: string;
  grade: number;
  classNum: number;
  totalHours: number;
  color: string;
}

// 시간표에 배치된 데이터 (팀원 B가 주로 사용)
export interface Assignment {
  id: string;
  unitId: string;
  name: string;
  subject: string;
  grade: number;
  classNum: number;
  day: string;
  period: number;
  color: string;
  isFixed: boolean;
}

// 선생님(A)이 새로 만들 '동시수업(선택과목) 그룹' 데이터
export interface ElectiveGroup {
  groupId: string;
  groupName: string;
  unitIds: string[]; // 어떤 수업 유닛들이 이 그룹에 속해있는지 ID만 저장
}

// 특별실 데이터
export interface SpecialRoom {
  id: string;
  name: string;
  capacity: number; // 동시에 수업 가능한 학급 수
  unitIds: string[]; // 이 특별실을 사용하는 수업 유닛 ID들
}

// 수업 배정 금지 슬롯 (교사 기준)
export interface BlockedSlot {
  id: string;
  teacherName: string;
  day: string;
  period: number;
}

// 학년별 요일별 운영 교시 수 설정
// periodConfig[grade][day] = 해당 학년·요일의 최대 교시 수 (1~7)
export type PeriodConfig = {
  [grade: number]: {
    [day: string]: number;
  };
};

export const DEFAULT_PERIOD_CONFIG: PeriodConfig = {
  1: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
  2: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
  3: { 월: 7, 화: 7, 수: 7, 목: 7, 금: 7 },
};