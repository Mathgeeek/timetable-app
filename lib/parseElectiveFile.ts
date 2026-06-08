/**
 * 이동수업(선택과목) 편성안 파서
 * - 한컴 한셀(.cell) 또는 Excel(.xlsx/.xls) 파일을 읽어
 *   선택과목 "코호트(동시 수업 묶음)" 정보를 추출합니다.
 *
 * ★ 핵심 개념: "이동학급(인원)" 행이 동시 배정의 기준이다.
 *   - 한 "N선택" 블록은 [과목 행] → [수강인원 행] → [이동학급(인원) 행 + 연속 행]으로 구성된다.
 *   - 이동학급 행에는 각 반(컬럼)의 학생들이 "어느 출신 학급"에서 모였는지가 적혀 있다.
 *   - 같은 출신 학급(들)을 공유하는 컬럼끼리는 = 같은 학생 풀이 나뉘어 들어간 수업 =
 *     반드시 같은 시간(같은 교시)에 진행되어야 한다.
 *
 *   예) 2선택에서
 *       9반 컬럼(사회문제탐구) ← 출신 {9반, 10반}
 *       10반 컬럼(생활과윤리) ← 출신 {9반, 10반}
 *     → 두 수업은 같은 시간에 배정되어야 한다. (= 하나의 코호트)
 *
 * 파일 구조 (sheet1):
 *   - A열: "1선택", "2선택" ... (선택 번호)
 *   - B열: 조합 설명 (예: "한문I/중문/과학융합")
 *   - C,E,G,I,K,M,O,Q,S,U,W,Y 열: 각각 1~12반의 과목명 / 이동학급 출신
 */

import { unzipSync, strFromU8 } from 'fflate';

/** 파일에서 파싱한 "동시 배정 코호트" 1개 = 같은 시간에 진행되는 수업 묶음 */
export interface ParsedElectiveGroup {
  groupName: string;       // "2선택 ②" 처럼 표시용 이름
  selectionName: string;   // "2선택"
  description: string;     // 코호트 설명 (예: "9·10반 → 사회문제탐구 + 생활과윤리")
  classSubjects: {
    classNum: number;      // 1~12 (대표 반)
    subject: string;       // 과목명 (정규화됨)
  }[];
}

// ── 과목 약어 → 표준 명칭 정규화 맵 ────────────────────────────────────────
const SUBJECT_NORMALIZE: [RegExp, string][] = [
  [/^음감$/i, '음악감상과 비평'],
  [/^미감$/i, '미술감상과 비평'],
  [/^심영$/i, '심화영어Ⅰ'],
  [/^생윤$/i, '생활과윤리'],
  [/^사문탐$/i, '사회문제탐구'],
  [/^생과$/i, '생활과과학'],
  [/^여지$/i, '여행지리'],
  [/^정법$/i, '정치와법'],
  [/^동사$/i, '동아시아사'],
  [/^인공$/i, '인공지능기초'],
  [/^한문[iIⅠ1]$/i, '한문Ⅰ'],
  [/^고전$/i, '고전읽기'],
  [/^중문$/i, '중국문화'],
  [/^일문$/i, '일본문화'],
  [/^민주$/i, '민주시민'],
  [/^공학$/i, '공학일반'],
  [/^수탐$/i, '수학과제탐구'],
  [/^미적$/i, '미적분'],
  [/^물리?[ⅡII2]?$/i, '물리학Ⅱ'],
  [/^화학?[ⅡII2]?$/i, '화학Ⅱ'],
  [/^생명?[ⅡII2]?$/i, '생명과학Ⅱ'],
  [/^지구?[ⅡII2]?$/i, '지구과학Ⅱ'],
  [/^과융$/i, '과학융합'],
];

export function normalizeSubject(raw: string): string {
  const s = raw.trim();
  for (const [pattern, canonical] of SUBJECT_NORMALIZE) {
    if (pattern.test(s)) return canonical;
  }
  return s;
}

/** TeacherUnit 과목명과 편성안 과목명이 같은지 판별 (퍼지 매칭) */
export function subjectMatches(unitSubject: string, cellSubject: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[ⅰⅱⅲⅳⅰ]/g, m => ({ ⅰ: '1', ⅱ: '2', ⅲ: '3', ⅳ: '4' }[m] ?? m))
      .replace(/[iI]+$/g, '');

  const a = normalize(unitSubject);
  const b = normalize(cellSubject);

  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  // 약어 매핑 재확인
  const normalizedCell = normalizeSubject(cellSubject);
  const c = normalize(normalizedCell);
  if (a === c || a.includes(c) || c.includes(a)) return true;

  return false;
}

// ── XML 파싱 헬퍼 ────────────────────────────────────────────────────────────

