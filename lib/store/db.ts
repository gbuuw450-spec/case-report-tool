// 이 컴퓨터의 data/ 폴더에 저장하는 작은 저장소(SQLite) 연결
// Design Ref: §3 기술 선택(Node 내장 SQLite), §8 폴더 구조(data/)
// 서류와 텍스트는 이 폴더 밖으로 나가지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * 인터넷 시연 주소(Vercel)에서 실행 중인지. 그곳은 파일을 쓸 수 있는 곳이 임시 폴더뿐이고 여러 방문자가 함께 쓰므로,
 * 서류 올리기를 막고 임시 폴더만 쓴다. (실제 서류는 이 컴퓨터에서만 다룬다)
 */
export const HOSTED_DEMO = Boolean(process.env.VERCEL);

/** 원본 PDF와 저장 파일이 들어가는 폴더 (.gitignore에 등록되어 커밋되지 않음) */
export const DATA_DIR = HOSTED_DEMO ? path.join(os.tmpdir(), "case-data") : path.join(process.cwd(), "data");
export const FILES_DIR = path.join(DATA_DIR, "files");
const DB_PATH = path.join(DATA_DIR, "app.db");

// 개발 중 코드가 다시 불러와져도 연결을 하나만 유지한다.
const globalForDb = globalThis as unknown as { __caseDb?: DatabaseSync };

function createTables(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      evidence_name TEXT,
      content_hash TEXT,
      in_draft INTEGER NOT NULL DEFAULT 1,
      page_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pages (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_no INTEGER NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      used_ocr INTEGER NOT NULL DEFAULT 0,
      uncertain TEXT NOT NULL DEFAULT '[]',
      failed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (document_id, page_no)
    );

    CREATE TABLE IF NOT EXISTS picks (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_no INTEGER NOT NULL,
      quote TEXT NOT NULL,
      uncertain TEXT NOT NULL DEFAULT '[]',
      edited_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS law_picks (
      id TEXT PRIMARY KEY,
      mst TEXT NOT NULL,
      law_name TEXT NOT NULL,
      article_label TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      effective_date TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 이전에 만든 저장소에는 없는 칸이 있을 수 있으므로, 없으면 추가한다.
  const hasColumn = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>).some(
      (c) => c.name === column
    );
  if (!hasColumn("picks", "uncertain")) {
    db.exec("ALTER TABLE picks ADD COLUMN uncertain TEXT NOT NULL DEFAULT '[]'");
  }
  if (!hasColumn("picks", "edited_text")) {
    db.exec("ALTER TABLE picks ADD COLUMN edited_text TEXT");
  }
  if (!hasColumn("documents", "in_draft")) {
    db.exec("ALTER TABLE documents ADD COLUMN in_draft INTEGER NOT NULL DEFAULT 1");
  }
  if (!hasColumn("documents", "content_hash")) {
    db.exec("ALTER TABLE documents ADD COLUMN content_hash TEXT");
  }
  if (!hasColumn("documents", "evidence_name")) {
    db.exec("ALTER TABLE documents ADD COLUMN evidence_name TEXT");
  }
}

/** 저장소 연결을 닫는다. (사건 삭제 때 파일을 지우기 위해) 다음에 getDb()를 부르면 새로 연다. */
export function closeDb(): void {
  if (globalForDb.__caseDb) {
    globalForDb.__caseDb.close();
    globalForDb.__caseDb = undefined;
  }
}

/** 저장소 연결을 돌려준다. 처음 부르면 폴더와 표를 만든다. */
export function getDb(): DatabaseSync {
  if (globalForDb.__caseDb) return globalForDb.__caseDb;

  fs.mkdirSync(FILES_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  createTables(db);
  globalForDb.__caseDb = db;
  return db;
}
