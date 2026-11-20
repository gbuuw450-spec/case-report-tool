// 증거 이름(갑 제1호증, 을 제1호증 등) 검사: 증거서류를 올릴 때 조사자가 직접 입력한 이름을 확인한다.
// Design Ref: PRD 5번 Must 1 — 증거서류는 올릴 때 증거 이름을 입력하고, 사실관계의 출처 표시에 쓴다.
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

/** 증거 이름 최대 길이 */
export const MAX_EVIDENCE_NAME_LENGTH = 50;

export type EvidenceNameCheck =
  | { ok: true; name: string }
  | { ok: false; code: "EVIDENCE_NAME_REQUIRED" | "EVIDENCE_NAME_TOO_LONG" | "EVIDENCE_NAME_INVALID"; message: string };

export const EVIDENCE_MESSAGES = {
  REQUIRED: "증거 이름(예: 갑 제1호증, 을 제1호증)을 입력해 주세요.",
  TOO_LONG: `증거 이름은 ${MAX_EVIDENCE_NAME_LENGTH}자까지 입력할 수 있습니다.`,
  INVALID: "증거 이름에 줄바꿈이나 특수 제어 문자를 쓸 수 없습니다.",
  DUPLICATE: "이미 사용한 증거 이름입니다. 다른 이름으로 입력해 주세요.",
} as const;

/** 앞뒤 공백을 없애고, 안쪽의 연속 공백은 하나로 줄인다. ("갑  제1호증 " → "갑 제1호증") */
function tidy(raw: string): string {
  return raw.trim().replace(/[ \t　]+/g, " ");
}

/** 증거 이름을 확인해 정리한 이름을 돌려준다. */
export function checkEvidenceName(raw: unknown): EvidenceNameCheck {
  if (typeof raw !== "string") {
    return { ok: false, code: "EVIDENCE_NAME_REQUIRED", message: EVIDENCE_MESSAGES.REQUIRED };
  }
  // 줄바꿈·제어 문자는 허용하지 않는다. (출처 표시와 저장 파일이 깨지지 않게)
  if (/[\u0000-\u001f\u007f]/.test(raw.replace(/[\t]/g, " "))) {
    return { ok: false, code: "EVIDENCE_NAME_INVALID", message: EVIDENCE_MESSAGES.INVALID };
  }
  const name = tidy(raw);
  if (name === "") {
    return { ok: false, code: "EVIDENCE_NAME_REQUIRED", message: EVIDENCE_MESSAGES.REQUIRED };
  }
  if (name.length > MAX_EVIDENCE_NAME_LENGTH) {
    return { ok: false, code: "EVIDENCE_NAME_TOO_LONG", message: EVIDENCE_MESSAGES.TOO_LONG };
  }
  return { ok: true, name };
}

/** 같은 이름인지 비교하는 키: 공백을 모두 없애고 소문자로 바꾼다. ("갑 제1호증"과 "갑제1호증"은 같다) */
export function evidenceNameKey(name: string): string {
  return name.replace(/\s/g, "").toLowerCase();
}
