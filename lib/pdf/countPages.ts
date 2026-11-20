// PDF의 쪽수를 센다. (pdf.js를 이 컴퓨터에서 실행하며 인터넷을 쓰지 않는다)
// Design Ref: §5.1 서류 올리기와 텍스트화 — 쪽수 합계 계산
// 다른 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type CountResult =
  | { ok: true; pages: number }
  | { ok: false; code: "ENCRYPTED" | "BROKEN"; message: string };

export const COUNT_MESSAGES = {
  ENCRYPTED: "암호가 걸린 PDF는 올릴 수 없습니다. 암호를 해제해서 다시 저장한 뒤 올려 주세요.",
  BROKEN: "PDF를 읽을 수 없습니다. 파일이 손상되었을 수 있으니 다시 저장해서 올려 주세요.",
} as const;

/** 올린 PDF의 쪽수를 돌려준다. 읽을 수 없으면 이유와 안내 문구를 돌려준다. */
export async function countPdfPages(data: Uint8Array): Promise<CountResult> {
  // pdf.js는 넘겨받은 데이터를 가져가 쓰므로, 원본이 바뀌지 않게 복사본을 준다.
  const task = getDocument({
    data: data.slice(),
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    const pages = pdf.numPages;
    if (!Number.isInteger(pages) || pages < 1) {
      return { ok: false, code: "BROKEN", message: COUNT_MESSAGES.BROKEN };
    }
    return { ok: true, pages };
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "PasswordException") {
      return { ok: false, code: "ENCRYPTED", message: COUNT_MESSAGES.ENCRYPTED };
    }
    return { ok: false, code: "BROKEN", message: COUNT_MESSAGES.BROKEN };
  } finally {
    // 다 쓴 PDF를 메모리에서 내린다. 정리 중 오류가 나도 쪽수 결과에는 영향을 주지 않는다.
    await task.destroy().catch(() => undefined);
  }
}
