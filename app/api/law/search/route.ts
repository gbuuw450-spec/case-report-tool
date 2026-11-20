// 법령명으로 법제처에서 법령을 찾는 요청 — 서버가 법제처에 연결한다 (법령명만 보냄)
// Design Ref: §7 서버 요청 목록 — GET /api/law/search
import { connection } from "next/server";
import { searchLaws } from "@/lib/law/laws";
import { lawErrorResponse } from "@/lib/law/respond";

export async function GET(request: Request) {
  await connection();
  try {
    const laws = await searchLaws(new URL(request.url).searchParams.get("q"));
    return Response.json({ laws }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return lawErrorResponse(error);
  }
}
