"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Loader2,
  Mail,
  Pause,
  RefreshCw,
  Shield,
  Wrench,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type HealthStatus = "ok" | "warning" | "degraded" | "paused" | "unknown";

interface SentryIssue {
  id: string | null;
  shortId: string | null;
  title: string | null;
  level: string | null;
  permalink: string | null;
  count: number | null;
  lastSeen: string | null;
}

export default function AdminToolsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    status: HealthStatus;
    killSwitchEnabled: boolean;
    sentryCount: number;
    sentryConfigured: boolean;
  } | null>(null);
  const [sentryIssues, setSentryIssues] = useState<SentryIssue[]>([]);
  const [sentryLoading, setSentryLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [cacheKey, setCacheKey] = useState("");
  const [cacheValue, setCacheValue] = useState("");

  const run = async (id: string, fn: () => Promise<void>) => {
    setLoading(id);
    try {
      await fn();
    } catch (e) {
      toast.error("Hata", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/admin/tools/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHealth({
          status: data.status ?? "unknown",
          killSwitchEnabled: data.killSwitchEnabled ?? false,
          sentryCount: data.sentryCount ?? 0,
          sentryConfigured: data.sentryConfigured ?? false,
        });
      }
    } catch {
      setHealth(null);
    }
  };

  const fetchSentryIssues = async () => {
    if (!health?.sentryConfigured) return;
    setSentryLoading(true);
    try {
      const res = await fetch("/api/admin/tools/sentry-issues?limit=10");
      if (res.ok) {
        const data = await res.json();
        setSentryIssues(data.items ?? []);
      } else {
        setSentryIssues([]);
      }
    } catch {
      setSentryIssues([]);
    } finally {
      setSentryLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (health?.sentryConfigured) {
      fetchSentryIssues();
    }
  }, [health?.sentryConfigured]);

  const toggleKillSwitch = async () => {
    const next = !health?.killSwitchEnabled;
    await run("kill-switch", async () => {
      const res = await fetch("/api/admin/tools/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, source: "admin_tools" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast[next ? "warning" : "success"](
        next ? "Sistem donduruldu" : "Sistem aktif",
        next ? "Yeni konuşmalar başlatılamaz" : "Normal işleme devam eder"
      );
      fetchHealth();
    });
  };

  const handleCacheClear = async () => {
    await run("cache-clear", async () => {
      const res = await fetch("/api/admin/tools/cache", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Cache temizlendi", data.deleted ? `${data.deleted} key silindi` : undefined);
    });
  };

  const handleSendEmail = async () => {
    const email = testEmail.trim();
    if (!email) {
      toast.warning("E-posta girin", "Test e-postası gönderilecek adres");
      return;
    }
    await run("email", async () => {
      const res = await fetch("/api/admin/tools/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Test e-postası gönderildi", email);
    });
  };

  const handleCacheSet = async () => {
    if (!cacheKey.trim()) {
      toast.warning("Key girin", "Cache key zorunludur");
      return;
    }
    await run("cache-set", async () => {
      const res = await fetch("/api/admin/tools/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", key: cacheKey, value: cacheValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Cache kaydedildi", cacheKey);
    });
  };

  const handleCacheGet = async () => {
    if (!cacheKey.trim()) {
      toast.warning("Key girin", "Cache key zorunludur");
      return;
    }
    await run("cache-get", async () => {
      const res = await fetch(`/api/admin/tools/cache?key=${encodeURIComponent(cacheKey)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      if (data.value === null) {
        toast.info("Key bulunamadı", cacheKey);
      } else {
        toast.success("Değer alındı", String(data.value).slice(0, 50) + (String(data.value).length > 50 ? "..." : ""));
      }
    });
  };

  const handleSentryTest = async () => {
    await run("sentry", async () => {
      const res = await fetch("/api/admin/tools/sentry-test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Test hatası gönderildi", "Sentry dashboard'da kontrol edin");
      fetchHealth();
      fetchSentryIssues();
    });
  };

  const handleLogTest = async () => {
    await run("log", async () => {
      const res = await fetch("/api/admin/tools/log", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Test log yazıldı", "Sunucu loglarında görünür");
    });
  };

  const handleToast = (type: "success" | "error" | "info" | "warning") => {
    const messages = {
      success: ["Başarılı!", "İşlem tamamlandı."],
      error: ["Hata!", "Bir sorun oluştu."],
      info: ["Bilgi", "Bu bir bilgi mesajıdır."],
      warning: ["Uyarı", "Dikkat edilmesi gereken bir durum."],
    };
    const [msg, desc] = messages[type];
    toast[type](msg, desc);
  };

  const handlePostHog = async () => {
    if (typeof window === "undefined") return;
    try {
      const posthog = (await import("posthog-js")).default;
      posthog.capture("admin_tools_test", { source: "admin_dashboard" });
      toast.success("PostHog event gönderildi", "admin_tools_test");
    } catch (e) {
      toast.error("PostHog hatası", String(e));
    }
  };

  const healthConfig: Record<HealthStatus, { color: string; icon: typeof CheckCircle2; label: string }> = {
    ok: { color: "bg-emerald-500", icon: CheckCircle2, label: "Sistem sağlıklı" },
    warning: { color: "bg-amber-500", icon: AlertTriangle, label: `${health?.sentryCount ?? 0} çözülmemiş hata (24 saat)` },
    degraded: { color: "bg-amber-600", icon: AlertTriangle, label: `${health?.sentryCount ?? 0} hata — dikkat` },
    paused: { color: "bg-slate-500", icon: Pause, label: "Sistem donduruldu" },
    unknown: { color: "bg-slate-400", icon: Activity, label: "Durum bilinmiyor" },
  };

  const cfg = health ? healthConfig[health.status] : healthConfig.unknown;
  const HealthIcon = cfg.icon;

  const btn = (
    id: string,
    label: string,
    onClick: () => void,
    variant: "success" | "error" | "info" | "warning" = "info"
  ) => {
    const isLoad = loading === id;
    const colors = {
      success: "bg-emerald-600 hover:bg-emerald-700 text-white",
      error: "bg-red-600 hover:bg-red-700 text-white",
      warning: "bg-amber-600 hover:bg-amber-700 text-white",
      info: "bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600 dark:hover:bg-slate-500",
    };
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!!loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60",
          colors[variant]
        )}
      >
        {isLoad ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Sistem Araçları</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Sistem durumu, hızlı işlemler ve bakım araçları
        </p>
      </header>

      {/* Sistem Durumu */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-4 dark:border-slate-800 dark:from-slate-900/50 dark:to-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Sistem Durumu</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Genel sağlık ve acil durum kontrolü
          </p>
        </div>
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/50">
              <span
                className={cn(
                  "h-4 w-4 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900",
                  cfg.color
                )}
              />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{cfg.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {health?.sentryConfigured
                    ? `Sentry: ${health.sentryCount} çözülmemiş hata (24 saat)`
                    : "Sentry yapılandırılmamış"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchHealth}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="Yenile"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Kill Switch
              </span>
            </div>
            <button
              type="button"
              onClick={toggleKillSwitch}
              disabled={loading === "kill-switch"}
              className={cn(
                "relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors",
                health?.killSwitchEnabled
                  ? "bg-slate-400 dark:bg-slate-500"
                  : "bg-emerald-500 dark:bg-emerald-600"
              )}
            >
              <span
                className={cn(
                  "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform",
                  health?.killSwitchEnabled ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {health?.killSwitchEnabled ? "Donduruldu" : "Aktif"}
            </span>
          </div>
        </div>
      </section>

      {/* Son Hatalar (Sentry) */}
      {health?.sentryConfigured && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Son Hatalar</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Son 24 saatteki çözülmemiş Sentry hataları
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSentryIssues}
              disabled={sentryLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {sentryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Yenile
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-4">
            {sentryIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">Hata yok</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Son 24 saatte çözülmemiş hata bulunmuyor
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
{sentryIssues.map((issue, i) => (
  <li key={issue.id ?? issue.shortId ?? `sentry-${i}`}>
                    <a
                      href={issue.permalink ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {issue.title ?? "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-medium",
                              issue.level === "error"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : issue.level === "warning"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            )}
                          >
                            {issue.level ?? "info"}
                          </span>
                          {issue.count != null && `· ${issue.count} kez`}
                          {issue.lastSeen && `· ${new Date(issue.lastSeen).toLocaleString("tr-TR")}`}
                        </p>
                      </div>
                      <ExternalLink className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Hızlı İşlemler */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
              <Database className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Cache Temizle</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Admin araçları test cache&apos;ini temizler
              </p>
            </div>
          </div>
          <div className="p-5">
            {btn("cache-clear", "Cache Temizle", handleCacheClear, "warning")}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/30">
              <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Test E-posta</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                E-posta entegrasyonunu doğrula
              </p>
            </div>
          </div>
          <div className="space-y-2 p-5">
            <input
              type="email"
              placeholder="E-posta adresi"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {btn("email", "Test E-postası Gönder", handleSendEmail, "success")}
          </div>
        </div>
      </section>

      {/* Panel Kısayolları */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-900/50">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Panel Kısayolları</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Sık kullanılan yönetim sayfalarına hızlı erişim
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/conversations"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Riskli Konuşmalar</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Takeover, gönder, devam et</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-slate-400" />
          </Link>
          <Link
            href="/admin/time-machine"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
              <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Time Machine</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Mesaj, trace, issue debug</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-slate-400" />
          </Link>
          <Link
            href="/admin/langfuse"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">LLM Gözlemi</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Token, maliyet, trace</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </section>

      {/* Geliştirici Araçları (Collapsible) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setDevToolsOpen(!devToolsOpen)}
          className="flex w-full items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
              <Wrench className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Geliştirici Araçları</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Toast, PostHog, Sentry test, log, cache debug
              </p>
            </div>
          </div>
          {devToolsOpen ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>
        {devToolsOpen && (
          <div className="border-t border-slate-100 p-6 dark:border-slate-800">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">Toast</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Bildirim testi</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToast("success")}
                    className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200"
                  >
                    Başarı
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToast("error")}
                    className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-900/80 dark:text-red-200"
                  >
                    Hata
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToast("info")}
                    className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/80 dark:text-blue-200"
                  >
                    Bilgi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToast("warning")}
                    className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/80 dark:text-amber-200"
                  >
                    Uyarı
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">PostHog</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Test event</p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handlePostHog}
                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                  >
                    admin_tools_test Gönder
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">Sentry Test</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Test hatası gönder</p>
                <div className="mt-3">{btn("sentry", "Test Hatası", handleSentryTest, "error")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">Log (Pino)</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Test log yaz</p>
                <div className="mt-3">{btn("log", "Test Log", handleLogTest, "info")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:col-span-2">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">Cache Key Get/Set</h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  admin-tools: prefix ile key yönetimi
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="text"
                    placeholder="Key"
                    value={cacheKey}
                    onChange={(e) => setCacheKey(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="Değer (opsiyonel)"
                    value={cacheValue}
                    onChange={(e) => setCacheValue(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {btn("cache-set", "Kaydet", handleCacheSet, "success")}
                  {btn("cache-get", "Getir", handleCacheGet, "info")}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
