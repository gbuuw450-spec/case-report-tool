// 법제처 국가법령정보 공동활용 Open API에 연결하는 유일한 곳 (서버에서만 쓴다)
// Design Ref: §5.5 법령 조문 찾기 — 법제처로 나가는 값은 조사자가 입력한 값뿐이고, 인증 값은 서버에서만 읽는다.
import { LawError } from "./types";

const BASE = "https://www.law.go.kr/DRF/";
const TIMEOUT_MS = 8000;

/** 법제처에 보낼 수 있는 요청 종류. 다른 주소는 만들 수 없다. */
type Endpoint = "lawSearch.do" | "lawService.do";

/** 요청에 실을 수 있는 값은 이 칸들뿐이다. (서류에서 나온 값을 실을 자리가 없다) */
export interface LawParams {
  target: "law" | "prec" | "ttSpecialDecc";
  query?: string; // 조사자가 입력한 검색어
  MST?: string; // 법령일련번호
  ID?: string; // 사례 일련번호
  JO?: string; // 조문 번호 6자리
  display?: string; // 한 번에 받을 건수
  page?: string; // 쪽 번호
}

function readKey(): string {
  const key = process.env.LAW_API_KEY?.trim();
  if (!key) throw new LawError("NOT_CONFIGURED", "법제처 인증 값(LAW_API_KEY)이 비어 있습니다.");
  return key;
}

/** 법제처에 요청하고 JSON을 돌려준다. 주소·오류 글에는 인증 값을 남기지 않는다. */
export async function lawRequest(endpoint: Endpoint, params: LawParams): Promise<unknown> {
  const key = readKey();
  const url = new URL(BASE + endpoint);
  const search = new URLSearchParams({ OC: key, type: "JSON" });
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) search.set(name, value);
  }
  url.search = search.toString();

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    // e에는 주소(인증 값 포함)가 들어 있을 수 있어, 원인 종류만 보고 글은 새로 쓴다.
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new LawError("TIMEOUT", "법제처가 제시간에 응답하지 않았습니다.");
    }
    throw new LawError("NETWORK", "법제처에 연결하지 못했습니다.");
  }

  if (!res.ok) throw new LawError("BAD_RESPONSE", `법제처가 오류(${res.status})를 돌려주었습니다.`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // 인증 실패·등록되지 않은 접속 위치 등은 JSON이 아니라 안내 글이나 HTML로 온다.
    throw new LawError("AUTH", "법제처가 요청을 받아들이지 않았습니다. 인증 값과 접속 허용 설정을 확인해 주세요.");
  }
}
