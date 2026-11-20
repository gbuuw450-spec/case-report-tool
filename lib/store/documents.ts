// 사건과 서류 목록을 읽고 쓰는 저장소 함수
// Design Ref: §6 데이터 모델 — 사건은 한 번에 1건만 둔다.
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PageRow } from "../search/search";
import { evidenceNameKey } from "../upload/checkEvidenceName";
import { FILES_DIR, getDb } from "./db";
import {
  MAX_TOTAL_PAGES,
  type CaseInfo,
  type CaseSummary,
  type DocumentInfo,
  type DocumentKind,
  type DraftDocument,
  type DraftPage,
  type DocumentStatus,
} from "./types";

/** 사건이 없으면 기본 사건 1건을 만들고, 있으면 그대로 돌려준다. */
export function ensureCase(): CaseInfo {
  const db = getDb();
  const row = db
    .prepare("SELECT id, name, created_at AS createdAt FROM cases ORDER BY id LIMIT 1")
    .get() as unknown as CaseInfo | undefined;
  if (row) return row;

  const now = new Date().toISOString();
  db.prepare("INSERT INTO cases (name, created_at) VALUES (?, ?)").run("새 사건", now);
  return ensureCase();
}

/** 올린 서류 목록 (올린 순서) */
export function listDocuments(): DocumentInfo[] {
  const rows = getDb()
    .prepare(
      `SELECT d.id, d.kind, d.name, d.evidence_name AS evidenceName, d.page_count AS pageCount, d.status,
              (SELECT COUNT(*) FROM pages p WHERE p.document_id = d.id AND p.text = '' AND p.failed = 0) AS emptyPageCount,
              (SELECT COUNT(*) FROM pages p WHERE p.document_id = d.id AND p.failed = 1) AS failedPageCount,
              (SELECT COUNT(*) FROM pages p WHERE p.document_id = d.id AND p.used_ocr = 1 AND p.text <> '') AS ocrPageCount,
              d.created_at AS createdAt
       FROM documents d ORDER BY d.created_at, d.rowid`
    )
    .all() as unknown as Array<{
    id: string;
    kind: DocumentKind;
    name: string;
    evidenceName: string | null;
    pageCount: number;
    status: DocumentStatus;
    emptyPageCount: number;
    failedPageCount: number;
    ocrPageCount: number;
    createdAt: string;
  }>;
  return rows;
}

/** 초안에 서류 전문으로 들어가는 쪽들 (올린 순서, 쪽 순서). 글자가 없는 쪽은 뺀다. */
export function listDraftPages(): DraftPage[] {
  const rows = getDb()
    .prepare(
      `SELECT d.id AS documentId, d.name AS documentName, d.evidence_name AS evidenceName, d.kind AS kind,
              p.page_no AS pageNo, p.text AS text, p.uncertain AS uncertain
       FROM documents d JOIN pages p ON p.document_id = d.id
       WHERE d.in_draft = 1 AND p.text <> ''
       ORDER BY d.created_at, d.rowid, p.page_no`
    )
    .all() as unknown as Array<Omit<DraftPage, "uncertain"> & { uncertain: string }>;
  return rows.map((r) => ({ ...r, uncertain: (JSON.parse(r.uncertain) as unknown[]).length > 0 }));
}

/** 초안 화면에 보여 줄 서류 목록 (서류 전문 포함 여부 포함) */
export function listDraftDocuments(): DraftDocument[] {
  const rows = getDb()
    .prepare(
      `SELECT d.id, d.name, d.evidence_name AS evidenceName, d.kind, d.page_count AS pageCount, d.in_draft AS inDraft,
              (SELECT COUNT(*) FROM pages p WHERE p.document_id = d.id AND p.text = '') AS emptyPageCount
       FROM documents d ORDER BY d.created_at, d.rowid`
    )
    .all() as unknown as Array<Omit<DraftDocument, "inDraft"> & { inDraft: number }>;
  return rows.map((r) => ({ ...r, inDraft: r.inDraft === 1 }));
}

