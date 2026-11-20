// 검색어로 유사 선결정례(조세심판원 결정)·판례를 찾는 요청 — 서버가 법제처에 연결한다 (검색어와 쪽 번호만 보냄)
// Design Ref: §7 서버 요청 목록 — GET /api/law/cases
import { connection } from "next/server";
import { searchCases } from "@/lib/law/cases";
import { lawErrorResponse } from "@/lib/law/respond";

export async function GET(request: Request) {
  await connection();
  try {
    const p = new URL(request.url).searchParams;
    const result = await searchCases(p.get("kind"), p.get("q"), p.get("page"));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return lawErrorResponse(error, "유사 사례를");
  }
}
