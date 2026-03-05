#!/usr/bin/env npx tsx
/**
 * Langfuse API bağlantısını ve veri akışını kontrol eder.
 * Kullanım: npx tsx scripts/check-langfuse.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";
const PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY?.trim();
const SECRET_KEY = process.env.LANGFUSE_SECRET_KEY?.trim();

function getAuthHeader(): string {
  if (!PUBLIC_KEY || !SECRET_KEY) {
    throw new Error("LANGFUSE_PUBLIC_KEY ve LANGFUSE_SECRET_KEY gerekli");
  }
  const encoded = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString("base64");
  return `Basic ${encoded}`;
}

async function fetchLangfuse<T>(path: string): Promise<{ data: T; status: number }> {
  const url = `${LANGFUSE_BASE.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { data, status: res.status };
}

async function main() {
  console.log("=== Langfuse Veri Kontrolü ===\n");

  if (!PUBLIC_KEY || !SECRET_KEY) {
    console.log("❌ LANGFUSE_PUBLIC_KEY veya LANGFUSE_SECRET_KEY .env'de tanımlı değil.");
    process.exit(1);
  }
  console.log("✓ Key'ler mevcut");
  console.log(`  Base URL: ${LANGFUSE_BASE}`);
  console.log(`  Public key: ${PUBLIC_KEY.slice(0, 12)}...`);
  console.log("");

  // 1. Traces API
  console.log("1. Traces API (/api/public/traces)...");
  const tracesRes = await fetchLangfuse<{ data?: unknown[]; meta?: unknown }>(
    "/api/public/traces?limit=5&page=1&orderBy=timestamp.desc&fields=core,metrics"
  );
  if (tracesRes.status !== 200) {
    console.log(`   ❌ Hata: ${tracesRes.status}`, JSON.stringify(tracesRes.data, null, 2).slice(0, 300));
  } else {
    const count = (tracesRes.data as { data?: unknown[] })?.data?.length ?? 0;
    const total = (tracesRes.data as { meta?: { totalItems?: number } })?.meta?.totalItems ?? "?";
    console.log(`   ✓ OK - ${count} trace döndü (toplam: ${total})`);
  }
  console.log("");

  // 2. v2 Metrics API
  console.log("2. v2 Metrics API (/api/public/v2/metrics)...");
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  const queryTotal = {
    view: "observations",
    metrics: [
      { measure: "totalCost", aggregation: "sum" },
      { measure: "count", aggregation: "sum" },
    ],
    dimensions: [],
    filters: [],
    fromTimestamp: from.toISOString(),
    toTimestamp: to.toISOString(),
  };
  const metricsPath = `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryTotal))}`;
  const v2Res = await fetchLangfuse<{ data?: unknown[] }>(metricsPath);
  if (v2Res.status !== 200) {
    console.log(`   ❌ Hata: ${v2Res.status}`, JSON.stringify(v2Res.data, null, 2).slice(0, 400));
  } else {
    const row = (v2Res.data as { data?: Record<string, unknown>[] })?.data?.[0];
    const cost = Number(row?.totalCost ?? row?.totalCost_sum ?? row?.sum_totalCost ?? 0);
    const count = Number(row?.count ?? row?.count_sum ?? row?.sum_count ?? 0);
    console.log(`   ✓ OK - totalCost: $${cost.toFixed(4)}, count: ${count}`);
  }
  console.log("");

  // 3. Legacy Daily Metrics
  console.log("3. Legacy Daily Metrics (/api/public/metrics/daily)...");
  const dailyRes = await fetchLangfuse<{ data?: unknown[] }>(
    `/api/public/metrics/daily?fromTimestamp=${from.toISOString()}&toTimestamp=${to.toISOString()}&limit=7`
  );
  if (dailyRes.status !== 200) {
    console.log(`   ❌ Hata: ${dailyRes.status}`, JSON.stringify(dailyRes.data, null, 2).slice(0, 400));
  } else {
    const rows = (dailyRes.data as { data?: unknown[] })?.data ?? [];
    const totalCost = rows.reduce((s: number, r: unknown) => s + Number((r as { totalCost?: number })?.totalCost ?? 0), 0);
    console.log(`   ✓ OK - ${rows.length} gün veri, toplam maliyet: $${totalCost.toFixed(4)}`);
  }

  console.log("\n=== Kontrol tamamlandı ===");
}

main().catch((err) => {
  console.error("Hata:", err.message);
  process.exit(1);
});
