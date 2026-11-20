// 초안에 서류 전문으로 들어가는 서류 목록과 쪽별 글을 돌려주는 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — GET /api/draft/documents
import { connection } from "next/server";
import { listDraftDocuments, listDraftPages } from "@/lib/store/documents";

export async function GET() {
  await connection();
  try {
    return Response.json({ documents: listDraftDocuments(), pages: listDraftPages() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("초안의 서류 전문을 읽지 못했습니다.", error);
    return Response.json({ error: { code: "STORE_ERROR", message: "초안의 서류 전문을 불러오지 못했습니다." } }, { status: 500 });
  }
}
