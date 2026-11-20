// 초안을 저장 파일(워드·한글)로 만들기 전에, 파일 형식과 상관없는 공통 모양으로 정리한다.
// Design Ref: §5.3 담기와 초안, 저장 — 저장 파일에는 현재 글(수정했다면 수정본)과 출처를 넣고,
//             수정한 문장 뒤 "(수정됨)", 불확실한 원문이 든 문장 뒤 "[인식 불확실]"을 붙인다.
// 항목 목록을 따라 만들기 때문에, 나중에 "관계 법령" 항목(작업 22)이 늘어도 워드·한글 저장이 그대로 따라온다.
import { autoSectionFor, PICK_SECTIONS, SECTION_LABELS } from "../pick/rules";
import { KIND_LABELS, KIND_SIDE, sourceLabel, type DraftPage, type LawPick, type Pick } from "../store/types";

export interface DraftItem {
  text: string; // 초안에 쓸 글: 수정본이 있으면 수정본, 없으면 원문
  sourceLine: string; // 출처 한 줄
  edited: boolean; // 조사자가 수정했는지 → "(수정됨)"
  uncertain: boolean; // 원문에 글자 인식이 불확실한 부분이 있었는지 → "[인식 불확실]"
}

export interface DraftSection {
  id: string;
  title: string;
  items: DraftItem[];
}

export interface DraftModel {
  title: string;
  dateLabel: string; // 예: 작성일: 2026년 11월 20일
  notices: string[]; // 문서 맨 위의 안내 문구
  sections: DraftSection[];
}

export const EDITED_MARK = "(수정됨)";
export const UNCERTAIN_MARK = "[인식 불확실]";
export const EMPTY_SECTION_TEXT = "(담은 원문 없음)";

export const LAW_SECTION_TITLE = "관계 법령";

/** 가져온 시각을 2026-11-20 15:17 모양으로 (이 컴퓨터의 시간대 기준) */
function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 담은 원문 목록을 항목별로 묶어 저장 파일용 모양으로 만든다. */
export function buildDraftModel(picks: Pick[], now: Date, lawPicks: LawPick[] = [], draftPages: DraftPage[] = []): DraftModel {
  const sections: DraftSection[] = PICK_SECTIONS.map((section) => ({
    id: section,
    title: SECTION_LABELS[section],
    items: picks
      .filter((p) => p.section === section)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        text: p.editedText ?? p.quote,
        sourceLine: `출처: ${sourceLabel(p.documentName, p.evidenceName)} · ${p.pageNo}쪽 (${KIND_SIDE[p.kind]} · ${KIND_LABELS[p.kind]})`,
        edited: p.editedText !== null,
        uncertain: p.uncertain.length > 0,
      })),
  }));

  // 서류 전문: 올린 서류의 글을 쪽별로 그대로, 조사자가 고른 원문 뒤에 이어 붙인다. (서류 구분에 따라 들어갈 항목이 정해져 있다)
  for (const page of draftPages) {
    const sectionId = autoSectionFor(page.kind);
    const target = sections.find((s) => s.id === sectionId);
    if (!target) continue;
    target.items.push({
      text: page.text,
      sourceLine: `출처: ${sourceLabel(page.documentName, page.evidenceName)} · ${page.pageNo}쪽 (${KIND_SIDE[page.kind]} · ${KIND_LABELS[page.kind]}) · 서류 전문`,
      edited: false,
      uncertain: page.uncertain,
    });
  }

  // 관계 법령: 담은 조문이 있을 때만 네 번째 항목으로 넣는다. 법제처가 준 글 그대로이고 수정·불확실 표시가 없다.
  if (lawPicks.length > 0) {
    sections.push({
      id: "law",
      title: LAW_SECTION_TITLE,
      items: [...lawPicks]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          text: l.text,
          sourceLine: `출처: 법제처 국가법령정보센터 · ${l.lawName} ${l.articleLabel} (시행일 ${l.effectiveDate || "확인 안 됨"}, 가져온 시각 ${formatFetchedAt(l.fetchedAt)})`,
          edited: false,
          uncertain: false,
        })),
    });
  }

  return {
    title: "사건조사서 (초안)",
    dateLabel: `작성일: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`,
    notices: [
      "이 초안은 제출 서류에서 조사자가 고른 원문을 모은 것입니다. 각 글 아래의 출처(서류와 쪽)를 원본과 대조해 확인하세요.",
      `${EDITED_MARK}은 조사자가 글을 고친 것이고, ${UNCERTAIN_MARK}은 스캔 서류의 글자 인식이 불확실한 부분이 있다는 뜻입니다.`,
      ...(draftPages.length > 0
        ? ["\"서류 전문\"은 올린 서류의 글을 쪽별로 그대로 넣은 것이며, 조사자가 고른 원문 뒤에 이어집니다."]
        : []),
      ...(lawPicks.length > 0
        ? [`${LAW_SECTION_TITLE}은 법제처 국가법령정보센터에서 가져온 조문 그대로이며, 법령은 개정될 수 있으니 최신 내용을 확인하세요.`]
        : []),
    ],
    sections,
  };
}

/** 저장 파일 이름에 쓰는 날짜 (예: 2026-11-20) */
export function fileDateStamp(now: Date): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}
