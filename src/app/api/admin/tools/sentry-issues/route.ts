import { NextRequest, NextResponse } from "next/server";

function parseDateInput(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();

  if (!token || !org || !project) {
    return NextResponse.json(
      { error: "Sentry env eksik. SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT gerekli." },
      { status: 500 }
    );
  }

  const params = request.nextUrl.searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const from = parseDateInput(params.get("from"), defaultFrom);
  const to = parseDateInput(params.get("to"), now);
  const limitRaw = Number(params.get("limit") || 50);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50, 1), 100);
  const query = (params.get("query") || "is:unresolved").trim() || "is:unresolved";

  if (from.getTime() > to.getTime()) {
    return NextResponse.json(
      { error: "from tarihi to tarihinden buyuk olamaz" },
      { status: 400 }
    );
  }

  const urlQuery = new URLSearchParams({
    start: from.toISOString(),
    end: to.toISOString(),
    limit: String(limit),
    query,
  });

  const response = await fetch(
    `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(
      project
    )}/issues/?${urlQuery.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Sentry API ${response.status}: ${raw.slice(0, 240)}`,
      },
      { status: response.status >= 500 ? 502 : 400 }
    );
  }

  const payload = (await response.json().catch(() => [])) as Array<{
    id?: string;
    shortId?: string;
    title?: string;
    level?: string;
    status?: string;
    permalink?: string;
    firstSeen?: string;
    lastSeen?: string;
    count?: string | number;
    userCount?: number;
  }>;

  const items = payload.map((row) => ({
    id: row.id || null,
    shortId: row.shortId || null,
    title: row.title || null,
    level: row.level || null,
    status: row.status || null,
    permalink: row.permalink || null,
    firstSeen: row.firstSeen || null,
    lastSeen: row.lastSeen || null,
    count: row.count ?? null,
    userCount: row.userCount ?? null,
  }));

  return NextResponse.json({
    query: {
      org,
      project,
      from: from.toISOString(),
      to: to.toISOString(),
      limit,
      search: query,
    },
    total: items.length,
    items,
  });
}
