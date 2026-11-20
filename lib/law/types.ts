// 법제처 연결 모듈이 화면·다른 모듈에 돌려주는 값의 모양
// 이 폴더(lib/law)는 서류·검색·담은 원문 모듈을 불러오지 않는다.

/** 법제처 연결에 실패한 이유 (화면에는 이 코드에 맞는 안내만 보인다) */
export type LawErrorCode =
  | "NOT_CONFIGURED" // LAW_API_KEY가 비어 있음
  | "NETWORK" // 인터넷이 없거나 연결 실패
  | "TIMEOUT" // 시간 안에 응답이 없음
  | "AUTH" // 인증 값이 거절됨(등록 안 된 값·접속 위치 등)
  | "BAD_RESPONSE" // 응답 모양이 예상과 다름
  | "BAD_INPUT"; // 입력값이 올바르지 않음

export class LawError extends Error {
  constructor(
    public code: LawErrorCode,
    message: string
  ) {
    super(message);
  }
}

export interface LawSummary {
  mst: string; // 법령일련번호 (조문 조회에 쓴다)
  lawId: string; // 법령ID
  name: string; // 법령명
  kind: string; // 법률, 대통령령 등
  ministry: string; // 소관부처
  effectiveDate: string; // 시행일자 (YYYY-MM-DD)
  promulgationDate: string; // 공포일자 (YYYY-MM-DD)
}

export interface LawArticle {
  mst: string;
  lawName: string;
  articleLabel: string; // 예: 제47조의2
  title: string; // 조문 제목
  text: string; // 조문 글 (제목 줄, 항, 호, 목을 줄바꿈으로 이은 것. 법제처가 준 글 그대로)
  effectiveDate: string; // 조문 시행일 (YYYY-MM-DD)
  fetchedAt: string; // 가져온 시각 (ISO)
}
