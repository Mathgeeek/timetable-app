/**
 * 교사별 시수배당표 파서
 * - 한컴 한셀(HCell)에서 저장한 xlsx 호환 처리 추가:
 *   한셀은 sharedStrings 등에 표준이 아닌 hs: 네임스페이스 확장 태그를 끼워 넣는데,
 *   SheetJS가 이 태그에서 시트 본문 파싱에 실패해 workbook.Sheets가 비어버린다.
 *   => 1차로 그냥 읽어보고, 시트 본문이 비어있으면 hs: 태그를 제거한 뒤 재시도한다.
 *
 *   추가 의존성: fflate (xlsx 압축 해제/재압축용)
 *   설치:  npm install fflate
 */

import * as XLSX from "xlsx";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

export interface ClassHours {
  [classNum: number]: number;
}

export interface ScheduleRow {
  index: number;
  subjectFull: string;
  subjectShort: string;
  teacherName: string;
  hours: {
    grade1: ClassHours;
    grade2: ClassHours;
    grade3: ClassHours;
  };
  total: number;
}

interface GradeColumnMap {
  [grade: number]: { [classNum: number]: number };
}

export interface ParseResult {
  success: boolean;
  data: ScheduleRow[];
  error?: string;
  meta: {
    totalRows: number;
    sheetName: string;
    uniqueSubjects: string[];
    uniqueTeachers: string[];
    classCountByGrade: { [grade: number]: number };
  };
}

function toNum(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * 한컴 한셀(HCell)이 끼워 넣는 비표준 hs: 네임스페이스 태그/속성을 제거한다.
 * (예: <hs:size val="1"/>, <hs:ratio .../>, hs:extension="1" 등)
 * 표준 Excel 파일에는 hs: 태그가 없으므로 사실상 무해한 통과 처리가 된다.
 */
function sanitizeHancomXlsx(arrayBuffer: ArrayBuffer): ArrayBuffer {
  const files = unzipSync(new Uint8Array(arrayBuffer));
  const out: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith(".xml")) {
      let xml = strFromU8(data);
      xml = xml
        // <hs:foo .../>  형태의 자가 종료 태그 제거
        .replace(/<hs:[a-zA-Z0-9]+\b[^>]*\/>/g, "")
        // <hs:foo ...>...</hs:foo> 형태의 짝 태그 제거(안전망)
        .replace(/<hs:[a-zA-Z0-9]+\b[^>]*>[\s\S]*?<\/hs:[a-zA-Z0-9]+>/g, "")
        // hs:extension="1" 같은 hs: 속성 제거
        .replace(/\shs:[a-zA-Z0-9]+="[^"]*"/g, "");
      out[name] = strToU8(xml);
    } else {
      out[name] = data;
    }
  }
  // SharedArrayBuffer 가능성을 피하기 위해 명시적으로 ArrayBuffer 로 복사해 반환
  const zipped = zipSync(out);
  return zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength
  ) as ArrayBuffer;
}

/**
 * 워크북을 견고하게 읽는다.
 * 1) 우선 그대로 읽는다.
 * 2) 예외가 나거나 시트 본문(Sheets)이 비어 있으면 한셀 태그를 제거하고 재시도한다.
 */
function readWorkbookResilient(arrayBuffer: ArrayBuffer): XLSX.WorkBook {
  let wb: XLSX.WorkBook | null = null;
  try {
    wb = XLSX.read(arrayBuffer, { type: "array" });
  } catch {
    wb = null;
  }

  const looksEmpty =
    !wb || wb.SheetNames.length === 0 || Object.keys(wb.Sheets).length === 0;

  if (looksEmpty) {
    const cleaned = sanitizeHancomXlsx(arrayBuffer);
    wb = XLSX.read(cleaned, { type: "array" });
  }

  return wb!;
}

/**
 * 헤더를 읽어 학년별 컬럼 매핑과 "계" 열 위치를 자동 감지.
 */
function detectStructure(
  gradeRow: unknown[],
  classRow: unknown[]
): { map: GradeColumnMap; totalCol: number | null } {
  const map: GradeColumnMap = {};
  let totalCol: number | null = null;
  const gradeStarts: { grade: number; col: number }[] = [];

  // 1. "계" 열 위치 검색 (포함 검사 및 트림)
  for (let c = 0; c < gradeRow.length; c++) {
    const label = toStr(gradeRow[c]);
    if (label.includes("계") || label.includes("합계") || label.includes("총계")) {
      totalCol = c;
      break;
    }
  }

  // 2. 학년 라벨 수집 (셀 병합 대응)
  let lastSeenGrade = 0;
  for (let c = 0; c < gradeRow.length; c++) {
    if (totalCol !== null && c >= totalCol) break;

    const label = toStr(gradeRow[c]);
    const gm = label.match(/^([123])\s*학년/);

    if (gm) {
      const currentGrade = Number(gm[1]);
      if (currentGrade !== lastSeenGrade) {
        gradeStarts.push({ grade: currentGrade, col: c });
        lastSeenGrade = currentGrade;
      }
    }
  }

  // 3. 각 학년별 반 번호 매핑 생성
  for (let i = 0; i < gradeStarts.length; i++) {
    const { grade, col } = gradeStarts[i];
    const nextCol =
      i + 1 < gradeStarts.length
        ? gradeStarts[i + 1].col
        : totalCol !== null
        ? totalCol
        : classRow.length;

    const classes: { [classNum: number]: number } = {};
    for (let c = col; c < nextCol; c++) {
      const cn = toNum(classRow[c]);
      if (cn > 0) {
        classes[cn] = c;
      }
    }
    map[grade] = classes;
  }

  return { map, totalCol };
}

