"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";

const ChartBar = dynamic(
  () => import("@/components/charts/ChartBar").then((m) => ({ default: m.ChartBar })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const ChartCard = dynamic(
  () => import("@/components/charts/ChartCard").then((m) => ({ default: m.ChartCard })),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /> }
);
import {
  Brain,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface LangfuseMetrics {
  total?: Record<string, number>;
  daily?: Array<Record<string, unknown>>;
  byModel?: Array<Record<string, unknown>>;
  from?: string;
  to?: string;
  days?: number;
}

interface TraceItem {
  id: string;
  name?: string;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
  totalCost?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  htmlPath?: string;
}

function formatCost(usd: number | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatNumber(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminLangfusePage() {
  const [metrics, setMetrics] = useState<LangfuseMetrics | null>(null);
  const [traces, setTraces] = useState<{ data?: TraceItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, tracesRes] = await Promise.all([
        fetch(`/api/admin/tools/langfuse?type=metrics&days=${days}`),
        fetch("/api/admin/tools/langfuse?type=traces&limit=10"),
      ]);

      if (!metricsRes.ok) {
        const err = await metricsRes.json().catch(() => ({}));
        throw new Error(err.error || "Metrikler alınamadı");
      }

      const metricsData = await metricsRes.json();
      setMetrics(metricsData);

      if (tracesRes.ok) {
        const tracesData = await tracesRes.json();
        setTraces(tracesData);
      } else {
        setTraces(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setMetrics(null);
      setTraces(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const baseUrl = "https://cloud.langfuse.com";

  if (loading && !metrics) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">LLM Gözlemi (Langfuse)</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              OpenAI token kullanımı ve maliyet takibi
            </p>
          </div>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">{error}</p>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            LANGFUSE_PUBLIC_KEY ve LANGFUSE_SECRET_KEY değişkenlerini .env dosyasında kontrol edin.
          </p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <RefreshCw className="h-4 w-4" />
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  const total = metrics?.total ?? {};
  const totalCost = Number(total.totalCost ?? total.totalCost_sum ?? total.sum_totalCost ?? 0);
  const inputTokens = Number(total.inputTokens ?? total.inputTokens_sum ?? total.sum_inputTokens ?? 0);
  const outputTokens = Number(total.outputTokens ?? total.outputTokens_sum ?? total.sum_outputTokens ?? 0);
  const totalTokens = inputTokens + outputTokens;
  const observationCount = Number(total.count ?? total.count_sum ?? total.sum_count ?? 0);

  const hasAnyData = totalCost > 0 || totalTokens > 0 || observationCount > 0;

  const chartData =
    (metrics?.daily ?? []).map((row) => {
      const timeKey = row.startTime ?? row.startTimeDay ?? row.timestamp;
      return {
        tarih: timeKey
          ? new Date(String(timeKey)).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
          : "—",
        maliyet: Number(row.totalCost ?? row.totalCost_sum ?? row.sum_totalCost ?? 0),
        token: Number(row.totalTokens ?? row.totalTokens_sum ?? row.sum_totalTokens ?? 0),
        çağrı: Number(row.count ?? row.count_sum ?? row.sum_count ?? 0),
      };
    }) || [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">LLM Gözlemi (Langfuse)</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            OpenAI token kullanımı, maliyet ve trace takibi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value={7}>Son 7 gün</option>
            <option value={14}>Son 14 gün</option>
            <option value={30}>Son 30 gün</option>
          </select>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Yenile
          </button>
          <a
            href={baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Langfuse&apos;a Git
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      {!hasAnyData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-800 dark:bg-amber-950/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200">
            Henüz veri görünmüyor
          </h3>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            Langfuse&apos;a LLM çağrıları gönderilmiş olmalı. Kontrol edin:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-amber-700 dark:text-amber-300">
            <li>
              <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">LANGFUSE_PUBLIC_KEY</code> ve{" "}
              <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">LANGFUSE_SECRET_KEY</code> .env dosyasında tanımlı mı?
            </li>
            <li>
              Bot (WhatsApp) üzerinden en az bir mesaj gönderildi mi? LLM yanıtı tetiklenmeli.
            </li>
            <li>
              Langfuse Cloud&apos;da doğru projeyi seçtiniz mi? Key&apos;ler proje ayarlarından alınmalı.
            </li>
            <li>
              EU vs US: <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">LANGFUSE_BASE_URL</code> projenizin bölgesine uygun mu? (cloud.langfuse.com = EU, us.cloud.langfuse.com = US)
            </li>
          </ul>
          <a
            href={baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Langfuse Dashboard&apos;a Git
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-900/30">
              <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Toplam Maliyet</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatCost(totalCost)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Son {days} gün</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-xl bg-violet-100 p-2.5 dark:bg-violet-900/30">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Toplam Token</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(totalTokens)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Giriş: {formatNumber(inputTokens)} · Çıkış: {formatNumber(outputTokens)}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/30">
              <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">LLM Çağrısı</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatNumber(observationCount)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Observation sayısı</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-xl bg-blue-100 p-2.5 dark:bg-blue-900/30">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Ort. Maliyet</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {observationCount > 0 ? formatCost(totalCost / observationCount) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Çağrı başına</p>
          </div>
        </div>
      </div>

      {/* Günlük grafik */}
      {chartData.length > 0 && (
        <ChartCard
          title="Günlük Kullanım"
          subtitle="Maliyet, token ve LLM çağrı trendleri"
          footnote="Değerler karşılaştırma için 0–100 aralığına normalize edilmiştir. Tooltip'te gerçek değerler gösterilir."
        >
          <ChartBar
            data={chartData}
            xKey="tarih"
            bars={["maliyet", "token", "çağrı"]}
            colors={["amber", "violet", "emerald"]}
            barLabels={{ maliyet: "Maliyet ($)", token: "Token", çağrı: "LLM Çağrı" }}
            valueFormatter={(v) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v < 1 ? v.toFixed(4) : String(Math.round(v))
            }
            showLegend
            normalize
            height={340}
          />
        </ChartCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model bazlı dağılım */}
        {metrics?.byModel && metrics.byModel.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4 dark:border-slate-800 dark:from-slate-900/50 dark:to-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Model Bazlı Kullanım</h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">LLM modellerine göre dağılım</p>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-3 text-left font-medium text-slate-500 dark:text-slate-400">Model</th>
                    <th className="pb-3 text-right font-medium text-slate-500 dark:text-slate-400">Maliyet</th>
                    <th className="pb-3 text-right font-medium text-slate-500 dark:text-slate-400">Token</th>
                    <th className="pb-3 text-right font-medium text-slate-500 dark:text-slate-400">Çağrı</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byModel.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="py-3 font-medium text-slate-900 dark:text-slate-100">
                        {String(row.providedModelName ?? "—")}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatCost(Number(row.totalCost ?? row.totalCost_sum ?? row.sum_totalCost ?? 0))}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatNumber(Number(row.totalTokens ?? row.totalTokens_sum ?? row.sum_totalTokens ?? 0))}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatNumber(Number(row.count ?? row.count_sum ?? row.sum_count ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Son trace'ler */}
        {traces?.data && traces.data.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4 dark:border-slate-800 dark:from-slate-900/50 dark:to-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Son Trace&apos;ler</h3>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">En son LLM çağrıları</p>
            </div>
            <div className="space-y-1 p-4">
              {traces.data.map((trace) => (
                <a
                  key={trace.id}
                  href={trace.htmlPath ? `${baseUrl}${trace.htmlPath}` : baseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {trace.name || trace.id}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(trace.timestamp)}
                      {trace.totalTokens != null && ` · ${formatNumber(trace.totalTokens)} token`}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    {trace.totalCost != null && (
                      <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {formatCost(trace.totalCost)}
                      </span>
                    )}
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </div>
                </a>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <Link
                href={baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Tüm trace&apos;leri görüntüle
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
