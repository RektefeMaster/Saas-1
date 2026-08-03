"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use} from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useDashboardTenant } from "../../DashboardTenantContext";

interface StaffItem {
  id: string;
  name: string;
  phone_e164: string | null;
  active: boolean;
  service_slugs: string[];
  created_at: string;
}

interface ServiceItem {
  id: string;
  name: string;
  slug: string;
}

interface StaffDraft {
  name: string;
  phone_e164: string;
  active: boolean;
  service_slugs: string[];
}

export default function StaffPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const tenantCtx = useDashboardTenant();
  const enabled = tenantCtx?.staffPreferenceEnabled ?? false;
  const featuresLoading = tenantCtx?.isLoading ?? true;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StaffDraft>>({});
  const [newStaff, setNewStaff] = useState({
    name: "",
    phone_e164: "",
    service_slugs: [] as string[],
  });
  const { tenantId } = use(params);

  const loadData = useCallback(async () => {
    if (!tenantId || !enabled) return;
    setLoading(true);
    setError("");

    const [staffRes, servicesRes] = await Promise.all([
      fetch(`/api/tenant/${tenantId}/staff`, { cache: "no-store" }),
      fetch(`/api/tenant/${tenantId}/services`, { cache: "no-store" }),
    ]);

    const staffPayload = await staffRes.json().catch(() => []);
    const servicesPayload = await servicesRes.json().catch(() => []);

    if (!staffRes.ok) {
      setError(staffPayload?.error || "Personel listesi alınamadı.");
      setStaff([]);
      setServices([]);
      setDrafts({});
      setLoading(false);
      return;
    }

    if (!servicesRes.ok) {
      setError(servicesPayload?.error || "Hizmet listesi alınamadı.");
      setStaff(Array.isArray(staffPayload) ? staffPayload : []);
      setServices([]);
      setLoading(false);
      return;
    }

    const staffList = Array.isArray(staffPayload) ? (staffPayload as StaffItem[]) : [];
    const serviceList = Array.isArray(servicesPayload) ? (servicesPayload as ServiceItem[]) : [];

    setStaff(staffList);
    setServices(serviceList);
    setDrafts(
      staffList.reduce<Record<string, StaffDraft>>((acc, row) => {
        acc[row.id] = {
          name: row.name,
          phone_e164: row.phone_e164 || "",
          active: row.active,
          service_slugs: Array.isArray(row.service_slugs) ? row.service_slugs : [],
        };
        return acc;
      }, {})
    );
    setLoading(false);
  }, [enabled, tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleService = (slug: string, current: string[]) => {
    if (current.includes(slug)) return current.filter((s) => s !== slug);
    return [...current, slug];
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newStaff.name.trim()) return;

    setSaving(true);
    setError("");
    setInfo("");

    const res = await fetch(`/api/tenant/${tenantId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newStaff.name.trim(),
        phone_e164: newStaff.phone_e164.trim() || null,
        active: true,
        service_slugs: newStaff.service_slugs,
      }),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaving(false);
      setError(payload?.error || "Personel eklenemedi.");
      return;
    }

    setSaving(false);
    setInfo("Personel eklendi.");
    setNewStaff({ name: "", phone_e164: "", service_slugs: [] });
    await loadData();
  };

  const updateStaff = async (staffId: string) => {
    if (!tenantId) return;
    const draft = drafts[staffId];
    if (!draft) return;

    setSaving(true);
    setError("");
    setInfo("");

    const res = await fetch(`/api/tenant/${tenantId}/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        phone_e164: draft.phone_e164.trim() || null,
        active: draft.active,
        service_slugs: draft.service_slugs,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      setError(payload?.error || "Personel güncellenemedi.");
      return;
    }

    setSaving(false);
    setInfo("Personel güncellendi.");
    await loadData();
  };

  const deleteStaff = async (staffId: string) => {
    if (!tenantId) return;

    setSaving(true);
    setError("");
    setInfo("");

    const res = await fetch(`/api/tenant/${tenantId}/staff/${staffId}`, {
      method: "DELETE",
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setSaving(false);
      setError(payload?.error || "Personel silinemedi.");
      return;
    }

    setSaving(false);
    setInfo("Personel silindi.");
    await loadData();
  };

  return (
    <div className="space-y-6 overflow-x-hidden p-4 sm:p-6 lg:p-10">
      <header className="panel-surface p-5 sm:p-6">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Panele dön
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Personel
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">
          Ekibinizi ekleyin; her kişinin sunduğu hizmetleri eşleştirin.
        </p>
        {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p>}
        {info && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{info}</p>}
      </header>

      {featuresLoading ? (
        <section className="panel-surface p-5 text-sm text-slate-500 dark:text-slate-300">
          Özellik kontrol ediliyor...
        </section>
      ) : !enabled ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          Bu işletme tipinde personel seçimi kapalı. Açılmasını istiyorsanız destek ile görüşün.
        </section>
      ) : (
        <>
          <section className="panel-surface p-4 sm:p-5">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Yeni personel</h2>
            <form onSubmit={createStaff} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="staff-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ad soyad
                </label>
                <input
                  id="staff-name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Ad soyad"
                  className="w-full min-h-11 rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="staff-phone" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Telefon
                </label>
                <input
                  id="staff-phone"
                  type="tel"
                  value={newStaff.phone_e164}
                  onChange={(e) => setNewStaff((s) => ({ ...s, phone_e164: e.target.value }))}
                  placeholder="+90555..."
                  className="w-full min-h-11 rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto sm:py-2.5"
                >
                  <Plus className="h-4 w-4" />
                  Personel Ekle
                </button>
              </div>
              {services.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Hizmetler
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {services.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() =>
                          setNewStaff((s) => ({
                            ...s,
                            service_slugs: toggleService(svc.slug, s.service_slugs),
                          }))
                        }
                        className={`min-h-10 rounded-lg border px-3 py-2 text-xs ${
                          newStaff.service_slugs.includes(svc.slug)
                            ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                            : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {svc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </section>

          <section className="panel-surface p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Personel Listesi</h2>
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Yükleniyor…</p>
            ) : staff.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Henüz personel yok.</p>
            ) : (
              <div className="space-y-3">
                {staff.map((row) => {
                  const draft = drafts[row.id] || {
                    name: row.name,
                    phone_e164: row.phone_e164 || "",
                    active: row.active,
                    service_slugs: row.service_slugs || [],
                  };
                  return (
                    <article
                      key={row.id}
                      className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Ad</label>
                          <input
                            value={draft.name}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, name: e.target.value },
                              }))
                            }
                            className="w-full min-h-11 rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Telefon</label>
                          <input
                            value={draft.phone_e164}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, phone_e164: e.target.value },
                              }))
                            }
                            placeholder="+90555..."
                            className="w-full min-h-11 rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 sm:text-sm"
                          />
                        </div>
                        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={draft.active}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, active: e.target.checked },
                              }))
                            }
                            className="h-5 w-5 rounded border-slate-300"
                          />
                          Aktif
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => updateStaff(row.id)}
                            disabled={saving}
                            className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStaff(row.id)}
                            disabled={saving}
                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="h-4 w-4" />
                            Sil
                          </button>
                        </div>
                      </div>

                      {services.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {services.map((svc) => (
                            <button
                              key={svc.id}
                              type="button"
                              onClick={() =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...draft,
                                    service_slugs: toggleService(svc.slug, draft.service_slugs),
                                  },
                                }))
                              }
                              className={`min-h-10 rounded-lg border px-3 py-2 text-xs ${
                                draft.service_slugs.includes(svc.slug)
                                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                                  : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {svc.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
