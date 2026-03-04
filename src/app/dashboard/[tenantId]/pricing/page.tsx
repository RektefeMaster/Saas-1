"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

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

    const res = await fetch(`/api/tenant/${tenantId}/services/${serviceId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setServices(prevServices);
    }
  };

  return (
    <div className="p-4 pb-24 sm:p-6 lg:p-10">
      <header className="mb-8">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Panele dön
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Fiyat Listesi</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Hizmetlerinizi ve fiyatlarınızı ekleyin, düzenleyin.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Yeni hizmet ekle</h2>
        <form onSubmit={createService} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Hizmet adı</label>
              <input
                value={newService.name}
                onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                placeholder="Örn: Saç kesimi"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Süre (dk)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={newService.duration_minutes}
                onChange={(e) =>
                  setNewService((s) => ({ ...s, duration_minutes: Number(e.target.value) || 30 }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Fiyat (TL)</label>
              <input
                type="number"
                step={0.01}
                min={0}
                value={newService.price}
                onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))}
                placeholder="Boş bırakılabilir"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Ekleniyor…" : "Ekle"}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Açıklama (isteğe bağlı)</label>
            <input
              value={newService.description}
              onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
              placeholder="Kısa açıklama"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
        ) : sortedServices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Henüz hizmet tanımlı değil.</div>
        ) : (
          <>
            <div className="space-y-3 p-4 lg:hidden">
              {sortedServices.map((service) => (
                <article
                  key={service.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {service.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {service.description || "Açıklama yok"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteService(service.id)}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700"
                    >
                      Sil
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">
                      Süre (dk)
                      <input
                        type="number"
                        min={5}
                        step={5}
                        defaultValue={service.duration_minutes}
                        onBlur={(e) =>
                          updateService(service.id, { duration_minutes: Number(e.target.value) || 30 })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Fiyat (TL)
                      <input
                        type="number"
                        step={0.01}
                        min={0}
                        defaultValue={service.price ?? ""}
                        onBlur={(e) =>
                          updateService(service.id, {
                            price: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="Yok"
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={service.price_visible}
                        onChange={(e) => updateService(service.id, { price_visible: e.target.checked })}
                      />
                      Fiyatı göster
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={service.is_active}
                        onChange={(e) => updateService(service.id, { is_active: e.target.checked })}
                      />
                      Aktif
                    </label>
                  </div>

                  {!service.price_visible && (
                    <p className="mt-2 text-xs text-slate-500">
                      Fallback: Fiyat için arayın {tenant?.contact_phone ? `(${tenant.contact_phone})` : ""}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[840px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Hizmet</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Süre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fiyat</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Görünürlük</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Durum</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedServices.map((service) => (
                    <tr key={service.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{service.name}</div>
                        <div className="text-xs text-slate-500">{service.description || "Açıklama yok"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={5}
                          step={5}
                          defaultValue={service.duration_minutes}
                          onBlur={(e) => updateService(service.id, { duration_minutes: Number(e.target.value) || 30 })}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step={0.01}
                          min={0}
                          defaultValue={service.price ?? ""}
                          onBlur={(e) =>
                            updateService(service.id, {
                              price: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="Yok"
                          className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={service.price_visible}
                            onChange={(e) => updateService(service.id, { price_visible: e.target.checked })}
                          />
                          Fiyatı göster
                        </label>
                        {!service.price_visible && (
                          <div className="mt-1 text-xs text-slate-500">
                            Fallback: Fiyat için arayın {tenant?.contact_phone ? `(${tenant.contact_phone})` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={service.is_active}
                            onChange={(e) => updateService(service.id, { is_active: e.target.checked })}
                          />
                          Aktif
                        </label>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteService(service.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
