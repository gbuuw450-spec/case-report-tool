// 법령일련번호와 조문 번호로 조문 글을 가져오는 요청 — 서버가 법제처에 연결한다 (두 값만 보냄)
// Design Ref: §7 서버 요청 목록 — GET /api/law/article
import { connection } from "next/server";
import { rememberArticle } from "@/lib/law/articleCache";
import { getArticle } from "@/lib/law/laws";
import { lawErrorResponse } from "@/lib/law/respond";

export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const article = await getArticle(params.get("mst"), params.get("jo"));
    if (!article) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "법제처에서 그 조문을 찾지 못했습니다. 조문 번호를 확인해 주세요." } },
        { status: 404 }
      );
    }
    // 담을 때 쓰는 번호표를 함께 준다. (담기는 글은 서버가 기억한 이 조문 그대로)
    return Response.json({ article, token: rememberArticle(article) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return lawErrorResponse(error);
  }
}
