/**
 * Proje genelinde kullanılan Fuse.js tabanlı bulanık arama utility'si.
 * Yazım hatalarına toleranslı, Türkçe karakterlere uyumlu arama sağlar.
 */

import Fuse, { type FuseOptionKey } from "fuse.js";

const DEFAULT_THRESHOLD = 0.4; // 0 = tam eşleşme, 1 = hiç eşleşme yok

export interface FuzzySearchOptions<T> {
  /** Aranacak liste */
  list: T[];
  /** Arama metni */
  query: string;
  /** Hangi alanlarda aranacak (örn: ["name", "customer_phone", "tags"]) */
  keys: (keyof T | string)[];
  /** Eşleşme eşiği (0-1): düşük = daha katı, yüksek = daha toleranslı. Varsayılan 0.4 */
  threshold?: number;
  /** Maksimum sonuç sayısı (opsiyonel) */
  limit?: number;
}

/**
 * Fuse.js ile bulanık arama yapar.
 * Query boşsa tüm listeyi döndürür.
 */
export function fuzzySearch<T>({
  list,
  query,
  keys,
  threshold = DEFAULT_THRESHOLD,
  limit,
}: FuzzySearchOptions<T>): T[] {
  const trimmed = (query || "").trim();
  if (!trimmed || list.length === 0) {
    return list;
  }

  const fuse = new Fuse(list, {
    keys: keys as FuseOptionKey<T>[],
    threshold,
    includeScore: false,
  });

  const results = fuse.search(trimmed);
  let items = results.map((r) => r.item);

  if (typeof limit === "number" && limit > 0) {
    items = items.slice(0, limit);
  }

  return items;
}

/**
 * Tek bir en iyi eşleşme döndürür (match_service benzeri).
 * Eşleşme yoksa veya skor eşiğin üstündeyse null döner.
 */
export function fuzzySearchBest<T>(
  list: T[],
  query: string,
  keys: (keyof T | string)[],
  threshold = DEFAULT_THRESHOLD
): { item: T; score: number } | null {
  const trimmed = (query || "").trim();
  if (!trimmed || list.length === 0) return null;

  const fuse = new Fuse(list, {
    keys: keys as FuseOptionKey<T>[],
    threshold,
    includeScore: true,
  });

  const results = fuse.search(trimmed);
  if (results.length === 0) return null;

  const best = results[0];
  const score = best.score ?? 1;
  if (score > threshold) return null;

  return { item: best.item, score };
}
