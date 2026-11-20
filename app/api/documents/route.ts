// 서류 목록을 돌려주고(GET), PDF 서류를 올리는(POST) 요청 — 이 컴퓨터 안에서만 사용
// Design Ref: §7 서버 요청 목록 — GET·POST /api/documents
import { connection } from "next/server";
import { countPdfPages } from "@/lib/pdf/countPages";
import { extractPageTexts } from "@/lib/pdf/extractText";
import {
  addDocument,
  findDocumentByContent,
  getCaseSummary,
  getTotalPages,
  hashContent,
  isEvidenceNameTaken,
  listDocuments,
  savePageTexts,
  setDocumentStatus,
} from "@/lib/store/documents";
import {
  DOCUMENT_KINDS,
  isEvidenceKind,
  KIND_LABELS,
  MAX_TOTAL_PAGES,
  sourceLabel,
  type DocumentKind,
} from "@/lib/store/types";
import { HOSTED_DEMO } from "@/lib/store/db";
import { checkEvidenceName, EVIDENCE_MESSAGES } from "@/lib/upload/checkEvidenceName";
import { checkPageLimit } from "@/lib/upload/checkPageLimit";
import { checkUpload } from "@/lib/upload/checkUpload";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET() {
  // 빌드할 때 미리 만들어 두지 않고, 요청이 올 때마다 저장소에서 새로 읽는다.
  await connection();
  try {
    return Response.json(getCaseSummary());
  } catch (error) {
    console.error("서류 목록을 읽지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "저장된 서류를 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  // 인터넷 시연 주소에서는 서류를 받지 않는다. (여러 방문자가 함께 쓰고 서류가 남을 수 있어서)
  if (HOSTED_DEMO) {
    return errorResponse(
      403,
      "DEMO_MODE",
      "이 인터넷 주소는 화면을 보여 주는 시연용이라 서류를 올릴 수 없습니다. 실제 서류는 이 컴퓨터에서만 실행하는 앱(README의 실행 방법)에서 올려 주세요."
    );
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "올린 내용을 읽지 못했습니다. 다시 시도해 주세요.");
  }

  // 서류 구분은 조사자가 직접 고른 값이어야 한다. (고르지 않으면 올릴 수 없다)
  const kind = form.get("kind");
  if (typeof kind !== "string" || !(DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    return errorResponse(400, "KIND_REQUIRED", "서류 구분(청구이유서, 답변서 등)을 먼저 골라 주세요.");
  }

  // 증거서류는 올릴 때 조사자가 증거 이름(갑 제1호증 등)을 입력해야 한다. 증거서류가 아니면 받지 않는다.
  let evidenceName: string | null = null;
  if (isEvidenceKind(kind)) {
    const named = checkEvidenceName(form.get("evidenceName"));
    if (!named.ok) {
      return errorResponse(400, named.code, named.message);
    }
    if (isEvidenceNameTaken(kind as DocumentKind, named.name)) {
      return errorResponse(409, "EVIDENCE_NAME_TAKEN", EVIDENCE_MESSAGES.DUPLICATE);
    }
    evidenceName = named.name;
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "FILE_REQUIRED", "올릴 파일을 골라 주세요.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(file.name, data.subarray(0, 8), data.byteLength);
  if (!check.ok) {
    return errorResponse(400, check.code, check.message);
  }

  // 파일 이름이 달라도 내용이 같은 서류를 다시 올리면 쪽수가 두 번 세어지므로 올리지 않는다.
  const contentHash = hashContent(data);
  const duplicate = findDocumentByContent(contentHash);
  if (duplicate) {
    return errorResponse(
      409,
      "DUPLICATE_FILE",
      `이미 올린 파일입니다. 같은 내용의 서류가 ${KIND_LABELS[duplicate.kind]}에 "${sourceLabel(duplicate.name, duplicate.evidenceName)}"로 올라와 있습니다.`
    );
  }

  // 쪽수를 세어 이미 올린 서류와의 합계가 100쪽을 넘으면 저장하지 않고 막는다.
  const counted = await countPdfPages(data);
  if (!counted.ok) {
    return errorResponse(400, counted.code, counted.message);
  }
  const limit = checkPageLimit(getTotalPages(), counted.pages, MAX_TOTAL_PAGES);
  if (!limit.ok) {
    return errorResponse(400, limit.code, limit.message);
  }

  try {
    const document = addDocument({
      kind: kind as DocumentKind,
      name: file.name.slice(0, 200),
      evidenceName,
      pageCount: counted.pages,
      data,
      contentHash,
    });

    // 쪽별 글자를 꺼내 저장한다. 실패하면 서류는 남기되 '변환 실패'로 표시한다.
    try {
      const pages = await extractPageTexts(data);
      if (pages.length !== counted.pages) {
        throw new Error(`쪽수 불일치: 센 쪽수 ${counted.pages}, 변환한 쪽수 ${pages.length}`);
      }
      savePageTexts(document.id, pages);
    } catch (error) {
      console.error("글자 변환에 실패했습니다.", error);
      setDocumentStatus(document.id, "error");
    }

    const saved = listDocuments().find((d) => d.id === document.id) ?? document;
    return Response.json({ document: saved }, { status: 201 });
  } catch (error) {
    console.error("서류를 저장하지 못했습니다.", error);
    return errorResponse(500, "STORE_ERROR", "서류를 저장하지 못했습니다.");
  }
}
