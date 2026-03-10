"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import type { FuzzySearchWorkerApi } from "@/workers/fuzzy-search.worker";
import { fuzzySearch } from "@/lib/fuse-search";

let workerInstance: Comlink.Remote<FuzzySearchWorkerApi> | null = null;
let workerFailed = false;

function getWorker(): Comlink.Remote<FuzzySearchWorkerApi> | null {
  if (workerFailed) return null;
  if (workerInstance) return workerInstance;
  try {
    const worker = new Worker(
      new URL("../workers/fuzzy-search.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerInstance = Comlink.wrap<FuzzySearchWorkerApi>(worker);
    return workerInstance;
  } catch {
    workerFailed = true;
    return null;
  }
}

export interface UseFuzzySearchWorkerOptions<T> {
  list: T[];
  query: string;
  keys: (keyof T | string)[];
  threshold?: number;
  limit?: number;
}

/**
 * Web Worker üzerinde fuzzy search çalıştırır.
 * Ana thread bloke olmaz.
 */
export function useFuzzySearchWorker<T>({
  list,
  query,
  keys,
  threshold = 0.4,
  limit,
}: UseFuzzySearchWorkerOptions<T>): { result: T[]; loading: boolean } {
  const [result, setResult] = useState<T[]>(list);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  const runSearch = useCallback(async () => {
    const trimmed = (query || "").trim();
    if (!trimmed || list.length === 0) {
      setResult(list);
      return;
    }

    const useSync =
      trimmed.length < 3 ||
      list.length < 100;

    const worker = useSync ? null : getWorker();
    if (!worker) {
      const syncResult = fuzzySearch({ list, query: trimmed, keys, threshold, limit });
      setResult(syncResult);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    try {
      const payload = { list, query: trimmed, keys: keys as string[], threshold, limit };
      const res = (await worker.search(payload)) as T[];
      if (!abortRef.current) setResult(res);
    } catch {
      const syncResult = fuzzySearch({ list, query: trimmed, keys, threshold, limit });
      if (!abortRef.current) setResult(syncResult);
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [list, query, keys, threshold, limit]);

  useEffect(() => {
    runSearch();
    return () => {
      abortRef.current = true;
    };
  }, [runSearch]);

  return { result, loading };
}
