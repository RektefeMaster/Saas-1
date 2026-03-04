"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Palette, Phone, Save, SlidersHorizontal } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

interface TenantData {
  id: string;
  contact_phone?: string | null;
  working_hours_text?: string | null;
  ui_preferences?: Record<string, unknown>;
  config_override?: {
    ui_preferences?: Record<string, unknown>;
    pricing_preferences?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

const COPY = {
  tr: {
    title: "Ayarlar",
    subtitle: "Panel görünümü, iletişim ve fiyat fallback kurallarını tek yerden yönetin.",
    contactTitle: "İletişim ve Çalışma Saati",
    customizationTitle: "Panel Kişiselleştirme",
    pricingTitle: "Fiyat Fallback",
    save: "Ayarları Kaydet",
    saving: "Kaydediliyor...",
    saved: "Değişiklikler kaydedildi",
    loading: "Ayarlar yükleniyor...",
    fields: {
      contactPhone: "İletişim telefonu",
      hours: "Çalışma saatleri metni",
      preset: "Tema preset",
      primary: "Birincil renk",
      accent: "Vurgu rengi",
      fallbackLabel: "Fallback etiketi",
      fallbackPhone: "Fallback telefonu",
    },
    modules: {
      overview: "Özet",
      pricing: "Fiyat Listesi",
      workflow: "İş Akışı",
      crm: "Müşteri Defteri",
      settings: "Ayarlar",
    },
  },
  en: {
    title: "Settings",
    subtitle: "Manage panel appearance, contact fields, and pricing fallback rules in one place.",
    contactTitle: "Contact and Working Hours",
    customizationTitle: "Panel Customization",
    pricingTitle: "Pricing Fallback",
    save: "Save Settings",
    saving: "Saving...",
    saved: "Changes saved",
    loading: "Loading settings...",
    fields: {
      contactPhone: "Contact phone",
      hours: "Working hours text",
      preset: "Theme preset",
      primary: "Primary color",
      accent: "Accent color",
      fallbackLabel: "Fallback label",
      fallbackPhone: "Fallback phone",
    },
    modules: {
      overview: "Overview",
      pricing: "Pricing",
      workflow: "Workflow",
      crm: "Customer Book",
      settings: "Settings",
    },
  },
} as const;

export default function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];

  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState("");
  const [themePreset, setThemePreset] = useState("classic");
  const [primaryColor, setPrimaryColor] = useState("#0f172a");
  const [accentColor, setAccentColor] = useState("#06b6d4");
  const [moduleVisibility, setModuleVisibility] = useState({
    overview: true,
    pricing: true,
    workflow: true,
    crm: true,
    settings: true,
  });
  const [fallbackLabel, setFallbackLabel] = useState("Fiyat için arayın");
  const [fallbackPhone, setFallbackPhone] = useState("");

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return;
      setLoading(true);
      const res = await fetch(`/api/tenant/${tenantId}`);
      const data = (await res.json().catch(() => null)) as TenantData | null;
      if (data) {
        setContactPhone(data.contact_phone || "");
        setWorkingHoursText(data.working_hours_text || "");
        const uiPrefs = (data.ui_preferences || data.config_override?.ui_preferences || {}) as Record<
          string,
          unknown
        >;
        const pricingPrefs = (data.config_override?.pricing_preferences || {}) as Record<string, unknown>;
        setThemePreset((uiPrefs.themePreset as string) || "classic");
        setPrimaryColor((uiPrefs.primaryColor as string) || "#0f172a");
        setAccentColor((uiPrefs.accentColor as string) || "#06b6d4");
        const incomingVisibility = uiPrefs.moduleVisibility as Record<string, boolean> | undefined;
        if (incomingVisibility) {
          setModuleVisibility((prev) => ({ ...prev, ...incomingVisibility }));
        }
        setFallbackLabel((pricingPrefs.fallbackLabel as string) || (locale === "tr" ? "Fiyat için arayın" : "Call for price"));
        setFallbackPhone((pricingPrefs.fallbackPhone as string) || data.contact_phone || "");
      }
      setLoading(false);
    };
    load();
  }, [locale, tenantId]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSaved(false);
    await fetch(`/api/tenant/${tenantId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_phone: contactPhone,
        working_hours_text: workingHoursText,
        ui_preferences: {
          themePreset,
          primaryColor,
          accentColor,
          moduleVisibility,
          moduleOrder: ["overview", "pricing", "workflow", "crm", "settings"],
        },
        pricing_preferences: {
          fallbackMode: "show_call",
          fallbackLabel,
          fallbackPhone,
        },
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  if (loading) {
    return (
      <div className="p-4 pb-24 sm:p-6 lg:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {t.loading}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-24 sm:p-6 lg:p-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {locale === "tr" ? "Panele Dön" : "Back to Panel"}
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          {t.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          {t.subtitle}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <Phone className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          {t.contactTitle}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.contactPhone}
            </span>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.hours}
            </span>
            <input
              value={workingHoursText}
              onChange={(e) => setWorkingHoursText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <Palette className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          {t.customizationTitle}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.preset}
            </span>
            <select
              value={themePreset}
              onChange={(e) => setThemePreset(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="midnight">Midnight</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.primary}
            </span>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-[42px] w-full rounded-xl border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.accent}
            </span>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-[42px] w-full rounded-xl border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {(Object.keys(moduleVisibility) as Array<keyof typeof moduleVisibility>).map((key) => (
            <label
              key={key}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              <input
                type="checkbox"
                checked={moduleVisibility[key]}
                onChange={(e) =>
                  setModuleVisibility((prev) => ({
                    ...prev,
                    [key]: e.target.checked,
                  }))
                }
              />
              {t.modules[key]}
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <SlidersHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          {t.pricingTitle}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.fallbackLabel}
            </span>
            <input
              value={fallbackLabel}
              onChange={(e) => setFallbackLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t.fields.fallbackPhone}
            </span>
            <input
              value={fallbackPhone}
              onChange={(e) => setFallbackPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
      </section>

      <div className="hidden flex-wrap items-center gap-3 sm:flex">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
        >
          <Save className="h-4 w-4" />
          {saving ? t.saving : t.save}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t.saved}
          </span>
        )}
      </div>

      {saved && (
        <div className="sm:hidden">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t.saved}
          </span>
        </div>
      )}

      <div className="fixed inset-x-3 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
        >
          <Save className="h-4 w-4" />
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
