"use client";

import { useEffect, useState } from "react";

type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

interface WorkflowAppointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: AppointmentStatus;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
}

const COLUMNS: Array<{ key: AppointmentStatus; title: string }> = [
  { key: "pending", title: "Yeni" },
  { key: "confirmed", title: "Onaylı" },
  { key: "completed", title: "Tamamlandı" },
  { key: "cancelled", title: "İptal" },
  { key: "no_show", title: "Gelmedi" },
];

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, WorkflowAppointment[]>>({
    pending: [],
    confirmed: [],
    completed: [],
    cancelled: [],
    no_show: [],
  });

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const refresh = async () => {
    if (!tenantId) return;
    setLoading(true);
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/workflow?date=${date}`);
    const payload = (await res.json().catch(() => ({}))) as {
      statuses?: Record<string, WorkflowAppointment[]>;
    };
    setStatuses(
      payload.statuses || {
        pending: [],
        confirmed: [],
        completed: [],
        cancelled: [],
        no_show: [],
      }
    );
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [tenantId, date]);

  const updateStatus = async (appointmentId: string, status: AppointmentStatus) => {
    if (!tenantId) return;
    await fetch(`${baseUrl}/api/tenant/${tenantId}/appointments/${appointmentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            İş Akışı
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Günlük randevularınızı durum bazlı sütunlarda yönetin.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tarih
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          />
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Yükleniyor...
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          {COLUMNS.map((column) => {
            const items = statuses[column.key] || [];
            return (
              <section
                key={column.key}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{column.title}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
                    Kayıt yok
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => {
                      const customerName =
                        ((item.extra_data || {}) as { customer_name?: string }).customer_name ||
                        item.customer_phone;
                      const time = new Date(item.slot_start).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <article key={item.id} className="rounded-xl border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {customerName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {time} • {item.service_slug || "Genel randevu"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {COLUMNS.map((target) => (
                              <button
                                key={`${item.id}-${target.key}`}
                                type="button"
                                disabled={target.key === item.status}
                                onClick={() => updateStatus(item.id, target.key)}
                                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                                  target.key === item.status
                                    ? "bg-cyan-600 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                              >
                                {target.title}
                              </button>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
