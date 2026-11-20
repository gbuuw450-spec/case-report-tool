// 단어 검색 요청 — 이 컴퓨터에 저장된 쪽별 글자에서만 찾는다.
// Design Ref: §7 서버 요청 목록 — GET /api/search?q=
import { connection } from "next/server";
import { limitResults, MAX_QUERY_LENGTH, MAX_RESULTS_SHOWN, searchPages } from "@/lib/search/search";
import { listDocuments, listPagesForSearch } from "@/lib/store/documents";
import { KIND_LABELS, KIND_SIDE, type DocumentKind } from "@/lib/store/types";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  // 요청이 올 때마다 새로 찾는다. (빌드할 때 미리 만들어 두지 않는다)
  await connection();

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query === "") {
    return errorResponse(400, "QUERY_REQUIRED", "찾을 단어를 입력해 주세요.");
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return errorResponse(400, "QUERY_TOO_LONG", `찾을 단어는 ${MAX_QUERY_LENGTH}자까지 입력할 수 있습니다.`);
  }

  try {
    const documents = listDocuments();
    const found = searchPages(listPagesForSearch(), query);
    // 한 번에 최대 5건만 보여 주고, 나머지는 건수(extra)로 알린다.
    const { shown, extra } = limitResults(found, MAX_RESULTS_SHOWN);
    const results = shown.map((r) => ({
      ...r,
      kindLabel: KIND_LABELS[r.kind as DocumentKind],
      side: KIND_SIDE[r.kind as DocumentKind], // 청구인 측 / 처분청 측
    }));

    return Response.json({
      query,
      total: found.length,
      shownCount: results.length,
      extra,
      results,
      // 검색되지 못한 부분을 숨기지 않고 알려 준다. (결과가 "없음"이어도 믿기 전에 확인할 수 있게)
      notSearched: {
        documentCount: documents.length,
        // 글자가 없어 검색되지 않은 쪽 (인식 전 + 인식 실패)
        emptyPages: documents.reduce((sum, d) => sum + d.emptyPageCount + d.failedPageCount, 0),
        // 글자 인식으로 읽은 쪽: 오인식된 글자는 검색되지 않을 수 있다
        ocrPages: documents.reduce((sum, d) => sum + d.ocrPageCount, 0),
        failedDocuments: documents.filter((d) => d.status === "error").map((d) => d.name),
      },
    });
  } catch (error) {
    console.error("검색에 실패했습니다.", error);
    return errorResponse(500, "SEARCH_ERROR", "검색하지 못했습니다. 다시 시도해 주세요.");
  }
}
