/**
 * Web Worker: Fuse.js ile bulanık arama.
 * Ana thread'i bloke etmeden ağır aramaları çalıştırır.
 */
import * as Comlink from "comlink";
import Fuse, { type FuseOptionKey } from "fuse.js";

const DEFAULT_THRESHOLD = 0.4;

interface FuzzySearchPayload<T> {
  list: T[];
  query: string;
  keys: (keyof T | string)[];
  threshold?: number;
  limit?: number;
}

function fuzzySearchInWorker<T>({
  list,
  query,
  keys,
  threshold = DEFAULT_THRESHOLD,
  limit,
}: FuzzySearchPayload<T>): T[] {
  const trimmed = (query || "").trim();
  if (!trimmed || list.length === 0) return list;

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

const api = {
  search: fuzzySearchInWorker,
};

export type FuzzySearchWorkerApi = typeof api;

Comlink.expose(api);
