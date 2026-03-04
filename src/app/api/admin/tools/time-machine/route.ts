import { NextRequest, NextResponse } from "next/server";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { supabase } from "@/lib/supabase";

type ConversationMessageRow = {
  id: number;
  trace_id: string | null;
  tenant_id: string | null;
  customer_phone_digits: string;
  direction: "inbound" | "outbound" | "system";
  message_text: string | null;
  message_type: string | null;
  stage: string | null;
  message_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function normalizePhoneDigits(input: string | null): string {
  return (input || "").replace(/\D/g, "");
}

function parseDateInput(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return fallback;
  return d;
}

function getLangfuseAuthHeader(): string | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) return null;
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}

async function fetchLangfuseTraceWindow(input: {
  fromIso: string;
  toIso: string;
  phoneDigits: string;
  limit: number;
}): Promise<
  | { status: "disabled" | "unconfigured" }
  | { status: "ok"; inferred: boolean; items: Array<Record<string, unknown>> }
  | { status: "error"; error: string }
> {
  if (process.env.ENABLE_TIME_MACHINE_LANGFUSE === "false") {
    return { status: "disabled" };
  }

  const authHeader = getLangfuseAuthHeader();
  if (!authHeader) {
    return { status: "unconfigured" };
  }

  const baseUrl = (process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com").replace(
    /\/$/,
    ""
  );

  try {
    const url = `${baseUrl}/api/public/traces?limit=${Math.min(
      Math.max(input.limit, 20),
      120
    )}&page=1&orderBy=timestamp.desc&fields=core,metrics`;

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { status: "error", error: `Langfuse API ${response.status}: ${text.slice(0, 180)}` };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      data?: Array<{
        id?: string;
        timestamp?: string;
        name?: string;
        userId?: string;
        sessionId?: string;
        totalCost?: number;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
        htmlPath?: string;
      }>;
    };

    const fromMs = new Date(input.fromIso).getTime();
    const toMs = new Date(input.toIso).getTime();

    const items = (payload.data || [])
      .filter((row) => {
        const timestamp = row.timestamp ? new Date(row.timestamp).getTime() : NaN;
        if (!Number.isFinite(timestamp)) return false;
        if (timestamp < fromMs || timestamp > toMs) return false;

        const userId = (row.userId || "").replace(/\D/g, "");
        const sessionId = (row.sessionId || "").replace(/\D/g, "");
        if (!input.phoneDigits) return true;
        if (userId && userId.includes(input.phoneDigits)) return true;
        if (sessionId && sessionId.includes(input.phoneDigits)) return true;
        return false;
      })
      .map((row) => ({
        id: row.id || null,
        timestamp: row.timestamp || null,
        name: row.name || null,
        userId: row.userId || null,
        sessionId: row.sessionId || null,
        totalCost: row.totalCost ?? null,
        totalTokens: row.totalTokens ?? null,
        inputTokens: row.inputTokens ?? null,
        outputTokens: row.outputTokens ?? null,
        htmlPath: row.htmlPath || null,
      }));

    return {
      status: "ok",
      inferred: true,
      items,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Langfuse fetch failed",
    };
  }
}

async function fetchSentryIssuesWindow(input: {
  fromIso: string;
  toIso: string;
  limit: number;
}): Promise<
  | { status: "disabled" | "unconfigured" }
  | { status: "ok"; items: Array<Record<string, unknown>> }
  | { status: "error"; error: string }
> {
  if (process.env.ENABLE_TIME_MACHINE_SENTRY === "false") {
    return { status: "disabled" };
  }

  const sentryToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const sentryOrg = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();
  if (!sentryToken || !sentryOrg || !sentryProject) {
    return { status: "unconfigured" };
  }

  try {
    const query = new URLSearchParams({
      start: input.fromIso,
      end: input.toIso,
      limit: String(Math.min(Math.max(input.limit, 20), 100)),
      query: "is:unresolved",
    });

    const response = await fetch(
      `https://sentry.io/api/0/projects/${encodeURIComponent(sentryOrg)}/${encodeURIComponent(
        sentryProject
      )}/issues/?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${sentryToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { status: "error", error: `Sentry API ${response.status}: ${text.slice(0, 180)}` };
    }

    const payload = (await response.json().catch(() => [])) as Array<{
      id?: string;
      title?: string;
      level?: string;
      status?: string;
      permalink?: string;
      firstSeen?: string;
      lastSeen?: string;
      count?: string | number;
      userCount?: number;
    }>;

    return {
      status: "ok",
      items: payload.map((row) => ({
        id: row.id || null,
        title: row.title || null,
        level: row.level || null,
        status: row.status || null,
        permalink: row.permalink || null,
        firstSeen: row.firstSeen || null,
        lastSeen: row.lastSeen || null,
        count: row.count ?? null,
        userCount: row.userCount ?? null,
      })),
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Sentry fetch failed",
    };
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const phoneDigits = normalizePhoneDigits(params.get("phone"));
  if (!phoneDigits) {
    return NextResponse.json(
      { error: "phone parametresi zorunlu" },
      { status: 400 }
    );
  }

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const from = parseDateInput(params.get("from"), defaultFrom);
  const to = parseDateInput(params.get("to"), now);

  if (from.getTime() > to.getTime()) {
    return NextResponse.json(
      { error: "from tarihi to tarihinden buyuk olamaz" },
      { status: 400 }
    );
  }

  const limitRaw = Number(params.get("limit") || 200);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 200, 1), 500);
  const tenantId = (params.get("tenant_id") || "").trim();

  let query = supabase
    .from("conversation_messages")
    .select(
      "id, trace_id, tenant_id, customer_phone_digits, direction, message_text, message_type, stage, message_id, metadata, created_at"
    )
    .eq("customer_phone_digits", phoneDigits)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) {
    const missingTable = extractMissingSchemaTable(error);
    if (missingTable === "conversation_messages") {
      return NextResponse.json(
        {
          error:
            "conversation_messages tablosu bulunamadi. Supabase migration 029 calistirilmali.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const includeLangfuse = params.get("include_langfuse") !== "0";
  const includeSentry = params.get("include_sentry") !== "0";

  const [langfuse, sentry] = await Promise.all([
    includeLangfuse
      ? fetchLangfuseTraceWindow({
          fromIso: from.toISOString(),
          toIso: to.toISOString(),
          phoneDigits,
          limit: 80,
        })
      : Promise.resolve({ status: "disabled" as const }),
    includeSentry
      ? fetchSentryIssuesWindow({
          fromIso: from.toISOString(),
          toIso: to.toISOString(),
          limit: 40,
        })
      : Promise.resolve({ status: "disabled" as const }),
  ]);

  const messages = ((data || []) as ConversationMessageRow[]).map((row) => ({
    id: row.id,
    trace_id: row.trace_id,
    tenant_id: row.tenant_id,
    direction: row.direction,
    message_text: row.message_text,
    message_type: row.message_type,
    stage: row.stage,
    message_id: row.message_id,
    metadata: row.metadata || {},
    created_at: row.created_at,
  }));

  return NextResponse.json({
    query: {
      phone_digits: phoneDigits,
      tenant_id: tenantId || null,
      from: from.toISOString(),
      to: to.toISOString(),
      limit,
    },
    conversation: {
      total: messages.length,
      items: messages,
    },
    langfuse,
    sentry,
  });
}
