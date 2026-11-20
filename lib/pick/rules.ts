// 원문 담기 규칙: 어느 서류의 원문을 초안의 어느 항목에 담을 수 있는지 정한다.
// Design Ref: PRD 5번 Must 2 — 청구인 주장은 청구인 측 서류에서만, 처분청 의견은 처분청 측 서류에서만,
//             사실관계는 증거서류에서만 가져온다. 서로 섞지 않는다.
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

/** 초안의 항목: 청구인 주장 / 처분청 의견 / 사실관계 */
export type PickSection = "claimant" | "agency" | "facts";

export const PICK_SECTIONS: PickSection[] = ["claimant", "agency", "facts"];

export const SECTION_LABELS: Record<PickSection, string> = {
  claimant: "청구인 주장",
  agency: "처분청 의견",
  facts: "사실관계",
};

// 서류 구분(kind)별로 담을 수 있는 항목
const ALLOWED_BY_KIND: Record<string, PickSection[]> = {
  claimReason: ["claimant"], // 청구이유서(청구인 측) → 청구인 주장만
  claimantEvidence: ["claimant", "facts"], // 청구인 증거서류 → 청구인 주장, 사실관계
  answer: ["agency"], // 답변서(처분청 측) → 처분청 의견만
  agencyEvidence: ["agency", "facts"], // 처분청 증거서류 → 처분청 의견, 사실관계
};

// 서류 전문을 초안에 자동으로 넣을 때의 항목: 청구이유서→청구인 주장, 답변서→처분청 의견, 증거서류→사실관계
const AUTO_SECTION_BY_KIND: Record<string, PickSection> = {
  claimReason: "claimant",
  answer: "agency",
  claimantEvidence: "facts",
  agencyEvidence: "facts",
};

/** 올린 서류 전문이 자동으로 들어가는 초안 항목 (모르는 구분이면 null) */
export function autoSectionFor(kind: string): PickSection | null {
  return AUTO_SECTION_BY_KIND[kind] ?? null;
}

/** 이 구분의 서류에서 담을 수 있는 항목들 (모르는 구분이면 아무 데도 담을 수 없다) */
export function allowedSections(kind: string): PickSection[] {
  return ALLOWED_BY_KIND[kind] ?? [];
}

/** 이 서류의 원문을 이 항목에 담아도 되는지 */
export function canPick(kind: string, section: string): boolean {
  return (allowedSections(kind) as string[]).includes(section);
}

/** 담을 수 없을 때 보여 줄 안내 문구 */
export function notAllowedMessage(kindLabel: string, kind: string): string {
  const labels = allowedSections(kind).map((s) => SECTION_LABELS[s]);
  return labels.length === 0
    ? "이 서류의 원문은 담을 수 없습니다."
    : `${kindLabel}의 원문은 ${labels.join(", ")}에만 담을 수 있습니다.`;
}
