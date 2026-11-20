// 올려 둔 원본 PDF를 내려주는 요청 — 쪽 그림을 그릴 때 화면이 이 컴퓨터에서 가져간다.
// Design Ref: §7 서버 요청 목록 — GET /api/documents/:id/file
import fs from "node:fs";
import { connection } from "next/server";
import { saveExport } from "@/lib/export/saveFile";
import { documentFilePath, listDocuments } from "@/lib/store/documents";

// 서류 번호는 저장할 때 만든 UUID 모양만 받는다. (경로를 건드리는 값이 들어오지 못하게)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "서류를 찾을 수 없습니다." } },
      { status: 404 }
    );
  }

  const filePath = documentFilePath(id);
  if (!fs.existsSync(filePath)) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "원본 PDF 파일을 찾을 수 없습니다." } },
      { status: 404 }
    );
  }

  const data = fs.readFileSync(filePath);
  const mode = new URL(request.url).searchParams;

  // 올린 원본을 다시 받는 기능: ?save=1은 이 컴퓨터의 exports 폴더에 저장하고, ?download=1은 브라우저 내려받기로 준다.
  const name = listDocuments().find((d) => d.id === id)?.name ?? "서류.pdf";
  const fileName = /.pdf$/i.test(name) ? name : `${name}.pdf`;
  if (mode.get("save") === "1") {
    const saved = saveExport(fileName, data);
    return Response.json({ savedPath: saved.path, fileName: saved.fileName }, { headers: { "Cache-Control": "no-store" } });
  }
  if (mode.get("download") === "1") {
    return new Response(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store", // 서류는 브라우저에 따로 남기지 않는다
    },
  });
}
