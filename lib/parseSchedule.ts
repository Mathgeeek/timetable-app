/**
 * 대한미국 중고등학교 시수배당표 파서
 * 파일: 2026년_1학기_시수배당표_0223.xlsx
 * 시트: 교사별시수표
 *
 * 컬럼 구조:
 *   [0] 순번
 *   [1] 정식과목명
 *   [2] 단축과목명
 *   [3] 교사명
 *   [4~15]  1학년 1~12반 시수
 *   [16~27] 2학년 1~12반 시수
 *   [28~39] 3학년 1~12반 시수
 *   [40]    계 (합계)
 */

import * as XLSX from "xlsx";

// ─── 타입 정의 ────────────────────────────────────────────────

export interface ClassHours {
  [classNum: number]: number; // 1~12반
}

export interface ScheduleRow {
  /** 순번 (1-based) */
  index: number;
  /** 정식 과목명 (예: 공통국어1) */
  subjectFull: string;
  /** 단축 과목명 (예: 국어) */
  subjectShort: string;
  /** 교사명 */
  teacherName: string;
  /** 학년별 반별 시수 */
  hours: {
    grade1: ClassHours;
    grade2: ClassHours;
    grade3: ClassHours;
  };
  /** 총 시수 합계 */
  total: number;
}

export interface ParseResult {
  /** 파싱 성공 여부 */
  success: boolean;
  /** 파싱된 데이터 */
  data: ScheduleRow[];
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 메타 정보 */
  meta: {
    totalRows: number;
    sheetName: string;
    uniqueSubjects: string[];
    uniqueTeachers: string[];
  };
}

// ─── 헬퍼 ──────────────────────────────────────────────────────

/**
 * 셀 값을 숫자로 변환. 빈 셀이나 비숫자는 0 반환.
 */
function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/**
 * 셀 값을 문자열로 변환. 빈 셀은 빈 문자열 반환.
 */
function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * 반(1~12)별 시수 객체 생성
 * @param row  XLSX 행 배열
 * @param startCol  첫 번째 반이 들어있는 컬럼 인덱스
 */
function extractClassHours(
  row: unknown[],
  startCol: number
): ClassHours {
  const hours: ClassHours = {};
  for (let classNum = 1; classNum <= 12; classNum++) {
    const val = toNum(row[startCol + classNum - 1]);
    if (val > 0) {
      hours[classNum] = val;
    }
  }
  return hours;
}

// ─── 메인 파서 ─────────────────────────────────────────────────

/**
 * 브라우저 File 객체 또는 Node.js Buffer/ArrayBuffer를 받아 파싱합니다.
 *
 * @example (브라우저 — Next.js 클라이언트 컴포넌트)
 * ```ts
 * const file = event.target.files[0];
 * const result = await parseScheduleFile(file);
 * ```
 *
 * @example (Next.js API Route — Node.js 서버)
 * ```ts
 * import fs from "fs";
 * const buffer = fs.readFileSync("./file.xlsx");
 * const result = await parseScheduleFile(buffer);
 * ```
 */
