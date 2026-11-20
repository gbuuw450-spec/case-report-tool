"use client";

// 쪽 그림 보기: 저장된 원본 PDF의 한 쪽을 그림으로 보여 준다.
// Design Ref: §4.3 쪽 그림 보기 — 표 내용은 원본 그림으로 확인하도록 안내
// pdf.js와 보조 파일(일꾼 파일, 글자표, 기본 글꼴)은 모두 이 컴퓨터의 앱에서 받는다. (인터넷을 쓰지 않는다)
import { useEffect, useRef, useState } from "react";

interface Props {
  documentId: string;
  documentName: string;
  pageNo: number;
  onClose: () => void;
}

type ViewState = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string };

/** 화면에서 그림이 차지하는 배율 (1 = PDF 원래 크기) */
const VIEW_SCALE = 1.5;

export default function PageImageViewer({ documentId, documentName, pageNo, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  // Esc 키로 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // 원본 PDF를 불러와 해당 쪽을 canvas에 그린다.
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;

    (async () => {
      try {
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
        destroy = () => void task.destroy().catch(() => undefined);

        const pdf = await task.promise;
        const page = await pdf.getPage(pageNo);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // 화면 해상도가 높은 모니터에서도 선명하도록 실제 픽셀 수를 늘리고, 보이는 크기는 그대로 둔다.
        const ratio = window.devicePixelRatio || 1;
        const cssViewport = page.getViewport({ scale: VIEW_SCALE });
        const pixelViewport = page.getViewport({ scale: VIEW_SCALE * ratio });
        canvas.width = Math.floor(pixelViewport.width);
        canvas.height = Math.floor(pixelViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;

        await page.render({ canvas, viewport: pixelViewport }).promise;
        if (!cancelled) setState({ kind: "ready" });
      } catch (e) {
        if (!cancelled) {
          console.error("쪽 그림을 그리지 못했습니다.", e);
          setState({ kind: "error", message: "쪽 그림을 불러오지 못했습니다. 원본 파일을 직접 열어 확인해 주세요." });
        }
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [documentId, pageNo]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${documentName} ${pageNo}쪽 원본 그림`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">
            {documentName} · {pageNo}쪽 (원본 그림)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50"
          >
            닫기
          </button>
        </div>

        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          표 안의 글자는 칸 구분이 사라질 수 있으니, 표 내용은 이 원본 그림으로 확인하세요.
        </p>

        {state.kind === "loading" && <p className="text-sm text-zinc-500">원본 쪽을 불러오는 중…</p>}
        {state.kind === "error" && (
          <p role="alert" className="text-sm text-red-700">
            {state.message}
          </p>
        )}

        <div className="overflow-auto">
          <canvas ref={canvasRef} className="mx-auto border border-zinc-200" />
        </div>
      </div>
    </div>
  );
}