function extractHours(
  row: unknown[],
  classMap: { [classNum: number]: number }
): ClassHours {
  const hours: ClassHours = {};
  if (!classMap) return hours;
  for (const [classNumStr, col] of Object.entries(classMap)) {
    const val = toNum(row[col]);
    if (val > 0) hours[Number(classNumStr)] = val;
  }
  return hours;
}

function emptyMeta() {
  return {
    totalRows: 0,
    sheetName: "",
    uniqueSubjects: [] as string[],
    uniqueTeachers: [] as string[],
    classCountByGrade: { 1: 0, 2: 0, 3: 0 },
  };
}

export async function parseScheduleFile(
  input: File | Buffer | ArrayBuffer
): Promise<ParseResult> {
  try {
    let arrayBuffer: ArrayBuffer;
    if (input instanceof File) {
      arrayBuffer = await input.arrayBuffer();
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
      arrayBuffer = input.buffer.slice(
        input.byteOffset,
        input.byteOffset + input.byteLength
      ) as ArrayBuffer;
    } else {
      arrayBuffer = input as ArrayBuffer;
    }

    // ✅ 한셀(HCell) 호환: 필요 시 hs: 태그 제거 후 재시도
    const workbook = readWorkbookResilient(arrayBuffer);

    // 시트 이름 유연하게 획득
    const sheetName =
      workbook.SheetNames.find(
        (name) => name.includes("교사별") || name.includes("시수")
      ) || workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return {
        success: false,
        data: [],
        error: `시트를 찾을 수 없습니다. 사용 가능한 시트 목록: ${workbook.SheetNames.join(
          ", "
        )}`,
        meta: emptyMeta(),
      };
    }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    // 학년 라벨 행 자동 탐색
    let gradeRowIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const hasGradeLabel = rows[r].some((cell) =>
        /^[123]\s*학년/.test(toStr(cell))
      );
      if (hasGradeLabel) {
        gradeRowIdx = r;
        break;
      }
    }

    if (gradeRowIdx === -1 || gradeRowIdx + 1 >= rows.length) {
      return {
        success: false,
        data: [],
        error:
          "학년 헤더('1학년','2학년','3학년')를 찾지 못했습니다. 표준 양식을 사용했는지 확인해 주세요.",
        meta: emptyMeta(),
      };
    }

    const { map, totalCol } = detectStructure(
      rows[gradeRowIdx],
      rows[gradeRowIdx + 1]
    );

    const dataStartIdx = gradeRowIdx + 2;
    const dataRows = rows.slice(dataStartIdx).filter((row) => {
      const firstCell = row[0];
      const subject = toStr(row[1]);
      const teacher = toStr(row[3]);

      // 순번 셀이 숫자/문자 타입이든 존재만 하면 통과
      if (firstCell === null || firstCell === undefined || firstCell === "")
        return false;

      const idxStr = toStr(firstCell);
      // '예) 1' 같은 가이드 행 및 과목/교사명 누락 행 차단
      return !idxStr.includes("예") && subject.length > 0 && teacher.length > 0;
    });

    const parsed: ScheduleRow[] = dataRows.map((row) => ({
      index: toNum(row[0]),
      subjectFull: toStr(row[1]),
      subjectShort: toStr(row[2]),
      teacherName: toStr(row[3]),
      hours: {
        grade1: extractHours(row, map[1] || {}),
        grade2: extractHours(row, map[2] || {}),
        grade3: extractHours(row, map[3] || {}),
      },
      total: totalCol !== null ? toNum(row[totalCol]) : 0,
    }));

    const classCountByGrade: { [grade: number]: number } = {
      1: Object.keys(map[1] || {}).length || 12,
      2: Object.keys(map[2] || {}).length || 12,
      3: Object.keys(map[3] || {}).length || 12,
    };

    return {
      success: true,
      data: parsed,
      meta: {
        totalRows: parsed.length,
        sheetName,
        uniqueSubjects: [...new Set(parsed.map((r) => r.subjectFull))],
        uniqueTeachers: [...new Set(parsed.map((r) => r.teacherName))],
        classCountByGrade,
      },
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      meta: emptyMeta(),
    };
  }
}

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

export function filterByTeacher(
  data: ScheduleRow[],
  teacherName: string
): ScheduleRow[] {
  return data.filter((row) => row.teacherName === teacherName);
}