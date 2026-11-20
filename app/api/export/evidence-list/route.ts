// 증거 목록표를 워드 문서(.docx)로 만들어 내려주는 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — GET /api/export/evidence-list
import { connection } from "next/server";
import { fileResponse } from "@/lib/export/respond";
import { fileDateStamp } from "@/lib/export/draftModel";
import { buildEvidenceListModel } from "@/lib/export/evidenceList";
import { buildEvidenceListDocx } from "@/lib/export/evidenceListDocx";
import { listDocuments } from "@/lib/store/documents";
import { listPicks } from "@/lib/store/picks";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(request: Request) {
  await connection();
  try {
    const now = new Date();
    const model = buildEvidenceListModel(listDocuments(), listPicks(), now);
    if (model.rows.length === 0) {
      return Response.json(
        { error: { code: "NO_EVIDENCE", message: "올린 증거서류가 없어 증거 목록표를 만들 수 없습니다." } },
        { status: 409 }
      );
    }
    const file = await buildEvidenceListDocx(model);
    const name = `증거목록표_${fileDateStamp(now)}.docx`;
    return fileResponse(request, file, name, DOCX_TYPE, "evidence-list.docx");
  } catch (error) {
    console.error("증거 목록표를 만들지 못했습니다.", error);
    return Response.json(
      { error: { code: "EXPORT_ERROR", message: "증거 목록표를 만들지 못했습니다. 다시 시도해 주세요." } },
      { status: 500 }
    );
  }
}
