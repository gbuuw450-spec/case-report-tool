// 글자 인식이 필요한 쪽 번호를 알려 주고(GET), 인식한 쪽 글자를 저장하는(POST) 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — POST /api/documents/:id/pages (화면에서 인식한 글자를 저장)
import { connection } from "next/server";
import {
  documentExists,
  listDocuments,
  listPageNosNeedingOcr,
  saveOcrPage,
} from "@/lib/store/documents";

// 서류 번호는 저장할 때 만든 UUID 모양만 받는다.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 100_000; // 한 쪽 글자 수 상한
const MAX_UNCERTAIN = 5_000; // 한 쪽 불확실 구간 수 상한

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id) || !documentExists(id)) {
    return errorResponse(404, "NOT_FOUND", "서류를 찾을 수 없습니다.");
  }
  return Response.json({ pageNos: listPageNosNeedingOcr(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id) || !documentExists(id)) {
    return errorResponse(404, "NOT_FOUND", "서류를 찾을 수 없습니다.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "올린 내용을 읽지 못했습니다.");
  }

  const { pageNo, text, uncertain, failed } = (body ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(pageNo) || (pageNo as number) < 1) {
    return errorResponse(400, "BAD_PAGE", "쪽 번호가 올바르지 않습니다.");
  }
  if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
    return errorResponse(400, "BAD_TEXT", "쪽 글자가 올바르지 않습니다.");
  }

  // 글자가 하나도 없으면 인식 실패로 기록한다. (빈 쪽을 '완료'로 넘기지 않는다)
  const isFailed = failed === true || text.trim() === "";
  const savedText = isFailed ? "" : text;

  // 불확실 구간은 글자 안의 올바른 범위만 받는다.
  const ranges: { start: number; end: number }[] = [];
  if (!isFailed && uncertain !== undefined) {
    if (!Array.isArray(uncertain) || uncertain.length > MAX_UNCERTAIN) {
      return errorResponse(400, "BAD_UNCERTAIN", "인식 불확실 구간이 올바르지 않습니다.");
    }
    for (const r of uncertain as Array<{ start?: unknown; end?: unknown }>) {
      if (
        !Number.isInteger(r?.start) ||
        !Number.isInteger(r?.end) ||
        (r.start as number) < 0 ||
        (r.end as number) <= (r.start as number) ||
        (r.end as number) > savedText.length
      ) {
        return errorResponse(400, "BAD_UNCERTAIN", "인식 불확실 구간이 올바르지 않습니다.");
      }
      ranges.push({ start: r.start as number, end: r.end as number });
    }
  }

  try {
    const saved = saveOcrPage(id, {
      pageNo: pageNo as number,
      text: savedText,
      uncertain: ranges,
      failed: isFailed,
    });
    if (!saved) {
      return errorResponse(409, "NOT_SAVED", "이 쪽은 이미 글자가 있거나 없는 쪽이라 저장하지 않았습니다.");
    }
    const document = listDocuments().find((d) => d.id === id);
    return Response.json({ saved: true, failed: isFailed, document });
  } catch (error) {
    console.error("글자 인식 결과를 저장하지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "글자 인식 결과를 저장하지 못했습니다.");
  }
}
