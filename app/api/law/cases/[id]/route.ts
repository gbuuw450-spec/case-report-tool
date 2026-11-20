// 사례 한 건의 본문을 가져오는 요청 — 서버가 법제처에 연결한다 (사례 번호만 보냄)
// Design Ref: §7 서버 요청 목록 — GET /api/law/cases/[id]
import { connection } from "next/server";
import { getCase } from "@/lib/law/cases";
import { lawErrorResponse } from "@/lib/law/respond";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await context.params;
    const detail = await getCase(new URL(request.url).searchParams.get("kind"), id);
    return Response.json({ detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return lawErrorResponse(error, "유사 사례를");
  }
}
