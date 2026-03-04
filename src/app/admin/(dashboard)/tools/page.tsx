"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Bug,
  Database,
  Mail,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

export default function AdminToolsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [cacheKey, setCacheKey] = useState("");
  const [cacheValue, setCacheValue] = useState("");
  const [testEmail, setTestEmail] = useState("");

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

  // Toast testleri (client-side)
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

  // PostHog test event (client-side)
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

  // Cache işlemleri
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

  const handleCacheClear = async () => {
    await run("cache-clear", async () => {
      const res = await fetch("/api/admin/tools/cache", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Cache temizlendi", data.deleted ? `${data.deleted} key silindi` : undefined);
    });
  };

  // Test e-posta
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

  // Sentry test
  const handleSentryTest = async () => {
    await run("sentry", async () => {
      const res = await fetch("/api/admin/tools/sentry-test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Sentry test hatası gönderildi", "Sentry dashboard'da kontrol edin");
    });
  };

  // Log test
  const handleLogTest = async () => {
    await run("log", async () => {
      const res = await fetch("/api/admin/tools/log", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata");
      toast.success("Test log yazıldı", "Sunucu loglarında görünür");
    });
  };

  const btn = (id: string, label: string, onClick: () => void, variant: "success" | "error" | "info" | "warning" = "info") => {
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
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Geliştirici Araçları</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Kütüphane fonksiyonlarını test et ve yönet
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Toast */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Toast (sonner)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Bildirimleri test et
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleToast("success")}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Başarı
            </button>
            <button
              type="button"
              onClick={() => handleToast("error")}
              className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 dark:bg-red-900/80 dark:text-red-200"
            >
              <XCircle className="h-3.5 w-3.5" /> Hata
            </button>
            <button
              type="button"
              onClick={() => handleToast("info")}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 dark:bg-blue-900/80 dark:text-blue-200"
            >
              <Info className="h-3.5 w-3.5" /> Bilgi
            </button>
            <button
              type="button"
              onClick={() => handleToast("warning")}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-900/80 dark:text-amber-200"
            >
              <AlertCircle className="h-3.5 w-3.5" /> Uyarı
            </button>
          </div>
        </section>

        {/* PostHog */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">PostHog</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Test event gönder
          </p>
          <div className="mt-3">
            {btn("posthog", "admin_tools_test Gönder", handlePostHog, "info")}
          </div>
        </section>

        {/* Cache */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Cache (Unstorage)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Redis cache yönetimi
          </p>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              placeholder="Key"
              value={cacheKey}
              onChange={(e) => setCacheKey(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              type="text"
              placeholder="Değer (opsiyonel)"
              value={cacheValue}
              onChange={(e) => setCacheValue(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="flex flex-wrap gap-2">
              {btn("cache-set", "Kaydet", handleCacheSet, "success")}
              {btn("cache-get", "Getir", handleCacheGet, "info")}
              {btn("cache-clear", "Temizle", handleCacheClear, "error")}
            </div>
          </div>
        </section>

        {/* E-posta */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Test E-posta (Resend)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Test e-postası gönder
          </p>
          <div className="mt-3 space-y-2">
            <input
              type="email"
              placeholder="E-posta adresi"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            {btn("email", "Gönder", handleSendEmail, "success")}
          </div>
        </section>

        {/* Sentry */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Sentry Test</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Test hatası gönder (Sentry dashboard)
          </p>
          <div className="mt-3">
            {btn("sentry", "Test Hatası Gönder", handleSentryTest, "error")}
          </div>
        </section>

        {/* Log */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Log (Pino)</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Test log yaz
          </p>
          <div className="mt-3">
            {btn("log", "Test Log Yaz", handleLogTest, "info")}
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kısayollar</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <li>• <strong>Konusmalar:</strong> <Link href="/admin/conversations" className="font-medium text-slate-900 underline dark:text-slate-100">Riskli Konusmalar</Link> — takeover/send/resume merkezi</li>
          <li>• <strong>Time Machine:</strong> <Link href="/admin/time-machine" className="font-medium text-slate-900 underline dark:text-slate-100">Mesaj + Trace + Issue</Link> — telefon bazlı debug paneli</li>
          <li>• <strong>Langfuse:</strong> <Link href="/admin/langfuse" className="font-medium text-slate-900 underline dark:text-slate-100">LLM Gözlemi</Link> — token, maliyet, trace özeti</li>
          <li>• <strong>Vercel Analytics / Speed Insights:</strong> Vercel dashboard’da otomatik</li>
          <li>• <strong>Inngest:</strong> Webhook’lar otomatik kuyruğa atılıyor; local için <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">npm run dev:inngest</code></li>
        </ul>
      </div>
    </div>
  );
}
