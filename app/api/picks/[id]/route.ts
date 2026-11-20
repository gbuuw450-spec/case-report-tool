// 담은 원문을 수정하고(PATCH), 빼는(DELETE) 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — PATCH·DELETE /api/picks/:id
import { connection } from "next/server";
import { checkEdit } from "@/lib/pick/edit";
import { deletePick, getPickQuote, listPicks, setPickEditedText } from "@/lib/store/picks";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** 초안에서 수정한 글을 저장한다. 원문과 출처는 그대로 두고, editedText가 null이면 원문으로 되돌린다. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse(404, "NOT_FOUND", "담은 원문을 찾을 수 없습니다.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "올린 내용을 읽지 못했습니다.");
  }

  const quote = getPickQuote(id);
  if (quote === null) {
    return errorResponse(404, "NOT_FOUND", "담은 원문을 찾을 수 없습니다.");
  }

  const checked = checkEdit(quote, (body as { editedText?: unknown } | null)?.editedText);
  if (!checked.ok) {
    return errorResponse(400, checked.code, checked.message);
  }

  try {
    setPickEditedText(id, checked.value);
    return Response.json({ picks: listPicks() });
  } catch (error) {
    console.error("수정한 글을 저장하지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "수정한 글을 저장하지 못했습니다.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id) || !deletePick(id)) {
    return errorResponse(404, "NOT_FOUND", "담은 원문을 찾을 수 없습니다.");
  }
  return Response.json({ picks: listPicks() });
}
