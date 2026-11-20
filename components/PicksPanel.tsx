"use client";

// ③ 담은 원문: 청구인 주장 / 처분청 의견 / 사실관계 세 항목에 담은 원문을 출처와 함께 보여 준다.
// Design Ref: §4.1 메인 화면 ③ 담은 원문
import Link from "next/link";
import QuoteView from "@/components/QuoteView";
import { PICK_SECTIONS, SECTION_LABELS } from "@/lib/pick/rules";
import { KIND_LABELS, sourceLabel, type LawPick, type Pick } from "@/lib/store/types";

interface Props {
  picks: Pick[];
  lawPicks: LawPick[];
  onRemove: (id: string) => void;
  onRemoveLaw: (id: string) => void;
}

export default function PicksPanel({ picks, lawPicks, onRemove, onRemoveLaw }: Props) {
  return (
    <section aria-label="담은 원문" className="rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">③ 담은 원문</h2>

      <div className="space-y-4">
        {PICK_SECTIONS.map((section) => {
          const items = picks.filter((p) => p.section === section);
          return (
            <div key={section}>
              <h3 className="text-sm font-medium text-zinc-800">
                {SECTION_LABELS[section]} ({items.length})
              </h3>
              {items.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-400">담은 원문이 없습니다.</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {items.map((pick) => (
                    <li key={pick.id} className="rounded border border-zinc-200 p-2">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {/* 초안에서 수정했으면 수정한 글을, 아니면 원문을 보여 준다. */}
                        {pick.editedText ? (
                          pick.editedText
                        ) : (
                          <QuoteView text={pick.quote} uncertain={pick.uncertain} />
                        )}
                      </p>
                      {pick.editedText && <p className="text-xs text-blue-700">수정됨 (초안 화면에서 원문을 볼 수 있습니다)</p>}
                      <p className="mt-1 text-xs text-zinc-500">
                        출처: {sourceLabel(pick.documentName, pick.evidenceName)} · {pick.pageNo}쪽 (
                        {KIND_LABELS[pick.kind]})
                      </p>
                      {pick.uncertain.length > 0 && (
                        <p className="text-xs text-amber-700">
                          [인식 불확실] 점선 밑줄 친 글자는 원본 쪽 그림으로 확인하세요.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemove(pick.id)}
                        className="mt-1 rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
                      >
                        빼기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {/* 관계 법령: 법제처에서 가져온 조문. 수정할 수 없고 뺄 수만 있다. 담은 조문이 있을 때만 보인다. */}
        {lawPicks.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-800">관계 법령 ({lawPicks.length})</h3>
            <ul className="mt-1 space-y-2">
              {lawPicks.map((law) => (
                <li key={law.id} className="rounded border border-zinc-200 p-2">
                  <p className="text-sm font-medium">
                    {law.lawName} {law.articleLabel}
                    {law.title && ` (${law.title})`}
                  </p>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">{law.text}</p>
                  <p className="mt-1 text-xs text-zinc-500">출처: 법제처 국가법령정보센터 · 시행일 {law.effectiveDate || "확인 안 됨"}</p>
                  <button
                    type="button"
                    onClick={() => onRemoveLaw(law.id)}
                    className="mt-1 rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
                  >
                    빼기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Link
        href="/draft"
        className="mt-4 inline-block rounded border border-blue-300 px-3 py-1 text-sm text-blue-800 hover:bg-blue-50"
      >
        초안 화면으로
      </Link>
    </section>
  );
}
