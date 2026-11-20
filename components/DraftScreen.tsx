"use client";

// 초안 화면: 담은 원문을 청구인 주장 / 처분청 의견 / 사실관계 세 항목으로 모아 보여 주고,
// 수정(원문은 따로 보관, "수정됨" 표시)과 빼기를 할 수 있다.
// Design Ref: §4.2 초안 화면, §5.3 담기와 초안, 저장
import Link from "next/link";
import { useEffect, useState } from "react";
import PageImageViewer from "@/components/PageImageViewer";
import QuoteView from "@/components/QuoteView";
import { autoSectionFor, PICK_SECTIONS, SECTION_LABELS, type PickSection } from "@/lib/pick/rules";
import { KIND_LABELS, KIND_SIDE, sourceLabel, type DraftDocument, type DraftPage, type LawPick, type Pick } from "@/lib/store/types";

type ExportKind = "docx" | "hwpx" | "evidence-list";

export default function DraftScreen() {
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [lawPicks, setLawPicks] = useState<LawPick[]>([]);
  // 서류 전문: 올린 서류와 쪽별 글(글자가 있는 쪽만). 서류마다 초안에 넣을지 정할 수 있다.
  const [draftDocs, setDraftDocs] = useState<DraftDocument[]>([]);
  const [draftPages, setDraftPages] = useState<DraftPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  // 수정 중인 항목: 그 항목의 번호와 입력 중인 글
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  // 원문을 펼쳐 보고 있는 항목들
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  // 쪽 그림을 보고 있는 항목
  const [viewing, setViewing] = useState<Pick | null>(null);
  const [saving, setSaving] = useState(false);
  // 저장 파일(워드/한글)을 만드는 중인지
  // 방금 저장한 파일: 어떤 종류인지, 저장된 전체 경로와 파일 이름
  const [saved, setSaved] = useState<{ format: ExportKind; path: string; fileName: string } | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  // 처음 열릴 때 담은 원문을 불러온다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/picks")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "담은 원문을 불러오지 못했습니다.");
        if (!cancelled) setPicks(body.picks as Pick[]);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    fetch("/api/draft/documents")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "서류 전문을 불러오지 못했습니다.");
        if (!cancelled) {
          setDraftDocs(body.documents as DraftDocument[]);
          setDraftPages(body.pages as DraftPage[]);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    fetch("/api/law/picks")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "담은 법령 조문을 불러오지 못했습니다.");
        if (!cancelled) setLawPicks(body.lawPicks as LawPick[]);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 서버에 요청을 보내고, 성공하면 최신 목록으로 바꾼다. 실패하면 안내 문구를 돌려준다. */
  async function send(url: string, init: RequestInit): Promise<string | null> {
    try {
      const res = await fetch(url, init);
      const body = await res.json();
      if (!res.ok) return body?.error?.message ?? "요청을 처리하지 못했습니다.";
      setPicks(body.picks as Pick[]);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function saveEdit(id: string, editedText: string | null) {
    setSaving(true);
    setError(null);
    const failure = await send(`/api/picks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editedText }),
    });
    setSaving(false);
    if (failure) setError(failure);
    else setEditing(null);
  }

  async function remove(id: string) {
    setError(null);
    const failure = await send(`/api/picks/${id}`, { method: "DELETE" });
    if (failure) setError(failure);
    else if (editing?.id === id) setEditing(null);
  }

  /** 초안을 워드·한글·증거 목록표 파일로 만들어 이 컴퓨터의 exports 폴더에 저장한다. 실패하면 안내 문구를 보여 준다. */
  async function download(format: ExportKind) {
    const label = format === "hwpx" ? "한글" : format === "docx" ? "워드" : "증거 목록표";
    setError(null);
    setExporting(format);
    try {
      const res = await fetch(`/api/export/${format}?save=1`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? `${label} 파일을 만들지 못했습니다.`);
      setSaved({ format, path: body.savedPath as string, fileName: body.fileName as string });
    } catch (e) {
      setSaved(null);
      setError((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  /** 저장한 파일이 있는 폴더를 탐색기로 연다. */
  async function openFolder() {
    try {
      const res = await fetch("/api/export/open-folder", { method: "POST" });
      if (!res.ok) throw new Error("폴더를 열지 못했습니다. 위 경로를 직접 열어 주세요.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** 올린 서류의 전문을 초안에 넣거나 뺀다. */
  async function toggleDocument(id: string, inDraft: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inDraft }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "바꾸지 못했습니다.");
      setDraftDocs(body.documents as DraftDocument[]);
      setDraftPages(body.pages as DraftPage[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** 한 항목 안에 들어가는 서류 전문 블록: 서류마다 쪽별 글을 그대로 보여 준다. */
  function fullTextBlock(section: PickSection) {
    const docs = draftDocs.filter((d) => autoSectionFor(d.kind) === section);
    if (docs.length === 0) return null;
    return (
      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-700">서류 전문 (올린 서류의 글을 쪽별로 그대로)</h3>
        {docs.map((doc) => {
          const pages = draftPages.filter((p) => p.documentId === doc.id);
          return (
            <div key={doc.id} className="rounded border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{sourceLabel(doc.name, doc.evidenceName)}</p>
                <span className="text-xs text-zinc-500">
                  {KIND_LABELS[doc.kind]} · {doc.pageCount}쪽
                </span>
                <button
                  type="button"
                  onClick={() => void toggleDocument(doc.id, !doc.inDraft)}
                  className="ml-auto rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50"
                >
                  {doc.inDraft ? "초안에서 빼기" : "초안에 다시 넣기"}
                </button>
              </div>
              {!doc.inDraft && <p className="mt-1 text-xs text-zinc-500">이 서류의 전문은 초안에서 빠져 있습니다.</p>}
              {doc.inDraft && doc.emptyPageCount > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  글자가 없는 {doc.emptyPageCount}쪽은 들어가지 않았습니다. 메인 화면에서 글자 인식을 하면 들어갑니다.
                </p>
              )}
              {doc.inDraft &&
                pages.map((page) => (
                  <div key={page.pageNo} className="mt-2 border-t border-zinc-100 pt-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{page.text}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      출처: {sourceLabel(page.documentName, page.evidenceName)} · {page.pageNo}쪽 ({KIND_SIDE[page.kind]} ·{" "}
                      {KIND_LABELS[page.kind]}) · 서류 전문
                      {page.uncertain && <span className="ml-2 text-amber-700">[인식 불확실]</span>}
                    </p>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    );
  }

  /** 담은 법령 조문을 뺀다. (조문은 수정할 수 없다) */
  async function removeLaw(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/law/picks/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "빼지 못했습니다.");
      setLawPicks(body.lawPicks as LawPick[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function toggleOriginal(id: string) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = (picks?.length ?? 0) + lawPicks.length + draftPages.length;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3">
        <Link href="/" className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50">
          ← 메인으로
        </Link>
        <h1 className="text-lg font-semibold">사건조사서 초안</h1>
        <span className="text-sm text-zinc-600">담은 원문 {total}건</span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={exporting !== null || total === 0}
            title={total === 0 ? "담은 원문이 있어야 저장할 수 있습니다" : undefined}
            onClick={() => void download("docx")}
            className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-800 hover:bg-blue-50 disabled:border-zinc-300 disabled:text-zinc-400"
          >
            {exporting === "docx" ? "만드는 중…" : "워드(.docx)로 저장"}
          </button>
          <button
            type="button"
            disabled={exporting !== null || total === 0}
            title={total === 0 ? "담은 원문이 있어야 저장할 수 있습니다" : undefined}
            onClick={() => void download("hwpx")}
            className="rounded border border-blue-300 px-3 py-1 text-sm text-blue-800 hover:bg-blue-50 disabled:border-zinc-300 disabled:text-zinc-400"
          >
            {exporting === "hwpx" ? "만드는 중…" : "한글(.hwpx)로 저장"}
          </button>
          <button
            type="button"
            disabled={exporting !== null}
            title="올린 증거서류를 증거 이름 순서로 정리한 표를 워드 파일로 저장합니다"
            onClick={() => void download("evidence-list")}
            className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:text-zinc-400"
          >
            {exporting === "evidence-list" ? "만드는 중…" : "증거 목록표(.docx)"}
          </button>
        </div>
      </header>

      {total === 0 && (
        <p className="bg-amber-50 px-6 py-2 text-sm text-amber-800">
          워드·한글 저장은 담은 원문이 있어야 눌러집니다. 메인 화면에서 검색한 뒤 원문을 담아 주세요. (증거 목록표는 증거서류를 올렸다면 바로 저장할 수 있습니다.)
        </p>
      )}
      {saved && (
        <div role="status" className="bg-green-50 px-6 py-2 text-sm text-green-800">
          <p>
            저장했습니다: <span className="font-mono break-all">{saved.path}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void openFolder()} className="rounded border border-green-400 px-2 py-0.5 text-xs hover:bg-green-100">
              저장 폴더 열기
            </button>
            <a
              href={`/api/export/${saved.format}`}
              download={saved.fileName}
              className="rounded border border-green-400 px-2 py-0.5 text-xs hover:bg-green-100"
            >
              브라우저로 내려받기
            </a>
            <span className="text-xs text-green-700">서류 내용이 들어 있으니 쓴 뒤 안전한 곳으로 옮기세요. 사건 삭제 때 이 폴더의 파일도 함께 지워집니다.</span>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="bg-red-50 px-6 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <main className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <p className="rounded bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
          초안의 모든 글에는 출처(서류와 쪽)가 붙어 있습니다. 글을 고쳐도 원문과 출처는 그대로 보관되며, 고친 글에는
          &quot;수정됨&quot;이 표시됩니다. 오탈자를 바로잡는 정도로만 고치고, 어느 쪽 주장이 옳은지 판단하는 글은 쓰지
          마세요.
        </p>

        {picks === null && !error && <p className="text-sm text-zinc-500">불러오는 중…</p>}

        {picks !== null &&
          PICK_SECTIONS.map((section) => {
            const items = picks.filter((p) => p.section === section);
            return (
              <section key={section} aria-label={SECTION_LABELS[section]}>
                <h2 className="mb-2 border-b border-zinc-300 pb-1 text-base font-semibold">
                  {SECTION_LABELS[section]} ({items.length})
                </h2>
                {items.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    담은 원문이 없습니다. 메인 화면에서 검색한 뒤 [{SECTION_LABELS[section]}에 담기]를 눌러 주세요.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {items.map((pick, index) => {
                      const isEditing = editing?.id === pick.id;
                      const edited = pick.editedText !== null;
                      return (
                        <li key={pick.id} className="rounded border border-zinc-200 bg-white p-3">
                          <div className="flex gap-2">
                            <span className="text-sm text-zinc-500">{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editing.text}
                                    onChange={(e) => setEditing({ id: pick.id, text: e.target.value })}
                                    rows={4}
                                    maxLength={4000}
                                    aria-label="수정할 글"
                                    className="w-full rounded border border-zinc-300 p-2 text-sm leading-relaxed"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => void saveEdit(pick.id, editing.text)}
                                      className="rounded border border-blue-400 px-2 py-1 text-xs text-blue-800 hover:bg-blue-50 disabled:text-zinc-400"
                                    >
                                      {saving ? "저장 중…" : "저장"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => setEditing(null)}
                                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                                    >
                                      취소
                                    </button>
                                    {edited && (
                                      <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => void saveEdit(pick.id, null)}
                                        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                                      >
                                        원문으로 되돌리기
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {edited ? (
                                    pick.editedText
                                  ) : (
                                    <QuoteView text={pick.quote} uncertain={pick.uncertain} />
                                  )}
                                </p>
                              )}

                              <p className="mt-1 text-xs text-zinc-500">
                                출처: {sourceLabel(pick.documentName, pick.evidenceName)} · {pick.pageNo}쪽 (
                                {KIND_SIDE[pick.kind]} · {KIND_LABELS[pick.kind]})
                                {edited && <span className="ml-2 font-medium text-blue-700">수정됨</span>}
                              </p>
                              {pick.uncertain.length > 0 && (
                                <p className="text-xs text-amber-700">
                                  [인식 불확실] 원문에 글자 인식이 불확실한 부분이 있습니다. 원본 쪽 그림으로 확인하세요.
                                  {!edited && " (점선 밑줄 친 글자)"}
                                </p>
                              )}

                              {/* 수정한 글이 있을 때만 원문 상자를 보여 준다. (되돌린 뒤에는 같은 글이 두 번 보이지 않게) */}
                              {edited && showOriginal.has(pick.id) && (
                                <div className="mt-2 rounded border border-dashed border-zinc-300 bg-zinc-50 p-2">
                                  <p className="text-xs font-medium text-zinc-600">원문 (저장된 서류의 글자 그대로)</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                                    <QuoteView text={pick.quote} uncertain={pick.uncertain} />
                                  </p>
                                </div>
                              )}

                              {!isEditing && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ id: pick.id, text: pick.editedText ?? pick.quote })}
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                                  >
                                    수정
                                  </button>
                                  {edited && (
                                    <button
                                      type="button"
                                      onClick={() => toggleOriginal(pick.id)}
                                      className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                                    >
                                      {showOriginal.has(pick.id) ? "원문 숨기기" : "원문 보기"}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setViewing(pick)}
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                                  >
                                    쪽 그림
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void remove(pick.id)}
                                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                                  >
                                    빼기
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {fullTextBlock(section)}
              </section>
            );
          })}
        {/* 관계 법령: 담은 조문이 있을 때만 보인다. 법제처가 준 글 그대로이고 수정할 수 없다. */}
        {lawPicks.length > 0 && (
          <section aria-label="관계 법령">
            <h2 className="mb-2 border-b border-zinc-300 pb-1 text-base font-semibold">관계 법령 ({lawPicks.length})</h2>
            <ol className="space-y-3">
              {lawPicks.map((law, index) => (
                <li key={law.id} className="rounded border border-zinc-200 bg-white p-3">
                  <div className="flex gap-2">
                    <span className="text-sm text-zinc-500">{index + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {law.lawName} {law.articleLabel}
                        {law.title && ` (${law.title})`}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{law.text}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        출처: 법제처 국가법령정보센터 · 시행일 {law.effectiveDate || "확인 안 됨"} · 가져온 시각{" "}
                        {new Date(law.fetchedAt).toLocaleString("ko-KR")}
                      </p>
                      <p className="text-xs text-zinc-500">법령은 개정될 수 있으니 법제처에서 최신 내용을 확인하세요. (조문은 수정할 수 없습니다)</p>
                      <button
                        type="button"
                        onClick={() => void removeLaw(law.id)}
                        className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                      >
                        빼기
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      {viewing && (
        <PageImageViewer
          key={`${viewing.documentId}-${viewing.pageNo}`}
          documentId={viewing.documentId}
          documentName={sourceLabel(viewing.documentName, viewing.evidenceName)}
          pageNo={viewing.pageNo}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
