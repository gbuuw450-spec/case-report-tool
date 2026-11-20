// 초안에서 담은 원문을 수정할 때의 규칙: 원문은 그대로 보관하고, 수정본만 따로 저장한다.
// Design Ref: PRD 5번 Must 2 — 수정해도 원문은 따로 보관하고 수정한 문장에는 "수정됨"을 표시한다. 출처는 그대로 유지한다.
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

/** 수정한 글의 최대 길이 (담을 수 있는 원문 최대 길이의 두 배) */
export const MAX_EDITED_LENGTH = 4_000;

export type EditCheck =
  | { ok: true; value: string | null } // null이면 "수정하지 않음"(원문 그대로)
  | { ok: false; code: "EDIT_EMPTY" | "EDIT_TOO_LONG" | "EDIT_INVALID" | "EDIT_BAD_TYPE"; message: string };

export const EDIT_MESSAGES = {
  EMPTY: "빈 글은 저장할 수 없습니다. 이 원문을 초안에서 빼려면 [빼기]를 눌러 주세요.",
  TOO_LONG: `수정한 글은 ${MAX_EDITED_LENGTH}자까지 저장할 수 있습니다.`,
  INVALID: "수정한 글에 쓸 수 없는 제어 문자가 들어 있습니다.",
  BAD_TYPE: "수정한 글이 올바르지 않습니다.",
} as const;

/**
 * 수정한 글을 확인해 저장할 값을 돌려준다.
 * - null(또는 값 없음): 수정을 취소하고 원문으로 되돌린다.
 * - 원문과 똑같은 글: 수정하지 않은 것으로 본다. ("수정됨"이 붙지 않는다)
 * - 그 밖: 줄바꿈을 \n으로 통일하고 앞뒤 공백을 없앤 글을 수정본으로 저장한다.
 */
export function checkEdit(quote: string, input: unknown): EditCheck {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") {
    return { ok: false, code: "EDIT_BAD_TYPE", message: EDIT_MESSAGES.BAD_TYPE };
  }

  const text = input.replace(/\r\n?/g, "\n").trim();
  if (text === "") {
    return { ok: false, code: "EDIT_EMPTY", message: EDIT_MESSAGES.EMPTY };
  }
  // 줄바꿈과 탭은 허용하고, 그 밖의 제어 문자는 막는다.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    return { ok: false, code: "EDIT_INVALID", message: EDIT_MESSAGES.INVALID };
  }
  if (text.length > MAX_EDITED_LENGTH) {
    return { ok: false, code: "EDIT_TOO_LONG", message: EDIT_MESSAGES.TOO_LONG };
  }
  if (text === quote.replace(/\r\n?/g, "\n").trim()) return { ok: true, value: null };
  return { ok: true, value: text };
}

/** 초안에 쓸 글: 수정본이 있으면 수정본, 없으면 원문 */
export function currentText(quote: string, editedText: string | null): string {
  return editedText ?? quote;
}
