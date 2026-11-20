// 글자가 든 PDF에서 쪽별 글자를 꺼낸다. (pdf.js를 이 컴퓨터에서 실행하며 인터넷을 쓰지 않는다)
// Design Ref: §5.1 서류 올리기와 텍스트화 — 쪽마다 글자가 있으면 그대로 저장
// 글자가 없는 쪽(스캔 PDF)은 빈 글자로 돌려주고, 글자 인식(OCR)은 다음 작업에서 처리한다.
// 다른 프로젝트 파일을 불러오지 않는 독립 함수라서 따로 실행해 시험할 수 있다.
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface ExtractedPage {
  pageNo: number; // 1부터 시작
  text: string; // 원문 그대로 (요약하거나 고치지 않는다)
}

// 한글 글자표(cmaps)와 기본 글꼴은 설치된 pdf.js 폴더에서 읽는다. (외부 주소를 쓰지 않는다)
const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist");

/** pdf.js가 요구하는 형식(슬래시로 끝나는 경로)으로 폴더 주소를 만든다. Windows의 \ 도 /로 바꾼다. */
function folderUrl(name: string): string {
  return path.join(PDFJS_DIR, name).replaceAll("\\", "/") + "/";
}

/**
 * PDF의 모든 쪽에서 글자를 꺼내 쪽 순서대로 돌려준다.
 * 읽을 수 없으면 오류를 던진다. 호출한 쪽에서 '변환 실패'로 처리한다.
 */
export async function extractPageTexts(data: Uint8Array): Promise<ExtractedPage[]> {
  const task = getDocument({
    data: data.slice(), // pdf.js가 데이터를 가져가 쓰므로 복사본을 준다
    cMapUrl: folderUrl("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: folderUrl("standard_fonts"),
    useSystemFonts: false,
    verbosity: 0,
  });

  try {
    const pdf = await task.promise;
    const pages: ExtractedPage[] = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();

      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue; // 글자가 아닌 표시 정보는 건너뛴다
        text += item.str;
        if (item.hasEOL) text += "\n"; // 줄이 끝나는 곳은 줄바꿈으로 둔다
      }

      pages.push({ pageNo, text: text.replace(/\s+$/, "") });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
