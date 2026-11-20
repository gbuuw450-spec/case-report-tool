// 초안의 "관계 법령"에 담은 법령 조문을 읽고 쓰는 저장소 함수
// Design Ref: §6 데이터 모델 — LawPick, §7 서버 요청 목록 — /api/law/picks
// 법제처에 연결하지 않는다. 가져온 조문을 이 컴퓨터의 저장소에 저장·삭제할 뿐이다.
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import type { LawPick } from "./types";

/** 담은 법령 조문 목록 (담은 순서) */
export function listLawPicks(): LawPick[] {
  return getDb()
    .prepare(
      `SELECT id, law_name AS lawName, article_label AS articleLabel, title, text,
              effective_date AS effectiveDate, fetched_at AS fetchedAt, sort_order AS "order"
       FROM law_picks ORDER BY sort_order, rowid`
    )
    .all() as unknown as LawPick[];
}

/** 조문을 담는다. 같은 법령의 같은 조문이 이미 있으면 담지 않고 null을 돌려준다. */
export function addLawPick(input: {
  mst: string;
  lawName: string;
  articleLabel: string;
  title: string;
  text: string;
  effectiveDate: string;
  fetchedAt: string;
}): string | null {
  const db = getDb();
  const dup = db
    .prepare("SELECT 1 AS found FROM law_picks WHERE mst = ? AND article_label = ?")
    .get(input.mst, input.articleLabel);
  if (dup !== undefined) return null;

  const last = db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM law_picks").get() as unknown as {
    maxOrder: number;
  };
  const id = randomUUID();
  db.prepare(
    `INSERT INTO law_picks (id, mst, law_name, article_label, title, text, effective_date, fetched_at, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.mst,
    input.lawName,
    input.articleLabel,
    input.title,
    input.text,
    input.effectiveDate,
    input.fetchedAt,
    last.maxOrder + 1
  );
  return id;
}

/** 담은 법령 조문을 뺀다. 있었으면 true */
export function deleteLawPick(id: string): boolean {
  const result = getDb().prepare("DELETE FROM law_picks WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
