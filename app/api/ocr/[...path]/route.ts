// 글자 인식(OCR)에 쓰는 파일(일꾼 파일, 인식 엔진, 한국어 학습 데이터)을
// 설치된 패키지 폴더에서 내려준다. 외부 주소(CDN)를 쓰지 않고 인터넷 없이도 인식되게 하기 위함이다.
// Design Ref: §3 기술 선택 — tesseract.js + 한국어 데이터를 앱 안에 둔다, §9 보안 — 실행 중 외부 연결 없음
import fs from "node:fs";
import path from "node:path";
import { connection } from "next/server";

const MODULES = path.join(process.cwd(), "node_modules");

// 인식 엔진 파일 이름은 이 모양만 받는다. (tesseract-core-simd-lstm.wasm.js 등)
const CORE_NAME = /^tesseract-core[a-z-]*\.wasm(\.js)?$/;

function resolveAsset(segments: string[]): { file: string; type: string } | null {
  // 일꾼 파일: /api/ocr/worker
  if (segments.length === 1 && segments[0] === "worker") {
    return {
      file: path.join(MODULES, "tesseract.js", "dist", "worker.min.js"),
      type: "text/javascript",
    };
  }
  // 인식 엔진: /api/ocr/core/<이름>
  if (segments.length === 2 && segments[0] === "core" && CORE_NAME.test(segments[1])) {
    return {
      file: path.join(MODULES, "tesseract.js-core", segments[1]),
      type: segments[1].endsWith(".wasm") ? "application/wasm" : "text/javascript",
    };
  }
  // 한국어 학습 데이터: /api/ocr/lang/kor.traineddata.gz (정확도가 높은 best 모델을 정수로 줄인 것)
  if (segments.length === 2 && segments[0] === "lang" && segments[1] === "kor.traineddata.gz") {
    return {
      file: path.join(MODULES, "@tesseract.js-data", "kor", "4.0.0_best_int", "kor.traineddata.gz"),
      type: "application/gzip",
    };
  }
  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  await connection();
  const { path: segments } = await context.params;

  const asset = resolveAsset(segments);
  // 파일 경로는 위의 resolveAsset이 허용한 세 가지 모양만 만든다. (turbopackIgnore: 빌드 때 프로젝트 전체를 훑지 않게 하는 표시)
  if (!asset || !fs.existsSync(/*turbopackIgnore: true*/ asset.file)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(fs.readFileSync(/*turbopackIgnore: true*/ asset.file), {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "public, max-age=31536000, immutable", // 바뀌지 않는 파일이라 오래 보관
    },
  });
}
