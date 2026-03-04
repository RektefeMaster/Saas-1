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

      // Toplam özet (tek satır)
      const queryTotal = {
        view: "observations" as const,
        metrics: [
          { measure: "totalCost", aggregation: "sum" as const },
          { measure: "inputTokens", aggregation: "sum" as const },
          { measure: "outputTokens", aggregation: "sum" as const },
          { measure: "count", aggregation: "sum" as const },
        ],
        dimensions: [],
        filters: [],
        fromTimestamp: from.toISOString(),
        toTimestamp: to.toISOString(),
        config: { row_limit: 1 },
      };

      const totalData = await langfuseFetch<{ data?: Array<Record<string, unknown>> }>(
        `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryTotal))}`
      );

      // Günlük dağılım (grafik için)
      const queryDaily = {
        view: "observations" as const,
        metrics: [
          { measure: "totalCost", aggregation: "sum" as const },
          { measure: "totalTokens", aggregation: "sum" as const },
          { measure: "count", aggregation: "sum" as const },
        ],
        dimensions: [],
        filters: [],
        fromTimestamp: from.toISOString(),
        toTimestamp: to.toISOString(),
        timeDimension: { granularity: "day" as const },
        config: { row_limit: 100 },
      };

      const dailyData = await langfuseFetch<{ data?: Array<Record<string, unknown>> }>(
        `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryDaily))}`
      );

      // Model bazlı özet için ikinci sorgu
      const queryByModel = {
        view: "observations" as const,
        metrics: [
          { measure: "totalCost", aggregation: "sum" as const },
          { measure: "totalTokens", aggregation: "sum" as const },
          { measure: "count", aggregation: "sum" as const },
        ],
        dimensions: [{ field: "providedModelName" }],
        filters: [],
        fromTimestamp: from.toISOString(),
        toTimestamp: to.toISOString(),
        config: { row_limit: 20 },
      };

      let byModel: Array<Record<string, unknown>> = [];
      try {
        const modelData = await langfuseFetch<{ data?: Array<Record<string, unknown>> }>(
          `/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(queryByModel))}`
        );
        byModel = modelData.data || [];
      } catch {
        // Model bazlı sorgu opsiyonel
      }

      return NextResponse.json({
        total: totalData.data?.[0] ?? {},
        daily: dailyData.data ?? [],
        byModel,
        from: from.toISOString(),
        to: to.toISOString(),
        days,
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
