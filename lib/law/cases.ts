// 유사 선결정례(조세심판원 결정)와 판례 찾기 — 조사자가 입력한 검색어와 사례 번호만 법제처로 보낸다.
// 이 파일은 서류·검색·담은 원문 모듈을 불러오지 않는다.
import { lawRequest } from "./client";
import { cleanQuery } from "./laws";
import { LawError } from "./types";

/** decision: 조세심판원 결정(선결정례), precedent: 판례(대법원 등) */
export type CaseKind = "decision" | "precedent";

export interface CaseSummary {
  kind: CaseKind;
  id: string;
  title: string; // 사건명
  caseNo: string; // 청구번호(심판원) 또는 사건번호(판례)
  date: string; // 의결일 또는 선고일 (YYYY-MM-DD)
  org: string; // 조세심판원 / 법원명 또는 자료 출처
}

export interface CaseSection {
  label: string;
  text: string; // 법제처가 준 글 그대로 (줄바꿈 표시만 줄바꿈으로 바꿈)
}

export interface CaseDetail {
  kind: CaseKind;
  id: string;
  sections: CaseSection[];
  bodyAvailable: boolean; // 법제처가 이 사례의 본문을 이 방식으로는 주지 않으면 false
  webUrl: string | null; // 본문 없는 판례를 조사자가 직접 볼 수 있는 법제처 국가법령정보센터 주소
  fetchedAt: string;
}

const PAGE_SIZE = 20;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const asList = (v: unknown): unknown[] => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** 20230621 또는 2023.06.21 → 2023-06-21 */
function dateOf(v: unknown): string {
  const s = str(v).replace(/\D/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : "";
}

/** 법제처 글의 줄바꿈 표시(<br/>)를 줄바꿈으로 바꾸고 그 밖의 표시와 특수문자 표기를 풀어 읽을 수 있게 한다. */
export function cleanText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseKind(raw: unknown): CaseKind {
  if (raw === "decision" || raw === "precedent") return raw;
  throw new LawError("BAD_INPUT", "찾을 사례 종류를 골라 주세요.");
}

/** 검색어로 사례를 찾는다. (보내는 값: 검색어, 쪽 번호) */
export async function searchCases(
  rawKind: unknown,
  rawQuery: unknown,
  rawPage: unknown
): Promise<{ items: CaseSummary[]; total: number; page: number; pageSize: number }> {
  const kind = parseKind(rawKind);
  const query = cleanQuery(rawQuery);
  const page = Math.min(Math.max(Number.parseInt(str(rawPage) || "1", 10) || 1, 1), 50);
  const body = await lawRequest("lawSearch.do", {
    target: kind === "decision" ? "ttSpecialDecc" : "prec",
    query,
    display: String(PAGE_SIZE),
    page: String(page),
  });

  if (kind === "decision") {
    const root = isObj(body) ? body.Decc : undefined;
    if (!isObj(root)) throw new LawError("BAD_RESPONSE", "법제처 응답의 모양이 예상과 다릅니다.");
    const items = asList(root.decc)
      .filter(isObj)
      .map((d) => ({
        kind,
        id: str(d["특별행정심판재결례일련번호"]),
        title: str(d["사건명"]),
        caseNo: str(d["청구번호"]),
        date: dateOf(d["의결일자"]),
        org: str(d["재결청"]) || "조세심판원",
      }))
      .filter((c) => c.id);
    return { items, total: Number(str(root.totalCnt)) || items.length, page, pageSize: PAGE_SIZE };
  }

  const root = isObj(body) ? body.PrecSearch : undefined;
  if (!isObj(root)) throw new LawError("BAD_RESPONSE", "법제처 응답의 모양이 예상과 다릅니다.");
  const items = asList(root.prec)
    .filter(isObj)
    .map((p) => ({
      kind,
      id: str(p["판례일련번호"]),
      title: str(p["사건명"]),
      caseNo: str(p["사건번호"]),
      date: dateOf(p["선고일자"]),
      org: str(p["법원명"]) || str(p["데이터출처명"]),
    }))
    .filter((c) => c.id);
  return { items, total: Number(str(root.totalCnt)) || items.length, page, pageSize: PAGE_SIZE };
}

// 본문에서 보여 줄 칸과 순서
const DECISION_FIELDS = ["세목", "재결요지", "청구취지", "주문", "이유", "관련법령", "참조결정", "따른결정"];
const PRECEDENT_FIELDS = ["판시사항", "판결요지", "참조조문", "참조판례", "판례내용"];

/** 사례 한 건의 본문을 가져온다. (보내는 값: 사례 번호) */
export async function getCase(rawKind: unknown, rawId: unknown): Promise<CaseDetail> {
  const kind = parseKind(rawKind);
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!/^\d{1,12}$/.test(id)) throw new LawError("BAD_INPUT", "사례 번호가 올바르지 않습니다. 목록에서 다시 골라 주세요.");

  const body = await lawRequest("lawService.do", { target: kind === "decision" ? "ttSpecialDecc" : "prec", ID: id });
  const fetchedAt = new Date().toISOString();
  const webUrl = kind === "precedent" ? `https://www.law.go.kr/LSW/precInfoP.do?precSeq=${id}&mode=0` : null;

  const root = isObj(body) ? (kind === "decision" ? body.SpecialDeccService : body.PrecService) : undefined;
  if (!isObj(root)) {
    // 법제처가 이 판례의 본문을 이 방식으로는 주지 않는 경우(국세법령정보시스템 자료 등): 없는 것으로 표시한다.
    if (isObj(body) && typeof body.Law === "string") {
      return { kind, id, sections: [], bodyAvailable: false, webUrl, fetchedAt };
    }
    throw new LawError("BAD_RESPONSE", "법제처 응답의 모양이 예상과 다릅니다.");
  }

  const sections = (kind === "decision" ? DECISION_FIELDS : PRECEDENT_FIELDS)
    .map((label) => ({ label, text: cleanText(str(root[label])) }))
    .filter((s) => s.text);
  return { kind, id, sections, bodyAvailable: sections.length > 0, webUrl, fetchedAt };
}
