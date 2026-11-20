// 사건조사서 작성 툴 — 저장소에서 쓰는 공통 타입과 상수
// Design Ref: §6 데이터 모델
import type { PickSection } from "../pick/rules";

export type { PickSection };

/** 한 사건에 올릴 수 있는 서류의 쪽수 합계 상한 (PRD 6번 분량 제한) */
export const MAX_TOTAL_PAGES = 100;

/** 서류 구분 (올릴 때 조사자가 직접 고른다) */
export const DOCUMENT_KINDS = [
  "claimReason",
  "answer",
  "claimantEvidence",
  "agencyEvidence",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** 화면에 보여 줄 구분 이름 */
export const KIND_LABELS: Record<DocumentKind, string> = {
  claimReason: "청구이유서",
  answer: "답변서",
  claimantEvidence: "청구인 증거서류",
  agencyEvidence: "처분청 증거서류",
};

/** 구분별 소속 (청구인 측 / 처분청 측) */
export const KIND_SIDE: Record<DocumentKind, "청구인 측" | "처분청 측"> = {
  claimReason: "청구인 측",
  claimantEvidence: "청구인 측",
  answer: "처분청 측",
  agencyEvidence: "처분청 측",
};

/** 증거서류 구분: 올릴 때 증거 이름(갑 제1호증 등)을 입력해야 한다. */
export const EVIDENCE_KINDS: readonly DocumentKind[] = ["claimantEvidence", "agencyEvidence"];

export function isEvidenceKind(kind: string): boolean {
  return (EVIDENCE_KINDS as readonly string[]).includes(kind);
}

/** 출처 표시용 서류 이름: 증거서류는 "갑 제1호증 (파일이름.pdf)", 그 밖은 파일 이름 */
export function sourceLabel(documentName: string, evidenceName: string | null): string {
  return evidenceName ? `${evidenceName} (${documentName})` : documentName;
}

/** 서류 처리 상태 */
// done: 모든 쪽에 글자가 있음 / partial: 글자가 없는 쪽이 있음(글자 인식 필요) / error: 변환 실패
export type DocumentStatus = "pending" | "processing" | "done" | "partial" | "error";

export interface CaseInfo {
  id: number;
  name: string;
  createdAt: string;
}

export interface DocumentInfo {
  id: string;
  kind: DocumentKind;
  name: string;
  evidenceName: string | null; // 증거 이름 (갑 제1호증 등, 증거서류만)
  pageCount: number;
  status: DocumentStatus;
  emptyPageCount: number; // 글자 인식이 필요한 쪽 수 (글자가 없고 아직 인식을 시도하지 않은 쪽)
  failedPageCount: number; // 글자 인식에 실패한 쪽 수 ("인식 실패 n쪽")
  ocrPageCount: number; // 글자 인식(OCR)으로 글자를 읽은 쪽 수 (오인식이 있을 수 있는 쪽)
  createdAt: string;
}

/** 쪽별 글자 (원문 그대로 저장한다) */
export interface PageText {
  documentId: string;
  pageNo: number; // 1부터 시작
  text: string;
  usedOcr: boolean; // 스캔 PDF라서 글자 인식을 거쳤는지
  uncertain: { start: number; end: number }[]; // "[인식 불확실]" 구간
  failed: boolean; // 인식 실패 쪽
}

/** 조사자가 골라 담은 원문 (초안의 재료). 항목 구분(PickSection)과 담기 규칙은 lib/pick/rules.ts에 있다. */
export interface Pick {
  id: string;
  section: PickSection;
  documentId: string;
  documentName: string; // 출처 표시용 문서 이름
  evidenceName: string | null; // 출처 서류의 증거 이름 (증거서류만)
  kind: DocumentKind; // 출처 서류의 구분
  pageNo: number;
  quote: string; // 원문 그대로
  uncertain: { start: number; end: number }[]; // quote 안에서 글자 인식이 불확실한 구간
  editedText: string | null; // 초안에서 수정한 글 (없으면 quote 그대로 쓴다. quote는 수정해도 바뀌지 않는다)
  order: number;
}

/** 화면에 한 번에 보여 줄 사건 요약 */
export interface CaseSummary {
  case: CaseInfo;
  documents: DocumentInfo[];
  totalPages: number;
  maxPages: number;
}

/** 초안의 "관계 법령"에 담은 법령 조문. 법제처가 준 글 그대로이며 수정할 수 없고 뺄 수만 있다. */
export interface LawPick {
  id: string;
  lawName: string;
  articleLabel: string; // 예: 제47조의2
  title: string;
  text: string;
  effectiveDate: string; // 조문 시행일 (YYYY-MM-DD)
  fetchedAt: string; // 가져온 시각 (ISO)
  order: number;
}

/** 초안에 서류 전문으로 자동 포함되는 한 쪽의 글 (원문 그대로) */
export interface DraftPage {
  documentId: string;
  documentName: string;
  evidenceName: string | null;
  kind: DocumentKind;
  pageNo: number;
  text: string;
  uncertain: boolean; // 글자 인식이 불확실한 부분이 있는 쪽
}

/** 초안 화면에서 서류 전문의 포함 여부를 보여 주고 바꾸기 위한 서류 한 건 */
export interface DraftDocument {
  id: string;
  name: string;
  evidenceName: string | null;
  kind: DocumentKind;
  pageCount: number;
  inDraft: boolean;
  emptyPageCount: number; // 글자가 없어 초안에 들어가지 못한 쪽
}
