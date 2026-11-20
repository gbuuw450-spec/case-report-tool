// 단어 검색: 쪽별 글자에서 찾는 단어가 있는 곳을 원문 문장과 함께 돌려준다.
// Design Ref: §5.2 검색 — 공백을 빼고 비교한다. 질문 이해나 비슷한 말 찾기는 하지 않는다.
// 정한 기준: 검색 결과 1건 = 한 쪽에서 찾은 한 곳.
// 다른 프로젝트 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

/** 검색어 최대 길이 */
export const MAX_QUERY_LENGTH = 100;

/** 한 번에 보여 주는 검색 결과 최대 건수 (PRD 5번: 최대 5건, 더 있으면 "추가 n건 있음") */
export const MAX_RESULTS_SHOWN = 5;

/** 문장 경계를 못 찾을 때 찾은 단어 앞뒤로 보여 줄 최대 글자 수 */
const CONTEXT_MAX = 200;

/** 검색 대상: 서류 한 쪽의 글자 */
export interface PageRow {
  documentId: string;
  documentName: string;
  evidenceName: string | null; // 증거 이름 (증거서류만, 갑 제1호증 등)
  kind: string;
  pageNo: number;
  text: string;
  uncertain: { start: number; end: number }[]; // 이 쪽에서 "[인식 불확실]"인 구간
}

/** 검색 결과 1건 */
export interface SearchResult {
  documentId: string;
  documentName: string;
  evidenceName: string | null;
  kind: string;
  pageNo: number;
  sentence: string; // 원문 그대로 (줄바꿈 포함)
  sentenceStart: number; // 쪽 글자 안에서 sentence가 시작하는 위치 (담을 때 원문과 맞는지 확인하는 데 쓴다)
  matchStart: number; // sentence 안에서 찾은 단어의 시작
  matchEnd: number; // sentence 안에서 찾은 단어의 끝
  uncertain: boolean; // 이 문장에 글자 인식이 불확실한 부분이 있는지
  uncertainRanges: { start: number; end: number }[]; // sentence 안에서 불확실한 단어의 구간
}

/** 공백을 모두 빼고 소문자로 바꾼 글자와, 각 글자가 원문 어디에 있었는지의 위치표 */
function squeeze(text: string): { squeezed: string; map: number[] } {
  const chars: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (/\s/.test(c)) continue;
    for (const lower of c.toLowerCase()) {
      chars.push(lower);
      map.push(i);
    }
  }
  return { squeezed: chars.join(""), map };
}

/** 문장이 끝나는 글자인지. 날짜(2023. 3. 15.)처럼 숫자 뒤의 마침표는 문장 끝으로 보지 않는다. */
function isSentenceEnd(text: string, k: number): boolean {
  const c = text[k];
  if (c === "?" || c === "!" || c === "。") return true;
  if (c !== ".") return false;
  const prev = text[k - 1] ?? "";
  const next = text[k + 1];
  const nextOk = next === undefined || /\s/.test(next) || "\"'”’)」』".includes(next);
  return nextOk && !/\d/.test(prev);
}

/** 한 쪽의 글자에서 단어가 있는 모든 곳을 찾는다. (겹치지 않게, 앞에서부터) */
export function findHits(text: string, query: string): { start: number; end: number }[] {
  const q = squeeze(query).squeezed;
  if (q === "") return [];

  const { squeezed, map } = squeeze(text);
  const hits: { start: number; end: number }[] = [];
  let from = 0;
  for (;;) {
    const idx = squeezed.indexOf(q, from);
    if (idx < 0) break;
    hits.push({ start: map[idx], end: map[idx + q.length - 1] + 1 });
    from = idx + q.length;
  }
  return hits;
}

/** 찾은 곳이 들어 있는 문장의 범위. 줄바꿈은 문장 끝으로 보지 않는다(PDF 줄바꿈은 보이는 줄 바꿈일 뿐이다). */
function sentenceRange(text: string, start: number, end: number): { from: number; to: number } {
  let from = start;
  while (from > 0 && start - from < CONTEXT_MAX && !isSentenceEnd(text, from - 1)) from--;

  let to = end;
  while (to < text.length && to - end < CONTEXT_MAX) {
    if (isSentenceEnd(text, to)) {
      to++;
      break;
    }
    to++;
  }

  // 문장 앞뒤 공백은 잘라낸다.
  while (from < start && /\s/.test(text[from])) from++;
  while (to > end && /\s/.test(text[to - 1])) to--;
  return { from, to };
}

/**
 * 결과를 앞에서부터 최대 건수까지만 보여 주고, 나머지는 건수만 알려 준다.
 * 숨기는 결과가 있다는 사실은 반드시 extra로 알린다.
 */
export function limitResults<T>(results: T[], max: number): { shown: T[]; extra: number } {
  return { shown: results.slice(0, max), extra: Math.max(0, results.length - max) };
}

/**
 * 모든 쪽에서 단어를 찾아 결과 목록을 만든다.
 * 순서: 서류 순서(받은 순서) → 쪽수 → 쪽 안의 위치.
 * 글자가 없는 쪽은 건너뛴다.
 */
export function searchPages(rows: PageRow[], query: string): SearchResult[] {
  const results: SearchResult[] = [];
  for (const row of rows) {
    if (row.text === "") continue;
    for (const hit of findHits(row.text, query)) {
      const { from, to } = sentenceRange(row.text, hit.start, hit.end);
      // 문장과 겹치는 불확실 구간만 골라 문장 기준 위치로 바꾼다.
      const uncertainRanges = row.uncertain
        .filter((r) => r.start < to && r.end > from)
        .map((r) => ({ start: Math.max(r.start, from) - from, end: Math.min(r.end, to) - from }));
      results.push({
        documentId: row.documentId,
        documentName: row.documentName,
        evidenceName: row.evidenceName,
        kind: row.kind,
        pageNo: row.pageNo,
        sentence: row.text.slice(from, to),
        sentenceStart: from,
        matchStart: hit.start - from,
        matchEnd: hit.end - from,
        uncertain: uncertainRanges.length > 0,
        uncertainRanges,
      });
    }
  }
  return results;
}
