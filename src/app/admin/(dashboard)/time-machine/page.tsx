"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Bug, Clock3, Loader2, RefreshCw, Search } from "lucide-react";

type ConversationItem = {
  id: number;
  trace_id: string | null;
  tenant_id: string | null;
  direction: "inbound" | "outbound" | "system";
  message_text: string | null;
  message_type: string | null;
  stage: string | null;
  message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type LangfuseItem = {
  id: string | null;
  timestamp: string | null;
  name: string | null;
  userId: string | null;
  sessionId: string | null;
  totalCost: number | null;
  totalTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  htmlPath: string | null;
};

type SentryItem = {
  id: string | null;
  title: string | null;
  level: string | null;
  status: string | null;
  permalink: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  count: string | number | null;
  userCount: number | null;
};

type TimeMachineResponse = {
  query: {
    phone_digits: string;
    tenant_id: string | null;
    from: string;
    to: string;
    limit: number;
  };
  conversation: {
    total: number;
    items: ConversationItem[];
  };
  langfuse:
    | { status: "disabled" | "unconfigured" }
    | { status: "error"; error: string }
    | { status: "ok"; inferred: boolean; items: LangfuseItem[] };
  sentry:
    | { status: "disabled" | "unconfigured" }
    | { status: "error"; error: string }
    | { status: "ok"; items: SentryItem[] };
};

function toLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function resolveLangfuseUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `https://cloud.langfuse.com${path.startsWith("/") ? path : `/${path}`}`;
}

function directionBadge(direction: ConversationItem["direction"]): string {
  if (direction === "inbound") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200";
  }
  if (direction === "outbound") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200";
}

export default function AdminTimeMachinePage() {
  const now = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => new Date(now.getTime() - 24 * 60 * 60 * 1000), [now]);

  const [phone, setPhone] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [from, setFrom] = useState(toLocalInputValue(defaultFrom));
  const [to, setTo] = useState(toLocalInputValue(now));
  const [limit, setLimit] = useState(200);
  const [includeLangfuse, setIncludeLangfuse] = useState(true);
  const [includeSentry, setIncludeSentry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TimeMachineResponse | null>(null);

  const runQuery = async () => {
    const phoneDigits = normalizeDigits(phone);
    if (!phoneDigits) {
      setError("Telefon numarasi zorunludur.");
      setResult(null);
      return;
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
      setError("Gecersiz tarih araligi.");
      setResult(null);
      return;
    }

    if (fromDate.getTime() > toDate.getTime()) {
      setError("Baslangic tarihi bitis tarihinden buyuk olamaz.");
      setResult(null);
      return;
    }

    const params = new URLSearchParams({
      phone: phoneDigits,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limit: String(limit),
      include_langfuse: includeLangfuse ? "1" : "0",
      include_sentry: includeSentry ? "1" : "0",
    });
    if (tenantId.trim()) params.set("tenant_id", tenantId.trim());

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tools/time-machine?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | TimeMachineResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error || "Sorgu basarisiz" : "Sorgu basarisiz");
      }
      setResult(payload as TimeMachineResponse);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
    }
  };

  const conversationItems = result?.conversation.items || [];
  const langfuseResult = result?.langfuse;
  const sentryResult = result?.sentry;
  const langfuseItems = langfuseResult?.status === "ok" ? langfuseResult.items : [];
  const sentryItems = sentryResult?.status === "ok" ? sentryResult.items : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Time Machine</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Telefon + zaman araliginda WhatsApp mesajlari, Langfuse trace ve Sentry issue korelasyonu
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Telefon</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+90 5xx xxx xx xx"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Tenant ID (opsiyonel)</span>
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="uuid"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Baslangic</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Bitis</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Limit</span>
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(event) => setLimit(Math.min(500, Math.max(1, Number(event.target.value) || 1)))}
              className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeLangfuse}
              onChange={(event) => setIncludeLangfuse(event.target.checked)}
            />
            Langfuse dahil et
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeSentry}
              onChange={(event) => setIncludeSentry(event.target.checked)}
            />
            Sentry dahil et
          </label>

          <button
            type="button"
            onClick={runQuery}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Sorgula
          </button>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </section>

      {result ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Phone Digits</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {result.query.phone_digits}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mesaj Sayisi</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {result.conversation.total}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Langfuse Durumu</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {langfuseResult?.status || "disabled"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Sentry Durumu</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {sentryResult?.status || "disabled"}
              </p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">WhatsApp Mesajlari</h2>
              </div>
              <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
                {conversationItems.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Kayit bulunamadi.</p>
                ) : (
                  conversationItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${directionBadge(item.direction)}`}>
                          {item.direction}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-sm text-slate-900 dark:text-slate-100">
                        {item.message_text || "—"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>stage: {item.stage || "—"}</span>
                        <span>type: {item.message_type || "—"}</span>
                        <span>trace: {item.trace_id || "—"}</span>
                      </div>
                      {item.metadata && Object.keys(item.metadata).length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
                            metadata
                          </summary>
                          <pre className="mt-1 overflow-auto rounded bg-slate-100 p-2 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Langfuse Trace</h2>
              </div>
              <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
                {!langfuseResult || langfuseResult.status === "disabled" ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Langfuse sorgusu kapali.</p>
                ) : langfuseResult.status === "unconfigured" ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Langfuse env bilgileri ayarli degil.</p>
                ) : langfuseResult.status === "error" ? (
                  <p className="text-sm text-red-700 dark:text-red-300">{langfuseResult.error}</p>
                ) : langfuseItems.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Eslesen trace bulunamadi.</p>
                ) : (
                  langfuseItems.map((item, index) => {
                    const traceUrl = resolveLangfuseUrl(item.htmlPath);
                    return (
                      <div key={`${item.id || "trace"}-${index}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.name || item.id || "Trace"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(item.timestamp)}
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <p>userId: {item.userId || "—"}</p>
                          <p>sessionId: {item.sessionId || "—"}</p>
                          <p>tokens: {item.totalTokens ?? "—"}</p>
                          <p>cost: {item.totalCost ?? "—"}</p>
                        </div>
                        {traceUrl ? (
                          <a
                            href={traceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                          >
                            Trace ac
                          </a>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2">
                <Bug className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sentry Issues</h2>
              </div>
              <div className="max-h-[560px] space-y-3 overflow-auto pr-1">
                {!sentryResult || sentryResult.status === "disabled" ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Sentry sorgusu kapali.</p>
                ) : sentryResult.status === "unconfigured" ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">Sentry env bilgileri ayarli degil.</p>
                ) : sentryResult.status === "error" ? (
                  <p className="text-sm text-red-700 dark:text-red-300">{sentryResult.error}</p>
                ) : sentryItems.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Issue bulunamadi.</p>
                ) : (
                  sentryItems.map((item, index) => (
                    <div key={`${item.id || "issue"}-${index}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.title || "Issue"}
                      </p>
                      <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <p>level: {item.level || "—"}</p>
                        <p>status: {item.status || "—"}</p>
                        <p>count: {item.count ?? "—"} | users: {item.userCount ?? "—"}</p>
                        <p>last seen: {formatDate(item.lastSeen)}</p>
                      </div>
                      {item.permalink ? (
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                        >
                          Issue ac
                        </a>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
