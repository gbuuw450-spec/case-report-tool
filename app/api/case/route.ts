// 사건 전체 삭제 요청 — 올린 서류, 글자 변환 결과, 담은 원문, 담은 법령 조문, 저장소 파일을 모두 지운다.
// Design Ref: §7 서버 요청 목록 — DELETE /api/case
import { connection } from "next/server";
import { clearArticleCache } from "@/lib/law/articleCache";
import { deleteWholeCase } from "@/lib/store/caseDelete";

export async function DELETE(request: Request) {
  await connection();

  // 실수로 호출되지 않게, 삭제를 확인했다는 표시가 있어야만 지운다.
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // 아래에서 막는다.
  }
  if ((body as { confirm?: unknown } | null)?.confirm !== "DELETE_CASE") {
    return Response.json(
      { error: { code: "NOT_CONFIRMED", message: "삭제 확인이 없어 지우지 않았습니다." } },
      { status: 400 }
    );
  }

  try {
    const result = deleteWholeCase();
    clearArticleCache();
    return Response.json({ deleted: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("사건을 삭제하지 못했습니다.", error);
    return Response.json(
      { error: { code: "DELETE_ERROR", message: "사건을 모두 지우지 못했습니다. 다른 프로그램이 파일을 쓰고 있지 않은지 확인하고 다시 시도해 주세요." } },
      { status: 500 }
    );
  }
}
