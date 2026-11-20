// 담은 법령 조문 목록(GET)과 담기(POST) — 이 컴퓨터 안에서만 사용하고 법제처에 연결하지 않는다
// Design Ref: §7 서버 요청 목록 — GET·POST /api/law/picks
import { connection } from "next/server";
import { recallArticle } from "@/lib/law/articleCache";
import { addLawPick, listLawPicks } from "@/lib/store/lawPicks";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET() {
  await connection();
  try {
    return Response.json({ lawPicks: listLawPicks() });
  } catch (error) {
    console.error("담은 법령 조문을 읽지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "담은 법령 조문을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  await connection();
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "BAD_REQUEST", "요청 내용을 읽을 수 없습니다.");
    }
    // 글은 받지 않고, 방금 가져온 조문의 번호표만 받는다. (글을 바꿔 담을 수 없다)
    const article = recallArticle((body as { token?: unknown } | null)?.token);
    if (!article) {
      return errorResponse(410, "EXPIRED", "가져온 조문이 만료되었습니다. 조문 보기를 다시 눌러 주세요.");
    }
    const id = addLawPick(article);
    if (id === null) {
      return errorResponse(409, "DUPLICATE", "이미 관계 법령에 담은 조문입니다.");
    }
    return Response.json({ lawPicks: listLawPicks() }, { status: 201 });
  } catch (error) {
    console.error("법령 조문을 담지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "법령 조문을 담지 못했습니다.");
  }
}
