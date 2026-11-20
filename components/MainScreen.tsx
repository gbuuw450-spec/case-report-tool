"use client";

// 메인 화면: 서류 칸 / 찾기 / 담은 원문 세 영역의 기본 틀
// Design Ref: §4.1 메인 화면, §4.4 화면별 확인 목록
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import CasePanel from "@/components/CasePanel";
import LawPanel from "@/components/LawPanel";
import PicksPanel from "@/components/PicksPanel";
import SearchPanel, { type SearchHit } from "@/components/SearchPanel";
import { runOcr, type OcrProgress } from "@/lib/ocr/runOcr";
import type { PickSection } from "@/lib/pick/rules";
import {
  DOCUMENT_KINDS,
  type DocumentKind,
  isEvidenceKind,
  KIND_LABELS,
  KIND_SIDE,
  sourceLabel,
  type CaseSummary,
  type DocumentStatus,
  type LawPick,
  type Pick,
} from "@/lib/store/types";

const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: "대기",
  processing: "변환 중",
  done: "완료",
  partial: "일부 쪽 글자 없음",
  error: "변환 실패",
};

export default function MainScreen() {
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 조사자가 담은 원문 (③ 담은 원문과 검색 결과의 [담기] 버튼이 함께 쓴다)
  const [picks, setPicks] = useState<Pick[]>([]);
  const [lawPicks, setLawPicks] = useState<LawPick[]>([]);
  const [uploadingKind, setUploadingKind] = useState<DocumentKind | null>(null);
  // 서류 구분마다 숨겨 둔 파일 선택창을 하나씩 가진다.
  const fileInputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});
  // 증거서류 칸마다 조사자가 입력하는 증거 이름 (갑 제1호증 등)
  const [evidenceNames, setEvidenceNames] = useState<Partial<Record<DocumentKind, string>>>({});
  // 글자 인식은 한 번에 한 서류만 한다. 진행 상황을 서류 번호와 함께 보여 준다.
  const [ocr, setOcr] = useState<{ documentId: string; progress: OcrProgress } | null>(null);
  const ocrRunning = useRef(false);
  // 증거 이름 입력칸과, 이름 없이 올리기를 눌렀을 때 안내를 띄울 구분
  const nameInputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});
  const [nameMissing, setNameMissing] = useState<DocumentKind | null>(null);
  // 올린 서류를 다시 받은 결과: 저장된 경로와 브라우저 내려받기 주소
  const [savedDoc, setSavedDoc] = useState<{ id: string; path: string; fileName: string } | null>(null);
  // 사건 삭제 확인 창: 어떤 이름으로 물었는지(삭제 / 새 사건)와 지우는 중인지
  const [confirmDelete, setConfirmDelete] = useState<"delete" | "new" | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 저장된 서류 목록을 불러온다.
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "불러오지 못했습니다.");
      setSummary(body as CaseSummary);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // 처음 열릴 때 서류 목록과 담은 원문을 불러온다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "불러오지 못했습니다.");
        if (!cancelled) setSummary(body as CaseSummary);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    fetch("/api/picks")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "담은 원문을 불러오지 못했습니다.");
        if (!cancelled) setPicks(body.picks as Pick[]);
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

  // 검색 결과의 원문을 항목에 담는다. 실패하면 안내 문구를 돌려준다. (서버가 담기 규칙과 원문 일치를 다시 확인한다)
  async function pickQuote(hit: SearchHit, section: PickSection): Promise<string | null> {
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          documentId: hit.documentId,
          pageNo: hit.pageNo,
          quote: hit.sentence,
          start: hit.sentenceStart,
        }),
      });
      const body = await res.json();
      if (!res.ok) return body?.error?.message ?? "원문을 담지 못했습니다.";
      setPicks(body.picks as Pick[]);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  // 담은 원문을 뺀다.
  async function removePick(id: string) {
    try {
      const res = await fetch(`/api/picks/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "빼지 못했습니다.");
      setPicks(body.picks as Pick[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // 사건 전체를 지운다. (서류 원본, 글자 변환 결과, 담은 원문, 저장소 파일을 이 컴퓨터에서 실제로 지운다)
  async function deleteCase() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/case", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_CASE" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "사건을 지우지 못했습니다.");
      setPicks([]);
      setLawPicks([]);
      setOcr(null);
      setEvidenceNames({});
      await loadSummary();
      setConfirmDelete(null);
    } catch (e) {
      setError((e as Error).message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  // 올린 원본 PDF를 이 컴퓨터의 exports 폴더에 저장한다. (앱 안의 브라우저 창은 내려받기를 저장하지 않아서)
  async function saveDocument(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/documents/${id}/file?save=1`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "서류를 저장하지 못했습니다.");
      setSavedDoc({ id, path: body.savedPath as string, fileName: body.fileName as string });
    } catch (e) {
      setSavedDoc(null);
      setError((e as Error).message);
    }
  }

  // 저장 폴더를 탐색기로 연다.
  async function openExportFolder() {
    try {
      const res = await fetch("/api/export/open-folder", { method: "POST" });
      if (!res.ok) throw new Error("폴더를 열지 못했습니다. 위 경로를 직접 열어 주세요.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // 담은 법령 조문을 뺀다.
  async function removeLawPick(id: string) {
    try {
      const res = await fetch(`/api/law/picks/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "빼지 못했습니다.");
      setLawPicks(body.lawPicks as LawPick[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // 글자가 없는 쪽(스캔 쪽)을 글자 인식한다. 쪽마다 저장하므로 중간에 멈춰도 이어서 할 수 있다.
  async function startOcr(documentId: string) {
    if (ocrRunning.current) return;
    ocrRunning.current = true;
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/pages`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "인식할 쪽을 확인하지 못했습니다.");
      const pageNos = body.pageNos as number[];
      if (pageNos.length === 0) return;

      setOcr({ documentId, progress: { done: 0, total: pageNos.length, failed: 0, currentPage: pageNos[0] } });
      await runOcr(documentId, pageNos, (progress) => setOcr({ documentId, progress }));
    } catch (e) {
      setError(`글자 인식 중 문제가 생겼습니다: ${(e as Error).message}`);
    } finally {
      ocrRunning.current = false;
      setOcr(null);
      await loadSummary();
    }
  }

  // 파일을 고르면 구분과 함께 서버로 보낸다. 안내 문구는 서버가 정한 그대로 보여 준다.
  async function handleFileChosen(kind: DocumentKind, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploadingKind(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      // 증거서류는 증거 이름을 함께 보낸다. (비어 있으면 서버가 안내 문구로 막는다)
      if (isEvidenceKind(kind)) form.append("evidenceName", evidenceNames[kind] ?? "");
      form.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "서류를 올리지 못했습니다.");
      // 올렸으면 다음 증거서류를 위해 입력창을 비운다.
      setEvidenceNames((prev) => ({ ...prev, [kind]: "" }));
      await loadSummary();
      // 글자가 없는 쪽(스캔 쪽)이 있으면 바로 글자 인식을 시작한다.
      if ((body.document?.emptyPageCount ?? 0) > 0) void startOcr(body.document.id as string);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingKind(null);
      // 같은 파일을 다시 골라도 반응하도록 선택창을 비운다.
      const input = fileInputs.current[kind];
      if (input) input.value = "";
    }
  }

  const total = summary?.totalPages ?? 0;
  const max = summary?.maxPages ?? 100;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      {/* 상단 바: 사건 이름, 쪽수 합계, 초안 보기, 사건 삭제 */}
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-6 py-3">
        <h1 className="text-lg font-semibold">사건조사서 작성 툴</h1>
        <span className="rounded bg-zinc-100 px-2 py-1 text-sm">
          {summary?.case.name ?? "사건 불러오는 중"}
        </span>
        <span className="text-sm text-zinc-600" aria-live="polite">
          서류 합계 {total} / {max}쪽
        </span>
        <div className="ml-auto flex gap-2">
          <Link href="/draft" className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50">
            초안 보기 (서류 {summary?.documents.length ?? 0}건 · 담은 원문 {picks.length + lawPicks.length}건)
          </Link>
          <button
            type="button"
            disabled={ocr !== null || uploadingKind !== null}
            title={ocr !== null || uploadingKind !== null ? "서류를 올리거나 글자 인식 중에는 지울 수 없습니다" : undefined}
            onClick={() => setConfirmDelete("new")}
            className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:text-zinc-400"
          >
            새 사건
          </button>
          <button
            type="button"
            disabled={ocr !== null || uploadingKind !== null}
            title={ocr !== null || uploadingKind !== null ? "서류를 올리거나 글자 인식 중에는 지울 수 없습니다" : undefined}
            onClick={() => setConfirmDelete("delete")}
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:border-zinc-300 disabled:text-zinc-400"
          >
            사건 삭제
          </button>
        </div>
      </header>

      {confirmDelete && (
        <div role="dialog" aria-modal="true" aria-label="사건 삭제 확인" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold text-red-700">
              {confirmDelete === "new" ? "새 사건을 시작할까요? 이전 사건이 삭제됩니다." : "사건을 삭제할까요?"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              올린 서류 {summary?.documents.length ?? 0}건과 글자 변환 결과, 담은 원문 {picks.length}건, 담은 법령 조문{" "}
              {lawPicks.length}건이 이 컴퓨터에서 <strong>완전히 지워지며 되돌릴 수 없습니다.</strong> 휴지통에도 남지 않습니다.
            </p>
            <p className="mt-2 text-sm text-zinc-600">필요한 초안은 삭제하기 전에 워드·한글 파일로 저장해 두세요. 저장해 둔 파일(exports 폴더)도 함께 지워지니 필요하면 다른 곳으로 옮겨 두세요.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteCase()}
                className="rounded border border-red-400 bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {deleting ? "지우는 중…" : confirmDelete === "new" ? "삭제하고 새 사건 시작" : "완전히 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="bg-red-50 px-6 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr_300px]">
        {/* ① 서류 칸 */}
        <section aria-label="서류 칸" className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-700">① 서류</h2>
          {DOCUMENT_KINDS.map((kind) => {
            const docs = summary?.documents.filter((d) => d.kind === kind) ?? [];
            return (
              <div key={kind} className="rounded border border-zinc-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{KIND_LABELS[kind]}</p>
                    <p className="text-xs text-zinc-500">{KIND_SIDE[kind]}</p>
                  </div>
                  {/* accept를 두지 않는다: PDF가 아닌 파일을 골랐을 때도 안내 문구가 보이게 하기 위해 */}
                  <input
                    ref={(el) => {
                      fileInputs.current[kind] = el;
                    }}
                    type="file"
                    className="hidden"
                    aria-label={`${KIND_LABELS[kind]} 파일 선택`}
                    onChange={(e) => void handleFileChosen(kind, e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={uploadingKind !== null}
                    onClick={() => {
                      // 증거서류는 증거 이름을 먼저 입력해야 한다. 비어 있으면 입력칸으로 안내한다.
                      if (isEvidenceKind(kind) && !(evidenceNames[kind] ?? "").trim()) {
                        setNameMissing(kind);
                        nameInputs.current[kind]?.focus();
                        return;
                      }
                      setNameMissing(null);
                      fileInputs.current[kind]?.click();
                    }}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:text-zinc-400"
                  >
                    {uploadingKind === kind ? "올리는 중…" : "+ 올리기"}
                  </button>
                </div>
                {/* 증거서류는 올릴 때 증거 이름을 직접 입력한다. 사실관계의 출처에 쓰인다. */}
                {isEvidenceKind(kind) && (
                  <input
                    type="text"
                    ref={(el) => {
                      nameInputs.current[kind] = el;
                    }}
                    value={evidenceNames[kind] ?? ""}
                    onChange={(e) => {
                      setEvidenceNames((prev) => ({ ...prev, [kind]: e.target.value }));
                      if (nameMissing === kind) setNameMissing(null);
                    }}
                    maxLength={50}
                    aria-label={`${KIND_LABELS[kind]} 증거 이름`}
                    placeholder={`증거 이름 입력 (예: ${kind === "claimantEvidence" ? "갑 제1호증" : "을 제1호증"})`}
                    className="mt-2 w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                )}
                {isEvidenceKind(kind) && (
                  <p className={`mt-1 text-xs ${nameMissing === kind ? "font-medium text-red-700" : "text-zinc-500"}`}>
                    {nameMissing === kind
                      ? "증거 이름을 먼저 입력해 주세요. 입력한 뒤 [+ 올리기]를 누르면 파일을 고를 수 있습니다."
                      : "증거 이름을 입력한 뒤 [+ 올리기]를 누르세요."}
                  </p>
                )}
                {docs.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-400">올린 서류가 없습니다.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {docs.map((d) => (
                      <li key={d.id} className="text-sm">
                        <div className="flex justify-between">
                          <span className="truncate" title={sourceLabel(d.name, d.evidenceName)}>
                            {sourceLabel(d.name, d.evidenceName)}
                          </span>
                          <span className="ml-2 shrink-0 text-xs text-zinc-500">
                            {d.pageCount > 0 ? `${d.pageCount}쪽` : "쪽수 확인 전"} ·{" "}
                            {STATUS_LABELS[d.status]}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveDocument(d.id)}
                          title="올린 원본 PDF를 이 컴퓨터의 exports 폴더에 저장합니다"
                          className="mt-0.5 rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-50"
                        >
                          내려받기
                        </button>
                        {savedDoc?.id === d.id && (
                          <div role="status" className="mt-1 rounded bg-green-50 p-1.5 text-xs text-green-800">
                            <p>
                              저장했습니다: <span className="font-mono break-all">{savedDoc.path}</span>
                            </p>
                            <div className="mt-1 flex gap-1">
                              <button type="button" onClick={() => void openExportFolder()} className="rounded border border-green-400 px-1.5 py-0.5 hover:bg-green-100">
                                저장 폴더 열기
                              </button>
                              <a
                                href={`/api/documents/${d.id}/file?download=1`}
                                download={savedDoc.fileName}
                                className="rounded border border-green-400 px-1.5 py-0.5 hover:bg-green-100"
                              >
                                브라우저로 내려받기
                              </a>
                            </div>
                          </div>
                        )}
                        {ocr?.documentId === d.id ? (
                          <p role="status" className="text-xs text-blue-700">
                            글자 인식 중 {ocr.progress.done}/{ocr.progress.total}쪽
                            {ocr.progress.currentPage > 0 && ` (${ocr.progress.currentPage}쪽 처리 중)`}
                            {ocr.progress.failed > 0 && ` · 실패 ${ocr.progress.failed}쪽`}
                          </p>
                        ) : (
                          <>
                            {d.failedPageCount > 0 && (
                              <p className="text-xs text-red-700">인식 실패 {d.failedPageCount}쪽</p>
                            )}
                            {d.emptyPageCount + d.failedPageCount > 0 && d.status !== "error" && (
                              <p className="text-xs text-amber-700">
                                글자가 없는 쪽 {d.emptyPageCount + d.failedPageCount}쪽{" "}
                                <button
                                  type="button"
                                  disabled={ocr !== null}
                                  onClick={() => void startOcr(d.id)}
                                  className="ml-1 rounded border border-amber-400 px-1.5 py-0.5 hover:bg-amber-50 disabled:text-zinc-400"
                                >
                                  {d.failedPageCount > 0 ? "다시 글자 인식" : "글자 인식 시작"}
                                </button>
                              </p>
                            )}
                          </>
                        )}
                        {d.status === "error" && (
                          <p className="text-xs text-red-700">
                            글자를 꺼내지 못했습니다. 다시 저장한 PDF로 올려 주세요.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        {/* ② 찾기 */}
        <div className="space-y-4">
          <SearchPanel
            documentCount={summary?.documents.length ?? 0}
            picked={picks}
            onPick={pickQuote}
          />
          {/* 법령 조문 찾기: 서류 검색과 따로 입력하고, 입력한 법령명·조문 번호만 법제처로 간다 */}
          <LawPanel lawPicks={lawPicks} onAdded={setLawPicks} />
          {/* 유사 선결정례·판결 찾기: 입력한 검색어만 법제처로 간다. 읽고 참고하는 용도 */}
          <CasePanel />
        </div>

        {/* ③ 담은 원문 */}
        <PicksPanel
          picks={picks}
          lawPicks={lawPicks}
          onRemove={(id) => void removePick(id)}
          onRemoveLaw={(id) => void removeLawPick(id)}
        />
      </main>
    </div>
  );
}
