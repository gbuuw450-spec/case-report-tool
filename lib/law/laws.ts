// 법령 검색과 조문 가져오기 — 법제처 응답에서 필요한 칸만 뽑는다.
import { lawRequest } from "./client";
import { LawError, type LawArticle, type LawSummary } from "./types";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const asList = (v: unknown): unknown[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** 20261002 → 2026-10-02 */
function dateOf(v: unknown): string {
  const s = str(v).replace(/\D/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : "";
}

export const MAX_QUERY_LENGTH = 100;

/** 조사자가 입력한 글을 검사해 다듬는다. 비었거나 너무 길면 오류. */
export function cleanQuery(raw: unknown): string {
  const q = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!q) throw new LawError("BAD_INPUT", "검색어를 입력해 주세요.");
  if (q.length > MAX_QUERY_LENGTH) throw new LawError("BAD_INPUT", `검색어는 ${MAX_QUERY_LENGTH}자까지 입력할 수 있습니다.`);
  return q;
}

/** 법령명으로 법령을 찾는다. (보내는 값: 법령명) */
export async function searchLaws(rawName: unknown): Promise<LawSummary[]> {
  const query = cleanQuery(rawName);
  const body = await lawRequest("lawSearch.do", { target: "law", query });
  if (!isObj(body) || !isObj(body.LawSearch)) throw new LawError("BAD_RESPONSE", "법제처 응답의 모양이 예상과 다릅니다.");
  return asList(body.LawSearch.law)
    .filter(isObj)
    .map((l) => ({
      mst: str(l["법령일련번호"]),
      lawId: str(l["법령ID"]),
      name: str(l["법령명한글"]),
      kind: str(l["법령구분명"]),
      ministry: str(l["소관부처명"]),
      effectiveDate: dateOf(l["시행일자"]),
      promulgationDate: dateOf(l["공포일자"]),
    }))
    .filter((l) => l.mst && l.name);
}

/** "제47조의2", "47조의2", "47의2", "47" → 법제처 조문 번호 6자리(004702). 못 알아보면 오류. */
export function parseArticleLabel(raw: unknown): { jo: string; label: string } {
  const text = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  const m = /^제?(\d{1,4})(?:조)?(?:의(\d{1,2}))?(?:조)?$/.exec(text);
  const main = m ? Number(m[1]) : 0;
  if (!m || main < 1) throw new LawError("BAD_INPUT", "조문 번호를 알아볼 수 없습니다. 예: 제47조의2");
  const branch = m[2] ? Number(m[2]) : 0;
  return {
    jo: String(main).padStart(4, "0") + String(branch).padStart(2, "0"),
    label: `제${main}조${branch ? `의${branch}` : ""}`,
  };
}

/** 항·호·목 한 단계의 글을 모은다. (내용 칸 이름: 항내용, 호내용, 목내용) */
function collect(node: unknown, level: "항" | "호" | "목", out: string[]): void {
  const child = level === "항" ? "호" : level === "호" ? "목" : null;
  for (const item of asList(node)) {
    if (!isObj(item)) continue;
    for (const line of asList(item[`${level}내용`])) if (typeof line === "string" && line.trim()) out.push(line.trim());
    if (child) collect(item[child], child, out);
  }
}

/** 법령일련번호와 조문 번호로 조문 글을 가져온다. 조문이 없으면 null. (보내는 값: 법령일련번호, 조문 번호) */
export async function getArticle(rawMst: unknown, rawLabel: unknown): Promise<LawArticle | null> {
  const mst = typeof rawMst === "string" ? rawMst.trim() : "";
  if (!/^\d{1,12}$/.test(mst)) throw new LawError("BAD_INPUT", "법령 정보가 올바르지 않습니다. 법령을 다시 골라 주세요.");
  const { jo, label } = parseArticleLabel(rawLabel);

  const body = await lawRequest("lawService.do", { target: "law", MST: mst, JO: jo });
  if (!isObj(body) || !isObj(body["법령"])) throw new LawError("BAD_RESPONSE", "법제처 응답의 모양이 예상과 다릅니다.");
  const law = body["법령"];
  const unit = isObj(law["조문"]) ? asList(law["조문"]["조문단위"]).find(isObj) : undefined;
  if (!unit) return null; // 그 조문이 없다 — 추측하지 않고 "없음"

  const lines: string[] = [];
  const head = str(unit["조문내용"]).trim();
  if (head) lines.push(head);
  collect(unit["항"], "항", lines);

  const info = isObj(law["기본정보"]) ? law["기본정보"] : {};
  return {
    mst,
    lawName: str(info["법령명_한글"]),
    articleLabel: label,
    title: str(unit["조문제목"]),
    text: lines.join("\n"),
    effectiveDate: dateOf(unit["조문시행일자"]) || dateOf(info["시행일자"]),
    fetchedAt: new Date().toISOString(),
  };
}
