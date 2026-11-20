"use client";

// 유사 선결정례·판결 찾기 패널: 조사자가 입력한 검색어로 조세심판원 결정이나 판례를 찾아 본문을 읽는다.
// 서류 검색창과 다른 입력창을 쓰며, 이 패널이 법제처로 보내는 값은 입력한 검색어와 고른 사례 번호뿐이다.
// 읽고 참고하는 용도이며 초안에 담지 않는다.
// Design Ref: §4.6 유사 사례 찾기
import { useState } from "react";
import type { CaseDetail, CaseKind, CaseSummary } from "@/lib/law/cases";

interface Result {
  items: CaseSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const KIND_LABEL: Record<CaseKind, string> = { decision: "조세심판원 결정", precedent: "판례(대법원 등)" };

export default function CasePanel() {
  const [kind, setKind] = useState<CaseKind>("decision");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<{ kind: CaseKind; query: string } | null>(null); // 마지막으로 찾은 조건
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<CaseSummary | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function search(nextKind: CaseKind, nextQuery: string, page: number) {
    setSearching(true);
    setError(null);
    setSelected(null);
    setDetail(null);
    setDetailError(null);
    try {
      const params = new URLSearchParams({ kind: nextKind, q: nextQuery, page: String(page) });
      const res = await fetch(`/api/law/cases?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "지금은 유사 사례를 찾을 수 없습니다.");
      setResult(body as Result);
      setSearched({ kind: nextKind, query: nextQuery });
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void search(kind, query, 1);
  }

  async function open(item: CaseSummary) {
    setSelected(item);
    setDetail(null);
    setDetailError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/law/cases/${encodeURIComponent(item.id)}?kind=${item.kind}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "지금은 유사 사례를 찾을 수 없습니다.");
      setDetail(body.detail as CaseDetail);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const lastPage = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <section aria-label="유사 선결정례·판결 찾기" className="rounded border border-zinc-200 bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold">유사 선결정례·판결 찾기</h2>
      <p className="mb-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
        ⓘ 입력한 검색어가 법제처로 전송됩니다. 서류 내용은 전송되지 않습니다. 사건 서류의 글을 붙여 넣지 마세요.
      </p>

      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-3 text-sm">
          {(Object.keys(KIND_LABEL) as CaseKind[]).map((k) => (
            <label key={k} className="flex items-center gap-1">
              <input type="radio" name="case-kind" checked={kind === k} onChange={() => setKind(k)} />
              {KIND_LABEL[k]}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            placeholder="검색어 (예: 경정청구 기한)"
            aria-label="사례 검색어"
            className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={searching || query.trim() === ""}
            className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:text-zinc-400"
          >
            {searching ? "찾는 중…" : "사례 찾기"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && !error && searched && (
        <div className="mt-2">
          <p className="text-xs text-zinc-600">
            {KIND_LABEL[searched.kind]} · &quot;{searched.query}&quot; 검색 결과 {result.total.toLocaleString("ko-KR")}건
            {result.total > 0 && ` (${result.page}/${lastPage}쪽)`}
          </p>
          {result.items.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">찾은 사례가 없습니다. 검색어를 바꿔 다시 찾아 주세요.</p>
          ) : (
            <ul className="mt-1 max-h-64 space-y-1 overflow-y-auto">
              {result.items.map((item) => (
                <li
                  key={item.id}
                  className={`rounded border px-2 py-1 text-sm ${selected?.id === item.id ? "border-blue-400 bg-blue-50" : "border-zinc-200"}`}
                >
                  <p className="font-medium">{item.title || "(사건명 없음)"}</p>
                  <p className="text-xs text-zinc-500">
                    {[item.caseNo, item.date, item.org].filter(Boolean).join(" · ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => void open(item)}
                    className="mt-1 rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
                  >
                    {selected?.id === item.id ? "보는 중" : "본문 보기"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lastPage > 1 && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={searching || result.page <= 1}
                onClick={() => void search(searched.kind, searched.query, result.page - 1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:text-zinc-400"
              >
                이전
              </button>
              <button
                type="button"
                disabled={searching || result.page >= lastPage}
                onClick={() => void search(searched.kind, searched.query, result.page + 1)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:text-zinc-400"
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p className="mt-2 text-sm text-zinc-500">본문을 가져오는 중…</p>}
      {detailError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {detailError}
        </p>
      )}

      {selected && detail && (
        <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-sm font-medium">{selected.title || "(사건명 없음)"}</p>
          <p className="text-xs text-zinc-500">
            {[selected.caseNo, selected.date, selected.org].filter(Boolean).join(" · ")} · 가져온 시각{" "}
            {new Date(detail.fetchedAt).toLocaleString("ko-KR")}
          </p>

          {detail.bodyAvailable ? (
            <div className="mt-2 max-h-96 space-y-3 overflow-y-auto">
              {detail.sections.map((s) => (
                <div key={s.label}>
                  <h3 className="text-xs font-semibold text-zinc-700">{s.label}</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-700">
              법제처가 이 사례의 본문을 이 방식으로는 제공하지 않습니다.
              {detail.webUrl && (
                <>
                  {" "}
                  <a
                    href={detail.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 underline"
                  >
                    법제처 국가법령정보센터에서 본문 보기
                  </a>{" "}
                  (새 창에서 법제처 사이트가 열립니다. 이 앱은 그 창에 아무것도 보내지 않습니다.)
                </>
              )}
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            출처: 법제처 국가법령정보센터. 읽고 참고하는 용도이며 초안에는 담기지 않습니다. 최신 내용은 법제처에서 확인하세요.
          </p>
        </div>
      )}
    </section>
  );
}
