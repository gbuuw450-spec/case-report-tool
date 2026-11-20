// 방금 법제처에서 가져온 조문을 잠시 서버에 기억해 두는 곳.
// 조문을 담을 때 화면이 글을 다시 보내지 않고 이 번호표(token)만 보내게 해서,
// 담기는 글이 법제처가 준 글과 같음을 보장한다. (화면에서 글을 바꿔 보낼 수 없다)
import { randomUUID } from "node:crypto";
import type { LawArticle } from "./types";

const TTL_MS = 60 * 60 * 1000; // 1시간
const MAX_ENTRIES = 50;

const globalForCache = globalThis as unknown as { __lawArticleCache?: Map<string, { article: LawArticle; at: number }> };
const cache = (globalForCache.__lawArticleCache ??= new Map());

/** 조문을 기억하고 번호표를 돌려준다. */
export function rememberArticle(article: LawArticle): string {
  const now = Date.now();
  for (const [token, entry] of cache) if (now - entry.at > TTL_MS) cache.delete(token);
  while (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  const token = randomUUID();
  cache.set(token, { article, at: now });
  return token;
}

/** 번호표로 조문을 찾는다. 없거나 오래됐으면 null */
export function recallArticle(token: unknown): LawArticle | null {
  if (typeof token !== "string") return null;
  const entry = cache.get(token);
  if (!entry || Date.now() - entry.at > TTL_MS) return null;
  return entry.article;
}

/** 기억해 둔 조문을 모두 잊는다. (사건 삭제 때) */
export function clearArticleCache(): void {
  cache.clear();
}
