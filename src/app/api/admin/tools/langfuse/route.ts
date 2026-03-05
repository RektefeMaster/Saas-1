import { NextRequest, NextResponse } from "next/server";

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

async function langfuseFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${LANGFUSE_BASE.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Langfuse API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

type DailyUsageItem = {
  model?: string;
  inputUsage?: number;
  outputUsage?: number;
  totalUsage?: number;
  totalCost?: number;
  countTraces?: number;
  countObservations?: number;
};

type DailyMetricRow = {
  date?: string;
  countTraces?: number;
  countObservations?: number;
  totalCost?: number;
  usage?: DailyUsageItem[];
};

/** Legacy /api/public/metrics/daily fallback - v2 beta bazen boş dönebiliyor */
async function fetchLegacyDailyMetrics(
  from: Date,
  to: Date,
  limit: number
): Promise<{ total: Record<string, number>; daily: Array<Record<string, unknown>>; byModel: Array<Record<string, unknown>> }> {
  const params = new URLSearchParams();
  params.set("fromTimestamp", from.toISOString());
  params.set("toTimestamp", to.toISOString());
  params.set("limit", String(Math.min(limit, 60)));
  const data = await langfuseFetch<{ data?: DailyMetricRow[] }>(
    `/api/public/metrics/daily?${params.toString()}`
  );
  const rows = data.data ?? [];
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let observationCount = 0;
  const modelMap = new Map<string, { totalCost: number; totalTokens: number; count: number }>();

  for (const row of rows) {
    totalCost += Number(row.totalCost ?? 0);
    observationCount += Number(row.countObservations ?? row.countTraces ?? 0);
    for (const u of row.usage ?? []) {
      totalInputTokens += Number(u.inputUsage ?? 0);
      totalOutputTokens += Number(u.outputUsage ?? 0);
      const model = String(u.model ?? "unknown");
      const existing = modelMap.get(model) ?? { totalCost: 0, totalTokens: 0, count: 0 };
      existing.totalCost += Number(u.totalCost ?? 0);
      existing.totalTokens += Number(u.totalUsage ?? u.inputUsage ?? 0) + Number(u.outputUsage ?? 0);
      existing.count += Number(u.countObservations ?? u.countTraces ?? 0);
      modelMap.set(model, existing);
    }
  }

  const daily = rows.map((r) => ({
    startTime: r.date ? `${r.date}T00:00:00.000Z` : undefined,
    startTimeDay: r.date,
    totalCost: r.totalCost,
    totalCost_sum: r.totalCost,
    totalTokens: (r.usage ?? []).reduce((s, u) => s + Number(u.totalUsage ?? u.inputUsage ?? 0) + Number(u.outputUsage ?? 0), 0),
    totalTokens_sum: (r.usage ?? []).reduce((s, u) => s + Number(u.totalUsage ?? u.inputUsage ?? 0) + Number(u.outputUsage ?? 0), 0),
    count: r.countObservations ?? r.countTraces,
    count_sum: r.countObservations ?? r.countTraces,
  }));

  const byModel = Array.from(modelMap.entries()).map(([model, v]) => ({
    providedModelName: model,
    totalCost: v.totalCost,
    totalCost_sum: v.totalCost,
    totalTokens: v.totalTokens,
    totalTokens_sum: v.totalTokens,
    count: v.count,
    count_sum: v.count,
  }));

  return {
    total: {
      totalCost,
      totalCost_sum: totalCost,
      inputTokens: totalInputTokens,
      inputTokens_sum: totalInputTokens,
      outputTokens: totalOutputTokens,
      outputTokens_sum: totalOutputTokens,
      count: observationCount,
      count_sum: observationCount,
    },
    daily,
    byModel,
  };
}

/** Son 7 gün için toplam maliyet ve token kullanımı */
export async function GET(request: NextRequest) {
  try {
    if (!PUBLIC_KEY || !SECRET_KEY) {
      return NextResponse.json(
        { error: "Langfuse key'leri tanımlı değil (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY)" },
        { status: 503 }
      );
    }

    const type = request.nextUrl.searchParams.get("type") || "overview";

    if (type === "traces") {
      const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 15, 50);
      const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
      const data = await langfuseFetch<{
        data?: Array<{
          id: string;
          name?: string;
          timestamp?: string;
          userId?: string;
          sessionId?: string;
          metadata?: Record<string, unknown>;
          totalCost?: number;
          inputTotalCost?: number;
          outputTotalCost?: number;
          totalTokens?: number;
          inputTokens?: number;
          outputTokens?: number;
        }>;
        meta?: { totalItems?: number; page?: number; limit?: number };
      }>(`/api/public/traces?limit=${limit}&page=${page}&orderBy=timestamp.desc&fields=core,metrics`);
      return NextResponse.json(data);
    }

    if (type === "overview" || type === "metrics") {
      const days = Math.min(Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 7), 30);
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - days);

      let total: Record<string, unknown> = {};
      let daily: Array<Record<string, unknown>> = [];
      let byModel: Array<Record<string, unknown>> = [];
      let usedLegacy = false;

      try {
        // v2 Metrics API (beta) - config kaldırıldı, v2 farklı parametre kullanıyor olabilir
        const queryTotal = {
          view: "observations" as const,
          metrics: [
            { measure: "totalCost", aggregation: "sum" as const },
            { measure: "inputTokens", aggregation: "sum" as const },
            { measure: "outputTokens", aggregation: "sum" as const },
            { measure: "count", aggregation: "sum" as const },
          ],
          dimensions: [] as Array<Record<string, never>>,
          filters: [] as unknown[],
          fromTimestamp: from.toISOString(),
          toTimestamp: to.toISOString(),
        };

        const totalData = await langfuseFetch<{ data?: Array<Record<string, unknown>> }>(
          `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryTotal))}`
        );

        const queryDaily = {
          view: "observations" as const,
          metrics: [
            { measure: "totalCost", aggregation: "sum" as const },
            { measure: "totalTokens", aggregation: "sum" as const },
            { measure: "count", aggregation: "sum" as const },
          ],
          dimensions: [] as Array<Record<string, never>>,
          filters: [] as unknown[],
          fromTimestamp: from.toISOString(),
          toTimestamp: to.toISOString(),
          timeDimension: { granularity: "day" as const },
        };

        const dailyData = await langfuseFetch<{ data?: Array<Record<string, unknown>> }>(
          `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryDaily))}`
        );

        total = totalData.data?.[0] ?? {};
        daily = dailyData.data ?? [];

        // Model bazlı - v2 başarısız olursa atla
        try {
          const queryByModel = {
            view: "observations" as const,
            metrics: [
              { measure: "totalCost", aggregation: "sum" as const },
              { measure: "totalTokens", aggregation: "sum" as const },
              { measure: "count", aggregation: "sum" as const },
            ],
            dimensions: [{ field: "providedModelName" }],
            filters: [] as unknown[],
            fromTimestamp: from.toISOString(),
            toTimestamp: to.toISOString(),
          };
          const modelData = await langfuseFetch<{ data?: Array<Record<string, unknown>> }>(
            `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryByModel))}`
          );
          byModel = modelData.data ?? [];
        } catch {
          // Model bazlı opsiyonel
        }

        const hasData =
          (Number(total.totalCost ?? total.totalCost_sum ?? total.sum_totalCost ?? 0) > 0) ||
          (Number(total.count ?? total.count_sum ?? total.sum_count ?? 0) > 0) ||
          daily.length > 0;

        if (!hasData) {
          throw new Error("v2_empty");
        }
      } catch (v2Err) {
        const errMsg = v2Err instanceof Error ? v2Err.message : String(v2Err);
        const shouldTryLegacy =
          errMsg.includes("v2_empty") ||
          errMsg.includes("401") ||
          errMsg.includes("404") ||
          errMsg.includes("500") ||
          errMsg.includes("Langfuse API");

        if (shouldTryLegacy) {
          try {
            const legacy = await fetchLegacyDailyMetrics(from, to, 100);
            total = legacy.total;
            daily = legacy.daily;
            byModel = legacy.byModel;
            usedLegacy = true;
          } catch (legacyErr) {
            console.error("[admin tools langfuse] legacy fallback failed:", legacyErr);
            if (!errMsg.includes("v2_empty")) throw v2Err;
            // v2 boş, legacy de başarısız - boş yanıt dön (UI "veri yok" gösterecek)
          }
        } else {
          throw v2Err;
        }
      }

      return NextResponse.json({
        total,
        daily,
        byModel,
        from: from.toISOString(),
        to: to.toISOString(),
        days,
        _source: usedLegacy ? "legacy" : "v2",
      });
    }

    return NextResponse.json({ error: "Geçersiz type" }, { status: 400 });
  } catch (err) {
    console.error("[admin tools langfuse]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Langfuse hatası" },
      { status: 500 }
    );
  }
}
