"use client";

// ② 찾기: 단어를 입력하면 문서명·쪽수·원문을 보여 준다.
// Design Ref: §4.1 메인 화면 ② 찾기, §5.2 검색
import { useState, type FormEvent } from "react";
import PageImageViewer from "@/components/PageImageViewer";
import { allowedSections, SECTION_LABELS, type PickSection } from "@/lib/pick/rules";
import { sourceLabel } from "@/lib/store/types";

export interface SearchHit {
  documentId: string;
  documentName: string;
  evidenceName: string | null;
  kind: string;
  kindLabel: string;
  side: "청구인 측" | "처분청 측";
  pageNo: number;
  sentence: string;
  sentenceStart: number;
  matchStart: number;
  matchEnd: number;
  uncertain: boolean;
  uncertainRanges: { start: number; end: number }[];
}

/** 문장을 찾은 단어(노란색)와 인식 불확실 단어(점선 밑줄)로 나눠 보여 준다. */
function SentenceView({ hit }: { hit: SearchHit }) {
  const len = hit.sentence.length;
  const points = new Set<number>([0, len, hit.matchStart, hit.matchEnd]);
  for (const r of hit.uncertainRanges) {
    points.add(r.start);
    points.add(r.end);
  }
  const cuts = [...points].filter((p) => p >= 0 && p <= len).sort((a, b) => a - b);

  return (
    <>
      {cuts.slice(0, -1).map((start, i) => {
        const end = cuts[i + 1];
        const isMatch = start >= hit.matchStart && end <= hit.matchEnd;
        const isUncertain = hit.uncertainRanges.some((r) => start >= r.start && end <= r.end);
        const piece = hit.sentence.slice(start, end);
        const className = [
          isMatch ? "bg-yellow-200" : "",
          isUncertain ? "underline decoration-dotted decoration-amber-600 underline-offset-4" : "",
        ]
          .join(" ")
          .trim();
        return className ? (
          <mark key={start} className={`${className} text-inherit`} style={isMatch ? undefined : { background: "transparent" }}>
            {piece}
          </mark>
        ) : (
          <span key={start}>{piece}</span>
        );
      })}
    </>
  );
}

interface SearchResponse {
  query: string;
  total: number; // 찾은 전체 건수
  shownCount: number; // 지금 보여 주는 건수 (최대 5건)
  extra: number; // 보여 주지 않은 추가 건수
  results: SearchHit[];
  notSearched: {
    documentCount: number;
    emptyPages: number;
    ocrPages: number;
    failedDocuments: string[];
  };
}

interface SearchPanelProps {
  documentCount: number;
  /** 이미 담은 원문 (같은 원문을 같은 항목에 또 담지 못하게 버튼을 막는 데 쓴다) */
  picked: { section: string; documentId: string; pageNo: number; quote: string }[];
  /** 원문을 항목에 담는다. 실패하면 안내 문구를, 성공하면 null을 돌려준다. */
  onPick: (hit: SearchHit, section: PickSection) => Promise<string | null>;
}