/** 서류 전문을 초안에 넣을지 정한다. 있었으면 true */
export function setDocumentInDraft(id: string, inDraft: boolean): boolean {
  const result = getDb().prepare("UPDATE documents SET in_draft = ? WHERE id = ?").run(inDraft ? 1 : 0, id);
  return Number(result.changes) > 0;
}

/** 같은 구분의 서류 중에 같은 증거 이름이 이미 있는지 (공백·대소문자는 무시하고 비교) */
export function isEvidenceNameTaken(kind: DocumentKind, evidenceName: string): boolean {
  const rows = getDb()
    .prepare("SELECT evidence_name AS evidenceName FROM documents WHERE kind = ? AND evidence_name IS NOT NULL")
    .all(kind) as unknown as Array<{ evidenceName: string }>;
  const key = evidenceNameKey(evidenceName);
  return rows.some((r) => evidenceNameKey(r.evidenceName) === key);
}

/** 원본 PDF가 저장되는 경로 (파일 이름은 서류 번호로 정해서, 올린 이름과 상관없이 안전하게 둔다) */
export function documentFilePath(id: string): string {
  return path.join(FILES_DIR, `${id}.pdf`);
}

/**
 * 올린 PDF를 data/files에 저장하고 서류로 기록한다.
 * 쪽수는 올리는 순간 센 값을 기록하고, 글자 변환 전이므로 상태는 '대기'로 둔다.
 */
export function addDocument(input: {
  kind: DocumentKind;
  name: string;
  evidenceName: string | null; // 증거서류만 값이 있다 (갑 제1호증 등)
  pageCount: number;
  data: Uint8Array;
  contentHash: string; // 파일 내용의 지문(sha256)
}): DocumentInfo {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const filePath = documentFilePath(id);

  // 파일을 먼저 저장하고, 기록이 실패하면 방금 만든 파일을 되돌린다.
  fs.mkdirSync(FILES_DIR, { recursive: true });
  fs.writeFileSync(filePath, input.data);
  try {
    db.prepare(
      "INSERT INTO documents (id, kind, name, evidence_name, content_hash, page_count, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)"
    ).run(id, input.kind, input.name, input.evidenceName, input.contentHash, input.pageCount, createdAt);
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    throw error;
  }

  return {
    id,
    kind: input.kind,
    name: input.name,
    evidenceName: input.evidenceName,
    pageCount: input.pageCount,
    status: "pending",
    emptyPageCount: 0,
    failedPageCount: 0,
    ocrPageCount: 0,
    createdAt,
  };
}

