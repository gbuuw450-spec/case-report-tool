// 초안을 워드 문서(.docx)로 만들어 내려주는 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — GET /api/export/docx
import { connection } from "next/server";
import { fileResponse } from "@/lib/export/respond";
import { buildDocx } from "@/lib/export/docx";
import { buildDraftModel, fileDateStamp } from "@/lib/export/draftModel";
import { listDraftPages } from "@/lib/store/documents";
import { listLawPicks } from "@/lib/store/lawPicks";
import { listPicks } from "@/lib/store/picks";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(request: Request) {
  await connection();
  try {
    const picks = listPicks();
    const lawPicks = listLawPicks();
    const draftPages = listDraftPages();
    if (picks.length === 0 && lawPicks.length === 0 && draftPages.length === 0) {
      return Response.json(
        { error: { code: "EMPTY_DRAFT", message: "담은 원문이 없어 저장할 내용이 없습니다. 검색한 뒤 원문을 담아 주세요." } },
        { status: 409 }
      );
    }

    const now = new Date();
    const file = await buildDocx(buildDraftModel(picks, now, lawPicks, draftPages));
    // 한글 파일 이름은 UTF-8로 인코딩해서 알린다. (영문 대체 이름을 함께 둔다)
    const name = `사건조사서_초안_${fileDateStamp(now)}.docx`;
    return fileResponse(request, file, name, DOCX_TYPE, "draft.docx");
  } catch (error) {
    console.error("워드 파일을 만들지 못했습니다.", error);
    return Response.json(
      { error: { code: "EXPORT_ERROR", message: "워드 파일을 만들지 못했습니다. 다시 시도해 주세요." } },
      { status: 500 }
    );
  }
}
