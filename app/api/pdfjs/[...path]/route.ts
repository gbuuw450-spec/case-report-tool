// 쪽 그림을 그리는 pdf.js가 쓰는 보조 파일(일꾼 파일, 한글 글자표, 기본 글꼴)을
// 설치된 pdf.js 폴더에서 내려준다. 외부 주소(CDN)를 쓰지 않고 인터넷 없이도 그려지게 하기 위함이다.
// Design Ref: §3 기술 선택 — 앱 안에 둘 파일, §9 보안 — 실행 중 외부 연결 없음
import fs from "node:fs";
import path from "node:path";
import { connection } from "next/server";

const PDFJS_DIR = path.join(process.cwd(), "node_modules", "pdfjs-dist");

// 내려줄 수 있는 파일은 아래 세 가지뿐이다. (그 밖의 경로는 거절)
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function resolveAsset(segments: string[]): { file: string; type: string } | null {
  // 일꾼 파일: /api/pdfjs/worker
  if (segments.length === 1 && segments[0] === "worker") {
    return {
      file: path.join(PDFJS_DIR, "legacy", "build", "pdf.worker.mjs"),
      type: "text/javascript",
    };
  }
  if (segments.length === 2 && SAFE_NAME.test(segments[1])) {
    // 한글 글자표: /api/pdfjs/cmaps/<이름>.bcmap
    if (segments[0] === "cmaps" && segments[1].endsWith(".bcmap")) {
      return {
        file: path.join(PDFJS_DIR, "cmaps", segments[1]),
        type: "application/octet-stream",
      };
    }
    // 기본 글꼴: /api/pdfjs/standard_fonts/<이름>
    if (segments[0] === "standard_fonts" && /\.(pfb|ttf)$/.test(segments[1])) {
      return {
        file: path.join(PDFJS_DIR, "standard_fonts", segments[1]),
        type: "application/octet-stream",
      };
    }
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
