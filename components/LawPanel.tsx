"use client";

// 법령 조문 찾기 패널: 법령명으로 법령을 찾고, 조문 번호를 입력해 조문 글을 가져와 보여 준다.
// 서류 검색창과 다른 입력창을 쓴다. 이 패널이 법제처로 보내는 값은 입력한 법령명과 조문 번호뿐이다.
// Design Ref: §4.5 법령 조문 찾기
import { useState } from "react";
import type { LawArticle, LawSummary } from "@/lib/law/types";
import type { LawPick } from "@/lib/store/types";

interface Props {
  lawPicks: LawPick[]; // 이미 관계 법령에 담은 조문
  onAdded: (lawPicks: LawPick[]) => void;
}

export default function LawPanel({ lawPicks, onAdded }: Props) {
  const [name, setName] = useState("");
  const [laws, setLaws] = useState<LawSummary[] | null>(null);
  const [selected, setSelected] = useState<LawSummary | null>(null);
  const [jo, setJo] = useState("");
  const [article, setArticle] = useState<LawArticle | null>(null);
  const [token, setToken] = useState<string | null>(null); // 담을 때 쓰는 번호표 (서버가 준다)
  const [pickMessage, setPickMessage] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // 법령 찾기 중 오류
  const [articleError, setArticleError] = useState<string | null>(null); // 조문 가져오기 중 오류

  async function searchLaws(event: React.FormEvent) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    setLaws(null);
    setSelected(null);
    setArticle(null);
    setToken(null);
    setPickMessage(null);
    setArticleError(null);
    try {
      const res = await fetch(`/api/law/search?q=${encodeURIComponent(name)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "지금은 법령 조문을 찾을 수 없습니다.");
      setLaws(body.laws as LawSummary[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function selectLaw(law: LawSummary) {
    setSelected(law);
    setArticle(null);
    setToken(null);
    setPickMessage(null);
    setArticleError(null);
  }

  async function loadArticle(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setLoading(true);
    setArticle(null);
    setToken(null);
    setPickMessage(null);
    setArticleError(null);
    try {
      const res = await fetch(`/api/law/article?mst=${encodeURIComponent(selected.mst)}&jo=${encodeURIComponent(jo)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "지금은 법령 조문을 찾을 수 없습니다.");
      setArticle(body.article as LawArticle);
      setToken(body.token as string);
    } catch (e) {
      setArticleError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // 가져온 조문을 관계 법령에 담는다. 서버는 번호표로 기억해 둔 조문 그대로 담는다.
  async function addToDraft() {
    if (!token) return;
    setPicking(true);
    setPickMessage(null);
    try {
      const res = await fetch("/api/law/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "법령 조문을 담지 못했습니다.");
      onAdded(body.lawPicks as LawPick[]);
      setPickMessage("관계 법령에 담았습니다.");
    } catch (e) {
      setPickMessage((e as Error).message);
    } finally {
      setPicking(false);
    }
  }

  const alreadyPicked = article ? lawPicks.some((p) => p.lawName === article.lawName && p.articleLabel === article.articleLabel) : false;

  return (
    <section aria-label="법령 조문 찾기" className="rounded border border-zinc-200 bg-white p-3">
      <h2 className="mb-2 text-sm font-semibold">법령 조문 찾기</h2>
      <p className="mb-3 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
        ⓘ 입력한 법령명과 조문 번호가 법제처로 전송됩니다. 서류 내용은 전송되지 않습니다.
      </p>

      <form onSubmit={searchLaws} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="법령명 (예: 국세기본법)"
          aria-label="법령명"
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={searching || name.trim() === ""}
          className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:text-zinc-400"
        >
          {searching ? "찾는 중…" : "법령 찾기"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {laws !== null && !error && (
        <div className="mt-2">
          {laws.length === 0 ? (
            <p className="text-sm text-zinc-500">찾은 법령이 없습니다. 법령명을 바꿔 다시 찾아 주세요.</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {laws.map((law) => (
                <li
                  key={law.mst}
                  className={`flex items-center gap-2 rounded border px-2 py-1 text-sm ${
                    selected?.mst === law.mst ? "border-blue-400 bg-blue-50" : "border-zinc-200"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    {law.name}
                    <span className="ml-1 text-xs text-zinc-500">
                      {law.kind}
                      {law.effectiveDate && ` · 시행 ${law.effectiveDate}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => selectLaw(law)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
                  >
                    {selected?.mst === law.mst ? "선택됨" : "선택"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <form onSubmit={loadArticle} className="mt-3 space-y-1">
          <p className="text-xs text-zinc-600">선택한 법령: {selected.name}</p>
          <div className="flex gap-2">
            <input
              value={jo}
              onChange={(e) => setJo(e.target.value)}
              maxLength={20}
              placeholder="조문 번호 (예: 제47조의2)"
              aria-label="조문 번호"
              className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={loading || jo.trim() === ""}
              className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:text-zinc-400"
            >
              {loading ? "가져오는 중…" : "조문 보기"}
            </button>
          </div>
        </form>
      )}

      {articleError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {articleError}
        </p>
      )}

      {article && (
        <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-sm font-medium">
            {article.lawName} {article.articleLabel}
            {article.title && ` (${article.title})`}
          </p>
          <p className="text-xs text-zinc-500">
            시행일 {article.effectiveDate || "확인 안 됨"} · 가져온 시각 {new Date(article.fetchedAt).toLocaleString("ko-KR")}
          </p>
          <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{article.text}</p>
          <p className="mt-2 text-xs text-zinc-500">출처: 법제처 국가법령정보센터</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={picking || alreadyPicked || !token}
              onClick={() => void addToDraft()}
              className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-800 hover:bg-blue-50 disabled:border-zinc-300 disabled:text-zinc-400"
            >
              {alreadyPicked ? "담았음" : picking ? "담는 중…" : "관계 법령에 담기"}
            </button>
            {pickMessage && <span className="text-xs text-zinc-600">{pickMessage}</span>}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">법령은 개정될 수 있으니 법제처 국가법령정보센터에서 최신 내용을 확인하세요.</p>
    </section>
  );
}
