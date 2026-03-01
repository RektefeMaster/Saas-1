"use client";

import { useEffect, useState } from "react";

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

export default function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return;
      setLoading(true);
      const res = await fetch(`${baseUrl}/api/tenant/${tenantId}`);
      const data = (await res.json().catch(() => null)) as TenantData | null;
      if (data) {
        setContactPhone(data.contact_phone || "");
        setWorkingHoursText(data.working_hours_text || "");
        const uiPrefs = (data.ui_preferences ||
          data.config_override?.ui_preferences ||
          {}) as Record<string, unknown>;
        const pricingPrefs = (data.config_override?.pricing_preferences || {}) as Record<
          string,
          unknown
        >;
        setThemePreset((uiPrefs.themePreset as string) || "classic");
        setPrimaryColor((uiPrefs.primaryColor as string) || "#0f172a");
        setAccentColor((uiPrefs.accentColor as string) || "#06b6d4");
        const incomingVisibility = uiPrefs.moduleVisibility as
          | Record<string, boolean>
          | undefined;
        if (incomingVisibility) {
          setModuleVisibility((prev) => ({ ...prev, ...incomingVisibility }));
        }
        setFallbackLabel((pricingPrefs.fallbackLabel as string) || "Fiyat için arayın");
        setFallbackPhone((pricingPrefs.fallbackPhone as string) || data.contact_phone || "");
      }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    await fetch(`${baseUrl}/api/tenant/${tenantId}/settings`, {
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
  };

  if (loading) {
    return (
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Ayarlar
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          İletişim, fiyat fallback ve panel kişiselleştirme ayarlarını düzenleyin.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">İletişim</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="İletişim telefonu"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <input
              value={workingHoursText}
              onChange={(e) => setWorkingHoursText(e.target.value)}
              placeholder="Çalışma saatleri (örn. Hafta içi 09:00-18:00)"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Panel Kişiselleştirme</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={themePreset}
              onChange={(e) => setThemePreset(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="midnight">Midnight</option>
            </select>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-[42px] rounded-xl border border-slate-200 px-1.5"
            />
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-[42px] rounded-xl border border-slate-200 px-1.5"
            />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {Object.entries(moduleVisibility).map(([key, value]) => (
              <label
                key={key}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setModuleVisibility((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                />
                {key}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Fiyat Fallback</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={fallbackLabel}
              onChange={(e) => setFallbackLabel(e.target.value)}
              placeholder="Fallback metni"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <input
              value={fallbackPhone}
              onChange={(e) => setFallbackPhone(e.target.value)}
              placeholder="Fallback telefonu"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </div>
        </section>

        <div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
