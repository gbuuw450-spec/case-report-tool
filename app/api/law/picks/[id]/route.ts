// 담은 법령 조문을 빼는 요청 — 이 컴퓨터 안에서만 사용하고 법제처에 연결하지 않는다
// Design Ref: §7 서버 요청 목록 — DELETE /api/law/picks/[id]
import { connection } from "next/server";
import { deleteLawPick, listLawPicks } from "@/lib/store/lawPicks";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: { code: "BAD_REQUEST", message: "담은 법령 조문 번호가 올바르지 않습니다." } }, { status: 400 });
  }
  try {
    if (!deleteLawPick(id)) {
      return Response.json({ error: { code: "NOT_FOUND", message: "이미 빠졌거나 없는 법령 조문입니다." } }, { status: 404 });
    }
    return Response.json({ lawPicks: listLawPicks() });
  } catch (error) {
    console.error("법령 조문을 빼지 못했습니다.", error);
    return Response.json({ error: { code: "STORE_ERROR", message: "법령 조문을 빼지 못했습니다." } }, { status: 500 });
  }
}
