"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const refresh = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [servicesRes, tenantRes] = await Promise.all([
      fetch(`${baseUrl}/api/tenant/${tenantId}/services`),
      fetch(`${baseUrl}/api/tenant/${tenantId}`),
    ]);
    const servicesData = (await servicesRes.json().catch(() => [])) as ServiceItem[];
    const tenantData = (await tenantRes.json().catch(() => null)) as TenantBasic | null;
    setServices(Array.isArray(servicesData) ? servicesData : []);
    setTenant(tenantData);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [tenantId]);

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
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/services`, {
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
    if (res.ok) {
      setNewService({
        name: "",
        description: "",
        duration_minutes: 30,
        price: "",
        price_visible: true,
      });
      await refresh();
    }
    setSaving(false);
  };

  const updateService = async (serviceId: string, payload: Record<string, unknown>) => {
    if (!tenantId) return;
    await fetch(`${baseUrl}/api/tenant/${tenantId}/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await refresh();
  };

  const deleteService = async (serviceId: string) => {
    if (!tenantId) return;
    await fetch(`${baseUrl}/api/tenant/${tenantId}/services/${serviceId}`, {
      method: "DELETE",
    });
    await refresh();
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Fiyat Listesi
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Hizmet ve fiyatlarınızı yönetin. Fiyat görünmeyen hizmetler müşteriye samimi bir dille
          “fiyat için arayın” fallback mesajıyla sunulur.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Yeni hizmet</h2>
        <form onSubmit={createService} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={newService.name}
            onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
            placeholder="Hizmet adı"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            required
          />
          <input
            value={newService.description}
            onChange={(e) => setNewService((s) => ({ ...s, description: e.target.value }))}
            placeholder="Açıklama (opsiyonel)"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <input
            type="number"
            min={5}
            step={5}
            value={newService.duration_minutes}
            onChange={(e) =>
              setNewService((s) => ({ ...s, duration_minutes: Number(e.target.value) || 30 }))
            }
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <input
            type="number"
            step={0.01}
            min={0}
            value={newService.price}
            onChange={(e) => setNewService((s) => ({ ...s, price: e.target.value }))}
            placeholder="Fiyat (TL)"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Ekleniyor..." : "Hizmet Ekle"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
        ) : sortedServices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Henüz hizmet tanımlı değil.</div>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </section>
    </div>
  );
}
