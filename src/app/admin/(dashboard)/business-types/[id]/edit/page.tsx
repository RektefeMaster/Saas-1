"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const FLOW_TYPES = [
  { value: "appointment", label: "Randevu" },
  { value: "appointment_with_extras", label: "Randevu + Ek Bilgiler" },
  { value: "order", label: "Sipariş" },
  { value: "reservation", label: "Rezervasyon" },
  { value: "hybrid", label: "Hibrit" },
] as const;

interface BusinessType {
  id: string;
  name: string;
  slug: string;
  flow_type: string;
  config: Record<string, unknown>;
  bot_config?: Record<string, unknown> | null;
}

export default function EditBusinessTypePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [flowType, setFlowType] = useState("appointment");
  const [botConfigJson, setBotConfigJson] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/business-types/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Yüklenemedi");
        }
        const data: BusinessType = await res.json();
        setName(data.name);
        setSlug(data.slug);
        setFlowType(data.flow_type ?? "appointment");
        setBotConfigJson(
          data.bot_config && typeof data.bot_config === "object"
            ? JSON.stringify(data.bot_config, null, 2)
            : ""
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bir hata oluştu");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let bot_config: Record<string, unknown> | null | undefined = undefined;
    if (botConfigJson.trim()) {
      try {
        bot_config = JSON.parse(botConfigJson) as Record<string, unknown>;
      } catch {
        setError("Bot config geçerli bir JSON olmalı.");
        setSaving(false);
        return;
      }
    } else {
      bot_config = null;
    }
    try {
      const res = await fetch(`/api/admin/business-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          flow_type: flowType,
          bot_config,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      router.push("/admin/business-types");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link
        href="/admin/business-types"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        İşletme tipleri listesine dön
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        İşletme Tipini Düzenle
      </h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-400">{name || "Yükleniyor..."}</p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Ad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Akış Tipi</label>
            <select
              value={flowType}
              onChange={(e) => setFlowType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {FLOW_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Bot config (JSON)
            </label>
            <textarea
              value={botConfigJson}
              onChange={(e) => setBotConfigJson(e.target.value)}
              placeholder='{"bot_persona": "...", "opening_message": "...", "messages": {...}, "tone": {...}, ...}'
              rows={14}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Config-driven bot tanımı. Boş bırakırsanız bot_config silinmez; silmek için tek satır {"{}"} yazıp kaydedin.
            </p>
          </div>
        </div>
        <div className="mt-8 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <Link
            href="/admin/business-types"
            className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            İptal
          </Link>
        </div>
      </form>
    </div>
  );
}