export async function parseScheduleFile(
  input: File | Buffer | ArrayBuffer
): Promise<ParseResult> {
  try {
    // 1. 입력을 ArrayBuffer로 통일
    let arrayBuffer: ArrayBuffer;

    if (input instanceof File) {
      arrayBuffer = await input.arrayBuffer();
    } else if (Buffer.isBuffer(input)) {
      // Node.js Buffer → ArrayBuffer
      arrayBuffer = input.buffer.slice(
        input.byteOffset,
        input.byteOffset + input.byteLength
      ) as ArrayBuffer;
    } else {
      arrayBuffer = input;
    }

    // 2. XLSX 워크북 파싱
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // 3. 시트 선택 (첫 번째 시트 또는 '교사별시수표')
    const sheetName =
      workbook.SheetNames.includes("교사별시수표")
        ? "교사별시수표"
        : workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return {
        success: false,
        data: [],
        error: `시트를 찾을 수 없습니다. 사용 가능한 시트: ${workbook.SheetNames.join(", ")}`,
        meta: { totalRows: 0, sheetName: "", uniqueSubjects: [], uniqueTeachers: [] },
      };
    }

    // 4. 시트를 2D 배열로 변환 (헤더 없이 raw 배열)
    const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,        // 1-based 컬럼 인덱스 배열 반환
      defval: "",       // 빈 셀 기본값
      blankrows: false, // 완전히 빈 행 제외
    });

    /**
     * 실제 데이터 행 필터링 조건:
     *  - [0]이 숫자 (순번)
     *  - [1]이 문자열 (과목명)
     *  - [3]이 문자열 (교사명)
     */
    const dataRows = rows.filter((row) => {
      const idx = toNum(row[0]);
      const subject = toStr(row[1]);
      const teacher = toStr(row[3]);
      return idx > 0 && subject.length > 0 && teacher.length > 0;
    });

    // 5. 각 행을 ScheduleRow로 변환
    const parsed: ScheduleRow[] = dataRows.map((row) => {
      return {
        index: toNum(row[0]),
        subjectFull: toStr(row[1]),
        subjectShort: toStr(row[2]),
        teacherName: toStr(row[3]),
        hours: {
          grade1: extractClassHours(row, 4),   // 컬럼 4~15
          grade2: extractClassHours(row, 16),  // 컬럼 16~27
          grade3: extractClassHours(row, 28),  // 컬럼 28~39
        },
        total: toNum(row[40]),
      };
    });

    // 6. 메타 정보 생성
    const uniqueSubjects = [...new Set(parsed.map((r) => r.subjectFull))];
    const uniqueTeachers = [...new Set(parsed.map((r) => r.teacherName))];

    return {
      success: true,
      data: parsed,
      meta: {
        totalRows: parsed.length,
        sheetName,
        uniqueSubjects,
        uniqueTeachers,
      },
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      meta: { totalRows: 0, sheetName: "", uniqueSubjects: [], uniqueTeachers: [] },
    };
  }
}

// ─── 편의 유틸리티 함수들 ──────────────────────────────────────

/**
 * 특정 과목의 모든 행을 조회합니다.
 */
export function filterBySubject(
  data: ScheduleRow[],
  subjectName: string
): ScheduleRow[] {
  return data.filter(
    (row) =>
      row.subjectFull.includes(subjectName) ||
      row.subjectShort.includes(subjectName)
  );
}

/**
 * 특정 교사의 모든 행을 조회합니다.
 */
export function filterByTeacher(
  data: ScheduleRow[],
  teacherName: string
): ScheduleRow[] {
  return data.filter((row) => row.teacherName === teacherName);
}

/**
 * 특정 학년의 반별 시수 집계를 반환합니다.
 * @param grade 1 | 2 | 3
 */
export function getGradeSummary(
  data: ScheduleRow[],
  grade: 1 | 2 | 3
): Record<string, ClassHours> {
  const key = `grade${grade}` as "grade1" | "grade2" | "grade3";
  const summary: Record<string, ClassHours> = {};

  for (const row of data) {
    const gradeHours = row.hours[key];
    if (!summary[row.subjectFull]) {
      summary[row.subjectFull] = {};
    }
    for (const [classNum, hours] of Object.entries(gradeHours)) {
      const cn = Number(classNum);
      summary[row.subjectFull][cn] =
        (summary[row.subjectFull][cn] ?? 0) + hours;
    }
  }

  return summary;
}

/**
 * 반별 총 시수가 특정 값인지 검증합니다 (보통 30시수).
 * @returns 이상이 있는 반 목록
 */
export function validateTotalHours(
  data: ScheduleRow[],
  expectedHoursPerClass: number = 30
): { grade: number; classNum: number; actual: number }[] {
  const errors: { grade: number; classNum: number; actual: number }[] = [];

  for (const gradeNum of [1, 2, 3] as const) {
    const key = `grade${gradeNum}` as "grade1" | "grade2" | "grade3";
    const totals: Record<number, number> = {};

    for (const row of data) {
      for (const [classNum, hours] of Object.entries(row.hours[key])) {
        const cn = Number(classNum);
        totals[cn] = (totals[cn] ?? 0) + hours;
      }
    }

    for (const [classNum, total] of Object.entries(totals)) {
      if (total !== expectedHoursPerClass) {
        errors.push({
          grade: gradeNum,
          classNum: Number(classNum),
          actual: total,
        });
      }
    }
  }

  return errors;
}