export default function SearchPanel({ documentCount, picked, onPick }: SearchPanelProps) {
  // 담기 결과 안내 (어느 결과 카드에서 한 일인지 구분해 그 카드 아래에 보여 준다)
  const [pickNotice, setPickNotice] = useState<{ key: string; message: string; ok: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  // 쪽 그림을 보고 있는 결과 (없으면 null)
  const [viewing, setViewing] = useState<SearchHit | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "검색하지 못했습니다.");
      setResponse(body as SearchResponse);
    } catch (e) {
      setResponse(null);
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function handlePick(hit: SearchHit, section: PickSection, key: string) {
    const failure = await onPick(hit, section);
    setPickNotice(
      failure
        ? { key, message: failure, ok: false }
        : { key, message: `${SECTION_LABELS[section]}에 담았습니다.`, ok: true }
    );
  }

  const noDocuments = documentCount === 0;
  const notSearched = response?.notSearched;

  return (
    <section aria-label="찾기" className="rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700">② 찾기</h2>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={noDocuments}
          maxLength={100}
          aria-label="찾을 단어"
          placeholder={noDocuments ? "서류를 올린 뒤에 찾을 수 있습니다" : "찾을 단어를 입력하세요"}
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={noDocuments || searching || query.trim() === ""}
          className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:text-zinc-400"
        >
          {searching ? "찾는 중…" : "찾기"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {response && (
        <div className="mt-4 space-y-3">
          {response.total === 0 ? (
            <p className="rounded bg-zinc-100 px-3 py-2 text-sm">
              <strong>없음</strong> — 올린 서류에서 &quot;{response.query}&quot;을(를) 찾지 못했습니다.
            </p>
          ) : (
            <p className="text-sm text-zinc-600">
              &quot;{response.query}&quot; 검색 결과 {response.total}건
              {response.extra > 0 && ` 중 ${response.shownCount}건 표시`}
            </p>
          )}

          <ul className="space-y-3">
            {response.results.map((hit, i) => {
              const key = `${hit.documentId}-${hit.pageNo}-${i}`;
              return (
              <li key={key} className="rounded border border-zinc-200 p-3">
                <p className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-800">{sourceLabel(hit.documentName, hit.evidenceName)}</span> ·{" "}
                  {hit.pageNo}쪽 ·{" "}
                  {hit.side} ({hit.kindLabel})
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  <SentenceView hit={hit} />
                </p>
                {hit.uncertain && (
                  <p className="mt-1 text-xs text-amber-700">
                    [인식 불확실] 점선 밑줄 친 글자는 글자 인식이 불확실합니다. 원본 쪽 그림으로 확인하세요.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewing(hit)}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                  >
                    쪽 그림
                  </button>
                  {/* 이 서류의 원문을 담을 수 있는 항목만 보여 준다. (청구인 측/처분청 측을 섞지 않는다) */}
                  {allowedSections(hit.kind).map((section) => {
                    const already = picked.some(
                      (p) =>
                        p.section === section &&
                        p.documentId === hit.documentId &&
                        p.pageNo === hit.pageNo &&
                        p.quote === hit.sentence
                    );
                    return (
                      <button
                        key={section}
                        type="button"
                        disabled={already}
                        onClick={() => void handlePick(hit, section, key)}
                        className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-800 hover:bg-blue-50 disabled:border-zinc-200 disabled:text-zinc-400"
                      >
                        {already ? `${SECTION_LABELS[section]}에 담음` : `${SECTION_LABELS[section]}에 담기`}
                      </button>
                    );
                  })}
                </div>
                {pickNotice?.key === key && (
                  <p
                    role={pickNotice.ok ? "status" : "alert"}
                    className={`mt-1 text-xs ${pickNotice.ok ? "text-green-700" : "text-red-700"}`}
                  >
                    {pickNotice.message}
                  </p>
                )}
              </li>
              );
            })}
          </ul>

          {/* 숨긴 결과가 있으면 건수를 반드시 알린다. */}
          {response.extra > 0 && (
            <p role="status" className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">
              추가 {response.extra}건 있음 — 찾는 단어를 더 구체적으로 입력하면 결과를 줄일 수 있습니다.
            </p>
          )}

          {/* 검색되지 못한 부분을 숨기지 않는다. "없음"이어도 믿기 전에 확인할 수 있게 한다. */}
          {notSearched &&
            (notSearched.emptyPages > 0 || notSearched.ocrPages > 0 || notSearched.failedDocuments.length > 0) && (
            <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notSearched.ocrPages > 0 && (
                <p>
                  글자 인식으로 읽은 쪽 {notSearched.ocrPages}쪽이 포함되어 있습니다. 인식이 틀린 글자(예: 쉼표 빠짐)는
                  검색되지 않을 수 있으니, &quot;없음&quot;이어도 해당 쪽은 원본 그림으로 확인하세요.
                </p>
              )}
              {notSearched.emptyPages > 0 && (
                <p>글자가 없는 쪽 {notSearched.emptyPages}쪽은 검색되지 않았습니다. (스캔 쪽은 글자 인식이 필요합니다)</p>
              )}
              {notSearched.failedDocuments.length > 0 && (
                <p>글자를 꺼내지 못한 서류는 검색되지 않았습니다: {notSearched.failedDocuments.join(", ")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {viewing && (
        <PageImageViewer
          key={`${viewing.documentId}-${viewing.pageNo}`}
          documentId={viewing.documentId}
          documentName={viewing.documentName}
          pageNo={viewing.pageNo}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
