"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  RefreshCw,
  Sparkles,
  UserX,
  XOctagon,
} from "lucide-react";

type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

interface WorkflowAppointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: AppointmentStatus;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
}

type IconType = ComponentType<{ className?: string }>;

interface StatusColumnConfig {
  title: string;
  description: string;
  icon: IconType;
  columnClass: string;
  badgeClass: string;
  emptyClass: string;
  emptyMessage: string;
}

interface StatusActionConfig {
  label: string;
  icon: IconType;
  className: string;
}

const STATUS_ORDER: AppointmentStatus[] = ["pending", "confirmed", "completed", "cancelled", "no_show"];

const STATUS_CONFIG: Record<AppointmentStatus, StatusColumnConfig> = {
  pending: {
    title: "Yeni",
    description: "Henüz onaylanmamış yeni randevu talepleri",
    icon: Sparkles,
    columnClass: "border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/20",
    badgeClass: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
    emptyClass: "border-amber-200/80 text-amber-700 dark:border-amber-800/80 dark:text-amber-300",
    emptyMessage: "Yeni bekleyen randevu yok",
  },
  confirmed: {
    title: "Onaylı",
    description: "Onaylanmış, bugün gerçekleşecek randevular",
    icon: Check,
    columnClass: "border-cyan-200 bg-cyan-50/70 dark:border-cyan-800 dark:bg-cyan-950/20",
    badgeClass: "bg-cyan-100 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-200",
    emptyClass: "border-cyan-200/80 text-cyan-700 dark:border-cyan-800/80 dark:text-cyan-300",
    emptyMessage: "Onaylı randevu yok",
  },
  completed: {
    title: "Tamamlandı",
    description: "Tamamlanmış randevular",
    icon: CheckCircle2,
    columnClass: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20",
    badgeClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200",
    emptyClass: "border-emerald-200/80 text-emerald-700 dark:border-emerald-800/80 dark:text-emerald-300",
    emptyMessage: "Bugün tamamlanan randevu yok",
  },
  cancelled: {
    title: "İptal",
    description: "İptal edilmiş randevular",
    icon: XOctagon,
    columnClass: "border-rose-200 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/20",
    badgeClass: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200",
    emptyClass: "border-rose-200/80 text-rose-700 dark:border-rose-800/80 dark:text-rose-300",
    emptyMessage: "İptal edilen randevu yok",
  },
  no_show: {
    title: "Gelmedi",
    description: "Randevuya gelmeyen müşteriler",
    icon: UserX,
    columnClass: "border-orange-200 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/20",
    badgeClass: "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200",
    emptyClass: "border-orange-200/80 text-orange-700 dark:border-orange-800/80 dark:text-orange-300",
    emptyMessage: "Gelmeyen müşteri yok",
  },
};

const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const ACTION_CONFIG: Record<AppointmentStatus, StatusActionConfig> = {
  pending: {
    label: "Beklemede",
    icon: Sparkles,
    className: "border border-slate-300 bg-slate-50 text-slate-600",
  },
  confirmed: {
    label: "Onayla",
    icon: Check,
    className:
      "border border-emerald-500 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:border-emerald-600",
  },
  completed: {
    label: "Tamamla",
    icon: CheckCircle2,
    className:
      "border border-cyan-500 bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 hover:border-cyan-600",
  },
  cancelled: {
    label: "İptal",
    icon: XOctagon,
    className:
      "border border-rose-300 bg-white text-rose-700 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/20",
  },
  no_show: {
    label: "Gelmedi",
    icon: UserX,
    className:
      "border border-orange-300 bg-orange-100 text-orange-900 shadow-sm hover:bg-orange-200 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-200 dark:hover:bg-orange-900/60",
  },
};

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
  return STATUS_ORDER.reduce<Record<AppointmentStatus, WorkflowAppointment[]>>((acc, key) => {
    acc[key] = Array.isArray(input?.[key]) ? input[key] : [];
    return acc;
  }, createEmptyStatuses());
}

