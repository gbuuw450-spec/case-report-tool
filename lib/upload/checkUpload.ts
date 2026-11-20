// 올리는 파일이 받을 수 있는 PDF인지 검사한다.
// Design Ref: §4.4 메인 화면 — PDF가 아니면 안내 문구, 한글 문서는 PDF로 저장해 올리도록 안내
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.

export type UploadCheck =
  | { ok: true }
  | { ok: false; code: "EMPTY" | "HANGUL" | "NOT_PDF" | "BROKEN_PDF"; message: string };

/** 안내 문구 (화면에 그대로 보인다) */
export const UPLOAD_MESSAGES = {
  EMPTY: "비어 있는 파일입니다. 내용이 있는 PDF 파일을 올려 주세요.",
  HANGUL: "한글 문서는 한글에서 PDF로 저장해 올려 주세요.",
  NOT_PDF: "PDF 파일만 올릴 수 있습니다.",
  BROKEN_PDF: "PDF 파일이 아니거나 손상된 파일입니다. 다시 저장해서 올려 주세요.",
} as const;

/** PDF 파일은 맨 앞이 "%PDF-"로 시작한다. */
function startsWithPdfMark(head: Uint8Array): boolean {
  const mark = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  if (head.length < mark.length) return false;
  return mark.every((byte, i) => head[i] === byte);
}

/**
 * 파일 이름, 맨 앞 몇 바이트, 크기로 올려도 되는 파일인지 판단한다.
 * - 한글 문서(.hwp, .hwpx): 쪽수를 알 수 없으므로 PDF로 저장해 올리게 안내
 * - PDF가 아닌 다른 형식: "PDF 파일만 올릴 수 있습니다."
 * - 이름은 .pdf인데 내용이 PDF가 아님: 손상 안내
 */
export function checkUpload(fileName: string, head: Uint8Array, size: number): UploadCheck {
  const lower = fileName.trim().toLowerCase();

  if (lower.endsWith(".hwp") || lower.endsWith(".hwpx")) {
    return { ok: false, code: "HANGUL", message: UPLOAD_MESSAGES.HANGUL };
  }
  if (!lower.endsWith(".pdf")) {
    return { ok: false, code: "NOT_PDF", message: UPLOAD_MESSAGES.NOT_PDF };
  }
  if (size === 0) {
    return { ok: false, code: "EMPTY", message: UPLOAD_MESSAGES.EMPTY };
  }
  if (!startsWithPdfMark(head)) {
    return { ok: false, code: "BROKEN_PDF", message: UPLOAD_MESSAGES.BROKEN_PDF };
  }
  return { ok: true };
}
