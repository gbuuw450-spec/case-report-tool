// 글자 인식(OCR) 실행: 브라우저에서 글자 없는 쪽을 그림으로 그려 글자를 읽고, 쪽마다 서버에 저장한다.
// Design Ref: §5.1 서류 올리기와 텍스트화 — 스캔 쪽은 그림으로 만들어 글자 인식, 쪽 단위로 저장(중단돼도 이어서 처리)
// pdf.js와 tesseract.js, 한국어 학습 데이터는 모두 이 컴퓨터의 앱에서 받는다. (인터넷을 쓰지 않는다)
import { buildPageText } from "./buildPageText";

export interface OcrProgress {
  done: number; // 처리를 마친 쪽 수 (실패 포함)
  total: number; // 처리할 전체 쪽 수
  failed: number; // 인식에 실패한 쪽 수
  currentPage: number; // 지금 처리 중인 쪽 번호
}

export interface OcrSummary {
  done: number;
  failed: number;
  stopped: boolean; // 중간에 멈췄는지
}

/** 글자 인식에 쓰는 그림의 최대 한 변 길이(픽셀). 너무 크면 느려지고 메모리를 많이 쓴다. */
const MAX_SIDE_PX = 3200;
/** 인식 정확도를 위한 기본 배율 (1 = PDF 원래 크기, 3 ≈ 216dpi) */
const BASE_SCALE = 3;

async function savePage(
  documentId: string,
  page: { pageNo: number; text: string; uncertain: { start: number; end: number }[]; failed: boolean }
): Promise<void> {
  const res = await fetch(`/api/documents/${documentId}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(page),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "글자 인식 결과를 저장하지 못했습니다.");
  }
}

/**
 * 서류의 pageNos 쪽을 글자 인식한다. 쪽마다 결과를 바로 저장하고 진행 상황을 알린다.
 * 한 쪽이 실패해도 멈추지 않고 그 쪽을 "인식 실패"로 기록한 뒤 다음 쪽으로 간다.
 */
export async function runOcr(
  documentId: string,
  pageNos: number[],
  onProgress: (progress: OcrProgress) => void,
  shouldStop: () => boolean = () => false
): Promise<OcrSummary> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdfjs/worker";

  const task = pdfjs.getDocument({
    url: `/api/documents/${documentId}/file`,
    cMapUrl: "/api/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/api/pdfjs/standard_fonts/",
    useSystemFonts: false,
    verbosity: 0,
  });

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("kor", 1, {
    workerPath: "/api/ocr/worker",
    corePath: "/api/ocr/core",
    langPath: "/api/ocr/lang",
    workerBlobURL: false, // 일꾼 파일을 이 앱 주소에서 그대로 불러온다
    cacheMethod: "none", // 학습 데이터를 브라우저 저장소에 따로 남기지 않는다
    gzip: true,
    // 인식 도구의 진행 상황과 오류를 콘솔에 남긴다. (서류 내용은 남기지 않는다)
    logger: (m) => console.debug("[글자 인식]", m.status, Math.round(m.progress * 100) + "%"),
    errorHandler: (err) => console.error("[글자 인식 오류]", err),
  });

  let done = 0;
  let failed = 0;
  let stopped = false;
  const canvas = document.createElement("canvas");

  try {
    console.debug("[글자 인식] 원본 PDF 여는 중");
    const pdf = await task.promise;
    console.debug("[글자 인식] 원본 PDF 열림", pdf.numPages + "쪽");

    for (const pageNo of pageNos) {
      if (shouldStop()) {
        stopped = true;
        break;
      }
      onProgress({ done, total: pageNos.length, failed, currentPage: pageNo });

      let result: { text: string; uncertain: { start: number; end: number }[]; failed: boolean };
      try {
        const page = await pdf.getPage(pageNo);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(BASE_SCALE, MAX_SIDE_PX / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        console.debug(`[글자 인식] ${pageNo}쪽 그림 그리는 중`, canvas.width + "x" + canvas.height);
        // intent "print": 화면 갱신 신호(requestAnimationFrame)를 기다리지 않는 방식으로 그린다.
        // 창이 가려지거나 다른 창으로 옮겨져도 글자 인식이 멈추지 않게 하기 위함이다.
        await page.render({ canvas, viewport, intent: "print" }).promise;

        console.debug(`[글자 인식] ${pageNo}쪽 글자 읽는 중`);
        const { data } = await worker.recognize(canvas, {}, { blocks: true });
        const built = buildPageText(data.blocks);
        result = { text: built.text, uncertain: built.uncertain, failed: built.text.trim() === "" };
        page.cleanup();
      } catch (error) {
        console.error(`${pageNo}쪽 글자 인식에 실패했습니다.`, error);
        result = { text: "", uncertain: [], failed: true };
      }

      await savePage(documentId, { pageNo, ...result });
      done++;
      if (result.failed) failed++;
    }
    onProgress({ done, total: pageNos.length, failed, currentPage: 0 });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await worker.terminate().catch(() => undefined);
    await task.destroy().catch(() => undefined);
  }
  return { done, failed, stopped };
}
