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