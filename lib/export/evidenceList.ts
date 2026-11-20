// 증거 목록표: 올린 증거서류를 증거 이름 순서로 정리한 표의 내용
// Design Ref: PRD Nice 1 증거 목록표 내보내기 — 칸: 번호, 증거 이름, 파일명, 제출 측, 쪽수, 담은 횟수, 비고(빈칸)
import { KIND_SIDE, isEvidenceKind, type DocumentInfo, type Pick } from "../store/types";

export interface EvidenceRow {
  no: number;
  evidenceName: string;
  fileName: string;
  side: string; // 청구인 측 / 처분청 측
  pageCount: number;
  pickCount: number; // 이 증거에서 초안에 담은 원문 수
}

export interface EvidenceListModel {
  title: string;
  dateLabel: string;
  rows: EvidenceRow[];
}

const collator = new Intl.Collator("ko", { numeric: true });

/** 올린 서류 중 증거서류만 골라, 청구인 측 → 처분청 측, 증거 이름(번호 크기) 순으로 표 내용을 만든다. */
export function buildEvidenceListModel(documents: DocumentInfo[], picks: Pick[], now: Date): EvidenceListModel {
  const counts = new Map<string, number>();
  for (const p of picks) counts.set(p.documentId, (counts.get(p.documentId) ?? 0) + 1);

  const rows = documents
    .filter((d) => isEvidenceKind(d.kind))
    .map((d) => ({
      evidenceName: d.evidenceName ?? "",
      fileName: d.name,
      side: KIND_SIDE[d.kind],
      pageCount: d.pageCount,
      pickCount: counts.get(d.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "청구인 측" ? -1 : 1;
      return collator.compare(a.evidenceName, b.evidenceName);
    })
    .map((r, i) => ({ no: i + 1, ...r }));

  return {
    title: "증거 목록표",
    dateLabel: `작성일: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`,
    rows,
  };
}