/** 파일 내용의 지문(sha256). 파일 이름이 달라도 내용이 같으면 같은 값이 나온다. */
export function hashContent(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * 같은 내용의 서류가 이미 올라와 있으면 그 서류를 돌려준다. 없으면 null.
 * 지문이 아직 없는 이전 서류는 저장된 파일에서 지문을 만들어 채운 뒤 비교한다.
 */
export function findDocumentByContent(contentHash: string): DocumentInfo | null {
  const db = getDb();
  const missing = db.prepare("SELECT id FROM documents WHERE content_hash IS NULL").all() as unknown as Array<{ id: string }>;
  for (const { id } of missing) {
    try {
      db.prepare("UPDATE documents SET content_hash = ? WHERE id = ?").run(hashContent(fs.readFileSync(documentFilePath(id))), id);
    } catch {
      // 원본 파일을 읽을 수 없는 서류는 비교에서 빠진다.
    }
  }
  const row = db.prepare("SELECT id FROM documents WHERE content_hash = ? ORDER BY created_at LIMIT 1").get(contentHash) as unknown as
    | { id: string }
    | undefined;
  return row ? (listDocuments().find((d) => d.id === row.id) ?? null) : null;
}

/** 서류가 있는지 확인한다. */
export function documentExists(id: string): boolean {
  const row = getDb().prepare("SELECT 1 AS found FROM documents WHERE id = ?").get(id);
  return row !== undefined;
}

/** 글자 인식이 필요한 쪽 번호들 (글자가 없는 쪽. 이전에 인식에 실패한 쪽도 다시 시도할 수 있다) */
export function listPageNosNeedingOcr(documentId: string): number[] {
  const rows = getDb()
    .prepare("SELECT page_no AS pageNo FROM pages WHERE document_id = ? AND text = '' ORDER BY page_no")
    .all(documentId) as unknown as Array<{ pageNo: number }>;
  return rows.map((r) => r.pageNo);
}

/**
 * 글자 인식 결과를 한 쪽에 저장한다. 글자가 없는 쪽에만 쓰며, 이미 글자가 있는 쪽은 덮어쓰지 않는다.
 * 저장 뒤 서류 상태를 다시 정한다: 글자 없는 쪽이 하나도 없으면 'done', 있으면 'partial'.
 * @returns 저장했으면 true, 해당 쪽이 없거나 이미 글자가 있어 건너뛰었으면 false
 */
export function saveOcrPage(
  documentId: string,
  page: { pageNo: number; text: string; uncertain: { start: number; end: number }[]; failed: boolean }
): boolean {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        "UPDATE pages SET text = ?, used_ocr = 1, uncertain = ?, failed = ? WHERE document_id = ? AND page_no = ? AND text = ''"
      )
      .run(page.text, JSON.stringify(page.uncertain), page.failed ? 1 : 0, documentId, page.pageNo);

    if (Number(result.changes) === 0) {
      db.exec("ROLLBACK");
      return false;
    }

    const left = db
      .prepare("SELECT COUNT(*) AS n FROM pages WHERE document_id = ? AND text = ''")
      .get(documentId) as unknown as { n: number };
    db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(
      left.n === 0 ? "done" : "partial",
      documentId
    );
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** 서류의 처리 상태를 바꾼다. */
export function setDocumentStatus(id: string, status: DocumentStatus): void {
  getDb().prepare("UPDATE documents SET status = ? WHERE id = ?").run(status, id);
}

/**
 * 쪽별 글자를 원문 그대로 저장하고, 서류 상태를 정한다.
 * 모든 쪽에 글자가 있으면 'done', 글자 없는 쪽이 있으면 'partial'(글자 인식 필요).
 * 저장 중 오류가 나면 전부 되돌려 일부만 저장된 상태가 남지 않게 한다.
 */
export function savePageTexts(
  documentId: string,
  pages: { pageNo: number; text: string }[]
): DocumentStatus {
  const db = getDb();
  const status: DocumentStatus = pages.some((p) => p.text === "") ? "partial" : "done";

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM pages WHERE document_id = ?").run(documentId);
    const insert = db.prepare(
      "INSERT INTO pages (document_id, page_no, text, used_ocr, uncertain, failed) VALUES (?, ?, ?, 0, '[]', 0)"
    );
    for (const page of pages) insert.run(documentId, page.pageNo, page.text);
    db.prepare("UPDATE documents SET status = ? WHERE id = ?").run(status, documentId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return status;
}

/** 단어 검색에 쓸 모든 쪽의 글자 (서류 순서, 쪽수 순서) */
export function listPagesForSearch(): PageRow[] {
  const rows = getDb()
    .prepare(
      `SELECT p.document_id AS documentId, d.name AS documentName, d.evidence_name AS evidenceName, d.kind AS kind,
              p.page_no AS pageNo, p.text AS text, p.uncertain AS uncertain
       FROM pages p JOIN documents d ON d.id = p.document_id
       ORDER BY d.created_at, d.rowid, p.page_no`
    )
    .all() as unknown as Array<Omit<PageRow, "uncertain"> & { uncertain: string }>;

  return rows.map((row) => ({ ...row, uncertain: JSON.parse(row.uncertain) }));
}

/** 서류 쪽수 합계 */
export function getTotalPages(): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(page_count), 0) AS total FROM documents")
    .get() as unknown as { total: number };
  return row.total;
}

/** 화면에 필요한 사건 요약 */
export function getCaseSummary(): CaseSummary {
  return {
    case: ensureCase(),
    documents: listDocuments(),
    totalPages: getTotalPages(),
    maxPages: MAX_TOTAL_PAGES,
  };
}
