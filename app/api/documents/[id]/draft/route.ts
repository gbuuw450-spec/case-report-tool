// 올린 서류의 전문을 초안에 넣을지 정하는 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — PATCH /api/documents/[id]/draft
import { connection } from "next/server";
import { listDraftDocuments, listDraftPages, setDocumentInDraft } from "@/lib/store/documents";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: { code: "NOT_FOUND", message: "서류를 찾을 수 없습니다." } }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "BAD_REQUEST", message: "요청 내용을 읽을 수 없습니다." } }, { status: 400 });
  }
  const inDraft = (body as { inDraft?: unknown } | null)?.inDraft;
  if (typeof inDraft !== "boolean") {
    return Response.json({ error: { code: "BAD_REQUEST", message: "초안에 넣을지(true/false)를 알려 주세요." } }, { status: 400 });
  }
  try {
    if (!setDocumentInDraft(id, inDraft)) {
      return Response.json({ error: { code: "NOT_FOUND", message: "서류를 찾을 수 없습니다." } }, { status: 404 });
    }
    return Response.json({ documents: listDraftDocuments(), pages: listDraftPages() });
  } catch (error) {
    console.error("서류 전문 포함 여부를 바꾸지 못했습니다.", error);
    return Response.json({ error: { code: "STORE_ERROR", message: "바꾸지 못했습니다." } }, { status: 500 });
  }
}
