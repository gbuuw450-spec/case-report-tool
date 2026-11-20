// 조사자가 골라 담은 원문(초안의 재료)을 읽고 쓰는 저장소 함수
// Design Ref: §6 데이터 모델 — Pick, §7 서버 요청 목록 — /api/picks
import { randomUUID } from "node:crypto";
import type { PickSection } from "../pick/rules";
import { getDb } from "./db";
import type { DocumentKind, Pick } from "./types";

/** 담기 전에 쪽의 원문을 확인하기 위해 읽는 정보 */
export interface PageForPick {
  kind: DocumentKind;
  documentName: string;
  text: string;
  uncertain: { start: number; end: number }[];
}

/** 담은 원문 목록 (항목별로 담은 순서) */
export function listPicks(): Pick[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.section, p.document_id AS documentId, d.name AS documentName, d.evidence_name AS evidenceName, d.kind,
              p.page_no AS pageNo, p.quote, p.uncertain, p.edited_text AS editedText, p.sort_order AS sortOrder
       FROM picks p JOIN documents d ON d.id = p.document_id
       ORDER BY p.sort_order, p.rowid`
    )
    .all() as unknown as Array<Omit<Pick, "uncertain" | "order"> & { uncertain: string; sortOrder: number }>;

  return rows.map(({ uncertain, sortOrder, ...rest }) => ({
    ...rest,
    uncertain: JSON.parse(uncertain),
    order: sortOrder,
  }));
}

/** 서류의 한 쪽 원문과 구분을 읽는다. 서류나 쪽이 없으면 null */
export function getPageForPick(documentId: string, pageNo: number): PageForPick | null {
  const row = getDb()
    .prepare(
      `SELECT d.kind AS kind, d.name AS documentName, p.text AS text, p.uncertain AS uncertain
       FROM pages p JOIN documents d ON d.id = p.document_id
       WHERE p.document_id = ? AND p.page_no = ?`
    )
    .get(documentId, pageNo) as unknown as
    | { kind: DocumentKind; documentName: string; text: string; uncertain: string }
    | undefined;
  if (!row) return null;
  return { ...row, uncertain: JSON.parse(row.uncertain) };
}

/**
 * 원문을 항목에 담는다. 같은 서류·쪽·원문을 같은 항목에 또 담으면 담지 않고 null을 돌려준다.
 * 담는 순서(order)는 항목 안에서 마지막 번호 다음이다.
 */
export function addPick(input: {
  section: PickSection;
  documentId: string;
  pageNo: number;
  quote: string;
  uncertain: { start: number; end: number }[];
}): string | null {
  const db = getDb();

  const dup = db
    .prepare("SELECT 1 AS found FROM picks WHERE section = ? AND document_id = ? AND page_no = ? AND quote = ?")
    .get(input.section, input.documentId, input.pageNo, input.quote);
  if (dup !== undefined) return null;

  const last = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM picks WHERE section = ?")
    .get(input.section) as unknown as { maxOrder: number };

  const id = randomUUID();
  db.prepare(
    "INSERT INTO picks (id, section, document_id, page_no, quote, uncertain, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    input.section,
    input.documentId,
    input.pageNo,
    input.quote,
    JSON.stringify(input.uncertain),
    last.maxOrder + 1
  );
  return id;
}

/** 담은 원문 한 건의 원문(quote)을 읽는다. 없으면 null */
export function getPickQuote(id: string): string | null {
  const row = getDb().prepare("SELECT quote FROM picks WHERE id = ?").get(id) as unknown as
    | { quote: string }
    | undefined;
  return row ? row.quote : null;
}

/**
 * 초안에서 수정한 글을 저장한다. 원문(quote)과 출처는 바꾸지 않는다.
 * editedText가 null이면 수정을 취소하고 원문으로 되돌린다.
 * @returns 있었으면 true
 */
export function setPickEditedText(id: string, editedText: string | null): boolean {
  const result = getDb().prepare("UPDATE picks SET edited_text = ? WHERE id = ?").run(editedText, id);
  return Number(result.changes) > 0;
}

/** 담은 원문을 뺀다. 있었으면 true */
export function deletePick(id: string): boolean {
  const result = getDb().prepare("DELETE FROM picks WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
