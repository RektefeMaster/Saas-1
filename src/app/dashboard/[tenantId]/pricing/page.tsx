"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { humanizeMinutes } from "@/lib/humanize-duration";

interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  duration_minutes: number;
  is_active: boolean;
  price_visible: boolean;
  display_order: number;
}

interface TenantBasic {
  contact_phone?: string | null;
}

type ServiceUpdatePayload = Partial<
  Pick<
    ServiceItem,
    "name" | "slug" | "description" | "price" | "duration_minutes" | "is_active" | "price_visible" | "display_order"
  >
>;

export default function PricingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tenant, setTenant] = useState<TenantBasic | null>(null);
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    duration_minutes: 30,
    price: "",
    price_visible: true,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const refresh = useCallback(async (includeTenant = false) => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [servicesRes, tenantRes] = await Promise.all([
        fetch(`/api/tenant/${tenantId}/services`, { cache: "no-store" }),
        includeTenant
          ? fetch(`/api/tenant/${tenantId}`, { cache: "no-store" })
          : Promise.resolve(null),
      ]);

      const servicesData = (await servicesRes.json().catch(() => [])) as ServiceItem[];
      setServices(Array.isArray(servicesData) ? servicesData : []);

      if (tenantRes) {
        const tenantData = (await tenantRes.json().catch(() => null)) as TenantBasic | null;
        setTenant(tenantData);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.name.localeCompare(b.name, "tr");
      }),
    [services]
  );

  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newService.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newService.name.trim(),
          description: newService.description.trim() || null,
          duration_minutes: newService.duration_minutes,
          price:
            newService.price.trim() && !Number.isNaN(Number(newService.price))
              ? Number(newService.price)
              : null,
          price_visible: newService.price_visible,
          is_active: true,
          display_order: services.length,
        }),
      });
      if (!res.ok) return;
      const created = (await res.json().catch(() => null)) as ServiceItem | null;
      if (created?.id) {
        setServices((prev) => [...prev, created]);
      } else {
        await refresh();
      }
      setNewService({
        name: "",
        description: "",
        duration_minutes: 30,
        price: "",
        price_visible: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const updateService = async (serviceId: string, payload: ServiceUpdatePayload) => {
    if (!tenantId) return;
    const prevServices = services;
    setServices((prev) =>
      prev.map((item) => (item.id === serviceId ? { ...item, ...payload } : item))
    );

    const res = await fetch(`/api/tenant/${tenantId}/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setServices(prevServices);
      await refresh();
      return;
    }

    const updated = (await res.json().catch(() => null)) as ServiceItem | null;
    if (updated?.id) {
      setServices((prev) =>
        prev.map((item) => (item.id === serviceId ? { ...item, ...updated } : item))
      );
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!tenantId) return;
    const prevServices = services;
    setServices((prev) => prev.filter((item) => item.id !== serviceId));
    setDeleteConfirm(null);

    const res = await fetch(`/api/tenant/${tenantId}/services/${serviceId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setServices(prevServices);
    }
  };

  const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

  return (
    <div className="p-4 pb-28 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-6">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Panele dön
        </Link>
        <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Fiyat Listesi</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Hizmetlerinizi tanımlayın. Müşteriler randevu alırken bu listeyi görür.
            </p>
          </div>
          {!loading && sortedServices.length > 0 && (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {sortedServices.length} hizmet
            </p>
          )}
        </div>
      </header>

      {/* Yeni hizmet formu */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Plus className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Yeni hizmet ekle</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Aşağıdaki bilgileri doldurup ekleyin</p>
          </div>
        </div>

        <form onSubmit={createService} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="service-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Hizmet adı <span className="text-red-500">*</span>
              </label>
              <input
                id="service-name"
                value={newService.name}
                onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                placeholder="Örn: Saç kesimi, Manikür"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label htmlFor="service-duration" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Süre (dakika)
              </label>
              <select
                id="service-duration"
                value={newService.duration_minutes}
                onChange={(e) =>
                  setNewService((s) => ({ ...s, duration_minutes: Number(e.target.value) || 30 }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {humanizeMinutes(d)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Randevu için ayrılan süre</p>
            </div>

            <div>
              <label htmlFor="service-price" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Fiyat (₺)
              </label>
              <input
                id="service-price"
                type="number"
                step={0.01}
                min={0}
                value={newService.price}
                onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))}
                placeholder="Boş bırakılabilir"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Fiyat zorunlu değil; boş bırakırsanız müşteriye &quot;Fiyat için arayın&quot; gösterilir
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="service-desc" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Açıklama
            </label>
            <input
              id="service-desc"
              value={newService.description}
              onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
              placeholder="İsteğe bağlı kısa açıklama"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={newService.price_visible}
                onChange={(e) => setNewService((s) => ({ ...s, price_visible: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Fiyatı müşteriye göster</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || !newService.name.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ekleniyor…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Hizmet ekle
              </>
            )}
          </button>
        </form>
      </section>

      {/* Hizmet listesi */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Hizmetler</h2>
          </div>
        </div>

        {loading ? (
          <div className="space-y-0 divide-y divide-slate-200 dark:divide-slate-700">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-5 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : sortedServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <ListChecks className="h-7 w-7 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
              Henüz hizmet eklenmemiş
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Yukarıdaki formu doldurarak ilk hizmetinizi ekleyebilirsiniz. Müşteriler randevu alırken bu listeyi görecek.
            </p>
          </div>
        ) : (
          <>
            {/* Masaüstü tablo */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Hizmet
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Süre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Fiyat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Fiyat görünürlüğü
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Durum
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sortedServices.map((service) => (
                    <tr key={service.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{service.name}</div>
                        {service.description && (
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {service.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={service.duration_minutes}
                          onChange={(e) =>
                            updateService(service.id, { duration_minutes: Number(e.target.value) || 30 })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {humanizeMinutes(d)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step={0.01}
                          min={0}
                          value={service.price ?? ""}
                          onChange={(e) =>
                            updateService(service.id, {
                              price: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="—"
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <span className="ml-1 text-xs text-slate-500">₺</span>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={service.price_visible}
                            onChange={(e) => updateService(service.id, { price_visible: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {service.price_visible ? "Göster" : "Gizle"}
                          </span>
                        </label>
                        {!service.price_visible && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Müşteriye &quot;Fiyat için arayın&quot; yazısı gösterilir
                            {tenant?.contact_phone && ` (${tenant.contact_phone})`}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={service.is_active}
                            onChange={(e) => updateService(service.id, { is_active: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {service.is_active ? "Aktif" : "Pasif"}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {deleteConfirm === service.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-slate-500">Bu hizmeti silmek istediğinize emin misiniz?</span>
                            <button
                              type="button"
                              onClick={() => deleteService(service.id)}
                              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                            >
                              Evet, sil
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(service.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Sil
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil kartlar */}
            <div className="space-y-3 p-4 lg:hidden">
              {sortedServices.map((service) => (
                <article
                  key={service.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100">{service.name}</h3>
                      {service.description && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {service.description}
                        </p>
                      )}
                    </div>
                    {deleteConfirm === service.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-slate-500">Bu hizmeti silmek istediğinize emin misiniz?</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => deleteService(service.id)}
                            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white"
                          >
                            Evet
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium dark:border-slate-600"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(service.id)}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        aria-label="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Süre</p>
                      <select
                        value={service.duration_minutes}
                        onChange={(e) =>
                          updateService(service.id, { duration_minutes: Number(e.target.value) || 30 })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {humanizeMinutes(d)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Fiyat (₺)</p>
                      <input
                        type="number"
                        step={0.01}
                        min={0}
                        value={service.price ?? ""}
                        onChange={(e) =>
                          updateService(service.id, {
                            price: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="Yok"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={service.price_visible}
                        onChange={(e) => updateService(service.id, { price_visible: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Fiyatı göster</span>
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={service.is_active}
                        onChange={(e) => updateService(service.id, { is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Aktif</span>
                    </label>
                  </div>

                  {!service.price_visible && (
                    <p className="mt-2 text-xs text-slate-500">
                      Müşteriye &quot;Fiyat için arayın&quot; gösterilir
                      {tenant?.contact_phone && ` · ${tenant.contact_phone}`}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
