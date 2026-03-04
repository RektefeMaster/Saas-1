"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, XOctagon, UserX, Sparkles, Calendar, Loader2 } from "lucide-react";

type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

interface WorkflowAppointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: AppointmentStatus;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
}

const COLUMNS: Array<{
  key: AppointmentStatus;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
  nextActions: Array<{ status: AppointmentStatus; label: string; icon: React.ComponentType<{ className?: string }>; style: string }>;
}> = [
  {
    key: "pending",
    title: "Yeni",
    icon: Sparkles,
    bgClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    nextActions: [
      { status: "confirmed", label: "Onayla", icon: Check, style: "bg-emerald-600 text-white hover:bg-emerald-700" },
      { status: "cancelled", label: "İptal", icon: XOctagon, style: "bg-white text-red-600 border border-red-200 hover:bg-red-50 dark:bg-slate-800 dark:border-red-800" },
    ],
  },
  {
    key: "confirmed",
    title: "Onaylı",
    icon: Check,
    bgClass: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800",
    nextActions: [
      { status: "completed", label: "Tamamlandı", icon: CheckCircle2, style: "bg-emerald-600 text-white hover:bg-emerald-700" },
      { status: "no_show", label: "Gelmedi", icon: UserX, style: "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 dark:bg-amber-900/50 dark:border-amber-700" },
      { status: "cancelled", label: "İptal", icon: XOctagon, style: "bg-white text-red-600 border border-red-200 hover:bg-red-50 dark:bg-slate-800 dark:border-red-800" },
    ],
  },
  {
    key: "completed",
    title: "Tamamlandı",
    icon: CheckCircle2,
    bgClass: "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700",
    nextActions: [],
  },
  {
    key: "cancelled",
    title: "İptal",
    icon: XOctagon,
    bgClass: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    nextActions: [],
  },
  {
    key: "no_show",
    title: "Gelmedi",
    icon: UserX,
    bgClass: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
    nextActions: [],
  },
];

const COLUMN_KEYS: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled", "no_show"];

function createEmptyStatuses(): Record<AppointmentStatus, WorkflowAppointment[]> {
  return {
    pending: [],
    confirmed: [],
    completed: [],
    cancelled: [],
    no_show: [],
  };
}

function normalizeStatuses(
  input?: Record<string, WorkflowAppointment[]>
): Record<AppointmentStatus, WorkflowAppointment[]> {
  return COLUMN_KEYS.reduce<Record<AppointmentStatus, WorkflowAppointment[]>>((acc, key) => {
    acc[key] = Array.isArray(input?.[key]) ? input[key] : [];
    return acc;
  }, createEmptyStatuses());
}

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<AppointmentStatus, WorkflowAppointment[]>>(
    () => createEmptyStatuses()
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const refresh = useCallback(async (silent = false) => {
    if (!tenantId) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/workflow?date=${date}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as {
        statuses?: Record<string, WorkflowAppointment[]>;
      };
      setStatuses(normalizeStatuses(payload.statuses));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateStatus = async (appointmentId: string, status: AppointmentStatus) => {
    if (!tenantId) return;
    const previous = statuses;
    setUpdatingId(appointmentId);
    setStatuses((prev) => {
      let moved: WorkflowAppointment | null = null;
      const next = createEmptyStatuses();

      for (const column of COLUMN_KEYS) {
        next[column] = prev[column].filter((item) => {
          if (item.id === appointmentId) {
            moved = { ...item, status };
            return false;
          }
          return true;
        });
      }

      if (moved) {
        next[status] = [...next[status], moved].sort(
          (a, b) =>
            new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()
        );
      }

      return next;
    });

    try {
      const res = await fetch(
        `/api/tenant/${tenantId}/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        setStatuses(previous);
        return;
      }

      const updated = (await res.json().catch(() => null)) as WorkflowAppointment | null;
      if (updated?.id) {
        setStatuses((prev) => ({
          ...prev,
          [status]: prev[status].map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item
          ),
        }));
      }

      void refresh(true);
    } catch {
      setStatuses(previous);
    } finally {
      setUpdatingId(null);
    }
  };

  const totalCount = COLUMN_KEYS.reduce((sum, k) => sum + (statuses[k]?.length ?? 0), 0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = date === todayIso;

  return (
    <div className="p-4 pb-28 sm:p-6 lg:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={`/dashboard/${tenantId}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Panele Dön
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            İş Akışı
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Günlük randevularınızı sütunlarda yönetin. Her kartta sadece mantıklı aksiyonlar gösterilir.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tarih
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setDate(todayIso)}
                className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                  isToday
                    ? "border-emerald-500 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Bugün
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-white py-16 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          <p className="mt-4 text-sm font-medium text-slate-500">Yükleniyor...</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Calendar className="h-14 w-14 text-slate-300" />
          <p className="mt-4 text-base font-semibold text-slate-600 dark:text-slate-400">
            Bu tarihte randevu yok
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Başka bir tarih seçin veya <Link href={`/dashboard/${tenantId}`} className="font-semibold text-emerald-600 hover:underline">Özet</Link> sayfasından randevu ekleyin.
          </p>
        </div>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 xl:grid xl:grid-cols-5 xl:overflow-visible xl:gap-5">
          {COLUMNS.map((column) => {
            const items = statuses[column.key] || [];
            const Icon = column.icon;
            return (
              <section
                key={column.key}
                className={`w-[88vw] max-w-[24rem] shrink-0 snap-start rounded-2xl border-2 p-4 shadow-sm xl:w-auto xl:max-w-none xl:shrink ${column.bgClass} dark:border-slate-700`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <Icon className="h-4 w-4" />
                    {column.title}
                  </h2>
                  <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-slate-200/80 px-2 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {items.length}
                  </span>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
                    Bu sütunda randevu yok
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
                        timeZone: "Europe/Istanbul",
                      });
                      const actions = column.nextActions;
                      const isUpdating = updatingId === item.id;
                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border-2 border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80"
                        >
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {customerName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {time} • {item.service_slug || "Genel randevu"}
                          </p>
                          {actions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {actions.map((action) => {
                                const ActionIcon = action.icon;
                                return (
                                  <button
                                    key={`${item.id}-${action.status}`}
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => updateStatus(item.id, action.status)}
                                    className={`min-h-[44px] min-w-[44px] flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${action.style}`}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                    ) : (
                                      <>
                                        <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                                        {action.label}
                                      </>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
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