function parseSharedStrings(xml: string): string[] {
  const results: string[] = [];
  // <si> 또는 <x:si> 네임스페이스 둘 다 지원
  const siBlocks = xml.match(/<x?:?si\b[\s\S]*?<\/x?:?si>/g) ?? [];
  for (const block of siBlocks) {
    // <t> 또는 <x:t> 태그를 모두 합침 (rich text 지원)
    const tMatches = block.match(/<x?:?t[^>]*>([\s\S]*?)<\/x?:?t>/g) ?? [];
    const text = tMatches
      .map(t => t.replace(/<[^>]+>/g, ''))
      .join('');
    results.push(decodeXmlEntities(text));
  }
  return results;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// 열 참조(A,B,AA,...) → 1-based 인덱스
function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

interface CellData {
  [colIdx: number]: string;
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): CellData[] {
  // 행 단위로 쪼개기
  const rowBlocks = sheetXml.match(/<x?:?row\b[^>]*>[\s\S]*?<\/x?:?row>/g) ?? [];
  const rowMap: { [rowNum: number]: CellData } = {};

  for (const rowBlock of rowBlocks) {
    // <x:row r="5" ...> 에서 행 번호 추출
    const rowNumMatch = rowBlock.match(/<x?:?row\b[^>]*r="(\d+)"/);
    if (!rowNumMatch) continue;
    const rowNum = parseInt(rowNumMatch[1]);
    const cells: CellData = {};

    // self-closing 빈 셀(<x:c .../>) 제거 후 파싱 — 남겨두면 다음 셀을 삼키는 버그 발생
    const cleanedRow = rowBlock.replace(/<x?:?c\b[^>]*\/>/g, '');
    const cellBlocks = cleanedRow.match(/<x?:?c\b[^>]*>[\s\S]*?<\/x?:?c>/g) ?? [];
    for (const cellBlock of cellBlocks) {
      const refMatch = cellBlock.match(/r="([A-Z]+)\d+"/);
      if (!refMatch) continue;
      const colIdx = colToIndex(refMatch[1]);
      const isShared = /t="s"/.test(cellBlock);
      const vMatch = cellBlock.match(/<x?:?v[^>]*>([\s\S]*?)<\/x?:?v>/);
      if (!vMatch) continue;
      const rawVal = decodeXmlEntities(vMatch[1].trim());
      cells[colIdx] = isShared ? (sharedStrings[parseInt(rawVal)] ?? '') : rawVal;
    }

    rowMap[rowNum] = cells;
  }

  // rowNum 순서대로 배열 반환 (0-indexed, rowNum-1이 index)
  const maxRow = Math.max(...Object.keys(rowMap).map(Number));
  const result: CellData[] = [];
  for (let i = 1; i <= maxRow; i++) {
    result.push(rowMap[i] ?? {});
  }
  return result;
}

// 홀수 열만 사용하는 반 목록 (C=3, E=5, G=7, I=9, K=11, M=13, O=15, Q=17, S=19, U=21, W=23, Y=25)
const CLASS_COLS: { classNum: number; colIdx: number }[] = [
  { classNum: 1, colIdx: 3 },
  { classNum: 2, colIdx: 5 },
  { classNum: 3, colIdx: 7 },
  { classNum: 4, colIdx: 9 },
  { classNum: 5, colIdx: 11 },
  { classNum: 6, colIdx: 13 },
  { classNum: 7, colIdx: 15 },
  { classNum: 8, colIdx: 17 },
  { classNum: 9, colIdx: 19 },
  { classNum: 10, colIdx: 21 },
  { classNum: 11, colIdx: 23 },
  { classNum: 12, colIdx: 25 },
];

// ── 메인 파서 ─────────────────────────────────────────────────────────────────

export async function parseElectiveFile(file: File): Promise<ParsedElectiveGroup[]> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // ZIP 압축 해제
  let files: ReturnType<typeof unzipSync>;
  try {
    files = unzipSync(uint8);
  } catch {
    throw new Error('파일을 열 수 없습니다. .cell 또는 .xlsx 형식을 지원합니다.');
  }

  // sharedStrings.xml 로드
  const ssEntry = Object.keys(files).find(k => k.endsWith('sharedStrings.xml'));
  if (!ssEntry) throw new Error('sharedStrings.xml을 찾을 수 없습니다.');
  const sharedStrings = parseSharedStrings(strFromU8(files[ssEntry]));

  // sheet1.xml 로드 (우선순위: xl/worksheets/sheet1.xml)
  const sheetEntry = Object.keys(files).find(k =>
    k.endsWith('sheet1.xml') && k.includes('worksheets')
  );
  if (!sheetEntry) throw new Error('워크시트를 찾을 수 없습니다.');
  const sheetXml = strFromU8(files[sheetEntry]);

  const rows = parseSheetRows(sheetXml, sharedStrings);
  const groups: ParsedElectiveGroup[] = [];

  // 행을 순회하며 "N선택" 블록을 찾는다.
  let rowIdx = 0;
  while (rowIdx < rows.length) {
    const row = rows[rowIdx];
    const colA = (row[1] ?? '').trim();

    // "N선택" 으로 시작하는 과목 행 찾기
    if (!/^\d+선택$/.test(colA)) {
      rowIdx++;
      continue;
    }

    const selectionName = colA;            // "2선택"
    const description = (row[2] ?? '').trim();
    const subjectRow = row;

    // ── 이 블록의 "이동학급(인원)" 행 + 연속 행 수집 ──────────────────────
    // 다음 "N선택" 행이 나오기 전까지가 이 블록의 범위
    let cursor = rowIdx + 1;
    let movStart = -1;
    while (cursor < rows.length) {
      const r = rows[cursor];
      const a = (r[1] ?? '').trim();
      if (/^\d+선택$/.test(a)) break;       // 다음 선택 블록 시작 → 종료
      const b = (r[2] ?? '').trim();
      if (b.includes('이동학급')) { movStart = cursor; }
      cursor++;
    }
    const blockEnd = cursor;                // 다음 선택 블록 시작 인덱스 (배타적)

    // 각 컬럼별 "출신 학급" 집합 수집
    const colSources: Record<number, Set<string>> = {};
    for (const { colIdx } of CLASS_COLS) colSources[colIdx] = new Set();

    if (movStart >= 0) {
      for (let r = movStart; r < blockEnd; r++) {
        const mr = rows[r];
        const a = (mr[1] ?? '').trim();
        const b = (mr[2] ?? '').trim();
        // 이동학급 행 또는 연속 행(A·B 비어있음)만 출신 정보로 사용
        if (a !== '' || (b !== '' && !b.includes('이동학급'))) continue;
        for (const { colIdx } of CLASS_COLS) {
          const src = (mr[colIdx] ?? '').trim();
          if (src && src.includes('반')) colSources[colIdx].add(src);
        }
      }
    }

    // ── Union-Find: 출신 학급을 공유하는 컬럼끼리 묶기 ─────────────────────
    const parent: Record<number, number> = {};
    for (const { colIdx } of CLASS_COLS) parent[colIdx] = colIdx;
    const find = (x: number): number => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    const union = (a: number, b: number) => { parent[find(a)] = find(b); };

    for (let i = 0; i < CLASS_COLS.length; i++) {
      for (let j = i + 1; j < CLASS_COLS.length; j++) {
        const ci = CLASS_COLS[i].colIdx;
        const cj = CLASS_COLS[j].colIdx;
        let shared = false;
        for (const s of colSources[ci]) {
          if (colSources[cj].has(s)) { shared = true; break; }
        }
        if (shared) union(ci, cj);
      }
    }

    // 루트별로 컬럼 묶기
    const cohortMap: Record<number, { classNum: number; colIdx: number }[]> = {};
    for (const cc of CLASS_COLS) {
      const root = find(cc.colIdx);
      (cohortMap[root] ??= []).push(cc);
    }

    // ── 코호트(2개 이상 컬럼)만 그룹으로 생성 ─────────────────────────────
    let cohortNum = 0;
    const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    for (const root of Object.keys(cohortMap)) {
      const members = cohortMap[Number(root)];
      if (members.length < 2) continue;     // 단일 학급 단독 수업은 동시배정 불필요

      const classSubjects: ParsedElectiveGroup['classSubjects'] = [];
      for (const m of members) {
        const raw = (subjectRow[m.colIdx] ?? '').trim();
        if (raw && !/^\d+$/.test(raw)) {
          classSubjects.push({ classNum: m.classNum, subject: normalizeSubject(raw) });
        }
      }
      if (classSubjects.length < 2) continue;

      const classNums = classSubjects.map(c => c.classNum).sort((a, b) => a - b);
      const label = CIRCLED[cohortNum] ?? `(${cohortNum + 1})`;
      groups.push({
        groupName: `${selectionName} ${label}`,
        selectionName,
        description: `${classNums.join('·')}반 → ${classSubjects.map(c => c.subject).join(' + ')}`,
        classSubjects,
      });
      cohortNum++;
    }

    rowIdx = blockEnd;
  }

  if (groups.length === 0) {
    throw new Error(
      '동시 배정이 필요한 코호트를 찾지 못했습니다.\n' +
      '"이동학급(인원)" 행이 포함된 편성안 파일인지 확인해 주세요.'
    );
  }

  return groups;
}