function getTodayIso() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function formatSlotTime(slotStart: string) {
  return new Date(slotStart).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function extractCustomerName(item: WorkflowAppointment) {
  const extra = (item.extra_data || {}) as {
    customer_name?: string;
    name?: string;
  };
  return extra.customer_name || extra.name || item.customer_phone;
}

function extractServiceName(item: WorkflowAppointment) {
  const extra = (item.extra_data || {}) as {
    service_name?: string;
    service_label?: string;
  };
  return extra.service_name || extra.service_label || item.service_slug || "Genel randevu";
}

function moveAppointmentLocally(
  previous: Record<AppointmentStatus, WorkflowAppointment[]>,
  appointmentId: string,
  nextStatus: AppointmentStatus
) {
  let moved: WorkflowAppointment | null = null;
  const next = createEmptyStatuses();

  for (const status of STATUS_ORDER) {
    next[status] = previous[status].filter((item) => {
      if (item.id !== appointmentId) return true;
      moved = { ...item, status: nextStatus };
      return false;
    });
  }

  if (moved) {
    next[nextStatus] = [...next[nextStatus], moved].sort(
      (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime()
    );
  }

  return next;
}

export default function WorkflowPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [date, setDate] = useState(getTodayIso);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<AppointmentStatus, WorkflowAppointment[]>>(
    () => createEmptyStatuses()
  );
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    params.then((p) => {
      if (mounted) setTenantId(p.tenantId);
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  const refresh = useCallback(async (silent = false) => {
    if (!tenantId) return false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/tenant/${tenantId}/workflow?date=${date}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        statuses?: Record<string, WorkflowAppointment[]>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "İş akışı verisi alınamadı.");
      }
      setStatuses(normalizeStatuses(payload.statuses));
      setLastSyncedAt(new Date());
      setError(null);
      return true;
    } catch (requestError) {
      if (!silent) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "İş akışı verisi alınamadı. Lütfen tekrar deneyin."
        );
      }
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!tenantId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [refresh, tenantId]);

  const updateStatus = async (appointmentId: string, status: AppointmentStatus) => {
    if (!tenantId || updatingId) return;
    const previous = statuses;
    setUpdatingId(appointmentId);
    setError(null);
    setStatuses((prev) => moveAppointmentLocally(prev, appointmentId, status));

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
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Durum güncellenemedi.");
      }

      setLastSyncedAt(new Date());
      void refresh(true);
    } catch (requestError) {
      setStatuses(previous);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Durum güncellenemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const totalCount = useMemo(
    () => STATUS_ORDER.reduce((sum, status) => sum + statuses[status].length, 0),
    [statuses]
  );
  const activeCount = statuses.pending.length + statuses.confirmed.length;
  const completedCount = statuses.completed.length;
  const riskCount = statuses.cancelled.length + statuses.no_show.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const todayIso = getTodayIso();
  const isToday = date === todayIso;
  const firstLoad = loading && totalCount === 0;
  const boardDisabled = Boolean(updatingId);
  const lastSyncedLabel = lastSyncedAt ? `${formatClock(lastSyncedAt)} itibarıyla güncel` : "Henüz güncellenmedi";

  return (
    <div className="space-y-5 p-4 pb-28 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="pointer-events-none absolute -right-8 -top-14 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-900/25" />
        <div className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full bg-emerald-300/35 blur-3xl dark:bg-emerald-900/25" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Link
                href={`/dashboard/${tenantId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Panele dön
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                  İş Akışı
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                  Günlük randevularınızı tek ekranda takip edin. Kartlara tıklayarak durum güncelleyebilirsiniz.
                </p>
              </div>
            </div>
            <div className="min-w-[16rem] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Son güncelleme
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{lastSyncedLabel}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Her dakika otomatik yenilenir.</p>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            <article className="min-w-[11.5rem] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Toplam</p>
              <p className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                {totalCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seçilen günün randevuları</p>
            </article>
            <article className="min-w-[11.5rem] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Bekleyen</p>
              <p className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                {activeCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Yeni ve onaylı randevular</p>
            </article>
            <article className="min-w-[11.5rem] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tamamlama
              </p>
              <p className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                %{completionRate}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{completedCount} randevu tamamlandı</p>
            </article>
            <article className="min-w-[11.5rem] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk</p>
              <p className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                {riskCount}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">İptal ve gelmeyenler</p>
            </article>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tarih
              </label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setDate(todayIso)}
              className={`h-11 rounded-xl border px-4 text-sm font-semibold transition ${
                isToday
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              Bugün
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Yenile
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </section>
      )}

      {firstLoad ? (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-300" />
            İş akışı yükleniyor...
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-max grid-flow-col auto-cols-[minmax(19rem,19rem)] gap-4">
              {STATUS_ORDER.map((status) => (
                <div
                  key={`skeleton-${status}`}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-2">
                    <div className="h-24 animate-pulse rounded-xl bg-white dark:bg-slate-800" />
                    <div className="h-24 animate-pulse rounded-xl bg-white dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : totalCount === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-white/90 px-4 py-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
          <Calendar className="h-14 w-14 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-200">Bu tarihte randevu yok</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Başka bir tarih seçin veya{" "}
            <Link
              href={`/dashboard/${tenantId}`}
              className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-2 dark:text-cyan-300"
            >
              Özet
            </Link>{" "}
            sayfasından yeni randevu ekleyin.
          </p>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_CONFIG[status];
              const Icon = meta.icon;
              return (
                <div
                  key={`legend-${status}`}
                  className="inline-flex min-w-max items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="font-semibold">{meta.title}</span>
                </div>
              );
            })}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-max grid-flow-col auto-cols-[minmax(19rem,19rem)] gap-4">
              {STATUS_ORDER.map((status) => {
                const meta = STATUS_CONFIG[status];
                const Icon = meta.icon;
                const items = statuses[status];
                return (
                  <section
                    key={status}
                    className={`flex min-h-[30rem] flex-col rounded-2xl border p-3 ${meta.columnClass}`}
                  >
                    <header className="mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                          <Icon className="h-4 w-4" />
                          {meta.title}
                        </h2>
                        <span
                          className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                        >
                          {items.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{meta.description}</p>
                    </header>

                    {items.length === 0 ? (
                      <div
                        className={`mt-1 rounded-xl border border-dashed px-3 py-8 text-center text-xs ${meta.emptyClass}`}
                      >
                        {meta.emptyMessage}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {items.map((item, index) => {
                          const nextActions = STATUS_TRANSITIONS[status];
                          const isUpdating = updatingId === item.id;
                          return (
                            <article
                              key={item.id}
                              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {extractCustomerName(item)}
                                  </p>
                                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                    <Clock3 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                                    {formatSlotTime(item.slot_start)}
                                  </p>
                                </div>
                                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-slate-100 px-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {index + 1}
                                </span>
                              </div>

                              <div className="mt-3 space-y-1.5 text-xs">
                                <p className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                  {item.customer_phone}
                                </p>
                                <p className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <CalendarDays className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                  {extractServiceName(item)}
                                </p>
                              </div>

                              {nextActions.length > 0 && (
                                <div className="mt-3 grid gap-2">
                                  {nextActions.map((targetStatus) => {
                                    const action = ACTION_CONFIG[targetStatus];
                                    const ActionIcon = action.icon;
                                    return (
                                      <button
                                        key={`${item.id}-${targetStatus}`}
                                        type="button"
                                        disabled={boardDisabled}
                                        onClick={() => updateStatus(item.id, targetStatus)}
                                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${action.className}`}
                                      >
                                        {isUpdating ? (
                                          <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Güncelleniyor...
                                          </>
                                        ) : (
                                          <>
                                            <ActionIcon className="h-3.5 w-3.5" />
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
          </div>
        </section>
      )}
    </div>
  );
}
