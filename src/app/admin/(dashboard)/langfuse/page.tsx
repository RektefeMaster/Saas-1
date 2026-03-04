"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChartBar } from "@/components/charts/ChartBar";
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
  const totalCost = Number(total.totalCost ?? total.totalCost_sum ?? 0);
  const inputTokens = Number(total.inputTokens ?? total.inputTokens_sum ?? 0);
  const outputTokens = Number(total.outputTokens ?? total.outputTokens_sum ?? 0);
  const totalTokens = inputTokens + outputTokens;
  const observationCount = Number(total.count ?? total.count_sum ?? 0);

  const chartData =
    (metrics?.daily ?? []).map((row) => {
      const timeKey = row.startTime ?? row.startTimeDay ?? row.timestamp;
      return {
        tarih: timeKey
          ? new Date(String(timeKey)).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
          : "—",
        maliyet: Number(row.totalCost ?? row.totalCost_sum ?? 0),
        token: Number(row.totalTokens ?? row.totalTokens_sum ?? 0),
        çağrı: Number(row.count ?? row.count_sum ?? 0),
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

      {/* Özet kartları */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Toplam Maliyet</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCost(totalCost)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Son {days} gün</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Toplam Token</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatNumber(totalTokens)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Giriş: {formatNumber(inputTokens)} · Çıkış: {formatNumber(outputTokens)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">LLM Çağrısı</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatNumber(observationCount)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Observation sayısı</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ort. Maliyet</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {observationCount > 0 ? formatCost(totalCost / observationCount) : "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Çağrı başına</p>
        </div>
      </div>

      {/* Günlük grafik */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Günlük Kullanım
          </h3>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            Maliyet, token ve çağrı sayıları
          </p>
          <div className="mt-2">
            <ChartBar
              data={chartData}
              xKey="tarih"
              bars={["maliyet", "token", "çağrı"]}
              colors={["amber", "violet", "emerald"]}
              barLabels={{ maliyet: "Maliyet ($)", token: "Token", çağrı: "Çağrı" }}
              valueFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v < 1 ? v.toFixed(4) : String(Math.round(v))
              }
              showLegend
              normalize
              height={320}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Model bazlı dağılım */}
        {metrics?.byModel && metrics.byModel.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Model Bazlı Kullanım</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-2 text-left font-medium text-slate-500 dark:text-slate-400">Model</th>
                    <th className="pb-2 text-right font-medium text-slate-500 dark:text-slate-400">Maliyet</th>
                    <th className="pb-2 text-right font-medium text-slate-500 dark:text-slate-400">Token</th>
                    <th className="pb-2 text-right font-medium text-slate-500 dark:text-slate-400">Çağrı</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.byModel.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-medium text-slate-900 dark:text-slate-100">
                        {String(row.providedModelName ?? "—")}
                      </td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                        {formatCost(Number(row.totalCost ?? row.totalCost_sum ?? 0))}
                      </td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                        {formatNumber(Number(row.totalTokens ?? row.totalTokens_sum ?? 0))}
                      </td>
                      <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                        {formatNumber(Number(row.count ?? row.count_sum ?? 0))}
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Son Trace&apos;ler</h3>
            <div className="mt-4 space-y-2">
              {traces.data.map((trace) => (
                <a
                  key={trace.id}
                  href={trace.htmlPath ? `${baseUrl}${trace.htmlPath}` : baseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {trace.name || trace.id}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(trace.timestamp)}
                      {trace.totalTokens != null && ` · ${formatNumber(trace.totalTokens)} token`}
                    </p>
                  </div>
                  <div className="ml-2 flex items-center gap-2">
                    {trace.totalCost != null && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {formatCost(trace.totalCost)}
                      </span>
                    )}
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </a>
              ))}
            </div>
            <Link
              href={baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Tüm trace&apos;leri görüntüle
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
