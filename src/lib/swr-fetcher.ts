/**
 * SWR fetcher - cache, dedupe ve background revalidation için
 */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
