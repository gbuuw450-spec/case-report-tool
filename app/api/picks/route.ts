// 담은 원문 목록을 돌려주고(GET), 검색 결과의 원문을 항목에 담는(POST) 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — GET·POST /api/picks
import { connection } from "next/server";
import { canPick, notAllowedMessage, PICK_SECTIONS, type PickSection } from "@/lib/pick/rules";
import { addPick, getPageForPick, listPicks } from "@/lib/store/picks";
import { KIND_LABELS } from "@/lib/store/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUOTE_LENGTH = 2_000;

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET() {
  await connection();
  try {
    return Response.json({ picks: listPicks() });
  } catch (error) {
    console.error("담은 원문을 읽지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "담은 원문을 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "올린 내용을 읽지 못했습니다.");
  }

  const { section, documentId, pageNo, quote, start } = (body ?? {}) as Record<string, unknown>;

  if (typeof section !== "string" || !(PICK_SECTIONS as string[]).includes(section)) {
    return errorResponse(400, "BAD_SECTION", "담을 항목(청구인 주장, 처분청 의견, 사실관계)을 골라 주세요.");
  }
  if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId) || !Number.isInteger(pageNo)) {
    return errorResponse(400, "BAD_SOURCE", "출처(서류와 쪽)가 올바르지 않습니다.");
  }
  if (typeof quote !== "string" || quote.trim() === "" || quote.length > MAX_QUOTE_LENGTH) {
    return errorResponse(400, "BAD_QUOTE", "담을 원문이 올바르지 않습니다.");
  }
  if (!Number.isInteger(start) || (start as number) < 0) {
    return errorResponse(400, "BAD_QUOTE", "원문의 위치가 올바르지 않습니다.");
  }

  const page = getPageForPick(documentId, pageNo as number);
  if (!page) {
    return errorResponse(404, "NOT_FOUND", "출처 서류나 쪽을 찾을 수 없습니다.");
  }

  // 담기 규칙: 어느 서류의 원문을 어느 항목에 담을 수 있는지
  if (!canPick(page.kind, section)) {
    return errorResponse(400, "NOT_ALLOWED", notAllowedMessage(KIND_LABELS[page.kind], page.kind));
  }

  // 원문 그대로 담는다: 보낸 글이 저장된 쪽의 글자와 정확히 같을 때만 받는다.
  const from = start as number;
  if (page.text.slice(from, from + quote.length) !== quote) {
    return errorResponse(400, "QUOTE_MISMATCH", "원문이 저장된 서류의 글자와 달라서 담을 수 없습니다. 다시 검색해 주세요.");
  }

  // 글자 인식이 불확실한 구간은 서버가 저장된 쪽 정보에서 직접 계산한다. (보낸 값을 믿지 않는다)
  const to = from + quote.length;
  const uncertain = page.uncertain
    .filter((r) => r.start < to && r.end > from)
    .map((r) => ({ start: Math.max(r.start, from) - from, end: Math.min(r.end, to) - from }));

  try {
    const id = addPick({
      section: section as PickSection,
      documentId,
      pageNo: pageNo as number,
      quote,
      uncertain,
    });
    if (id === null) {
      return errorResponse(409, "DUPLICATE", "이미 이 항목에 담은 원문입니다.");
    }
    return Response.json({ id, picks: listPicks() }, { status: 201 });
  } catch (error) {
    console.error("원문을 담지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "원문을 담지 못했습니다.");
  }
}
