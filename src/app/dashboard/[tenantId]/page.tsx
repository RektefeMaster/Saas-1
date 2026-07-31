"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BarChart3, CalendarDays, Plus, Settings2 } from "lucide-react";
import { useDashboardTenant } from "../DashboardTenantContext";
import { useDashboardStore } from "@/stores/dashboard-store";
import {
  groupByDate,
  getAppointmentServiceLabel,
  getWeekDates,
  type Appointment,
  type OpsAlert,
} from "./components/dashboard.types";
import type { CommandCenterSnapshot, CommandCenterAction } from "./components/CommandCenterSection";
import type { DashboardModalsHandle } from "./components/DashboardModals";
import { OverviewView } from "./components/OverviewView";

const AppointmentsView = dynamic(
  () => import("./components/AppointmentsView").then((m) => ({ default: m.AppointmentsView })),
  { loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const SettingsView = dynamic(
  () => import("./components/SettingsView").then((m) => ({ default: m.SettingsView })),
  { loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const DashboardModals = dynamic(
  () => import("./components/DashboardModals").then((m) => ({ default: m.DashboardModals })),
  { ssr: false }
);

const DashboardCodeCopy = dynamic(
  () => import("./components/DashboardCodeCopy").then((m) => ({ default: m.DashboardCodeCopy })),
  { ssr: false }
);

const APPOINTMENTS_POLL_MS = 30000;
const OPS_ALERTS_POLL_MS = 60000;
const COMMAND_CENTER_POLL_MS = 120000;

export default function EsnafDashboard({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ tenantId: string } | null>(null);
  const tenantCtx = useDashboardTenant();
  const tenant = tenantCtx?.tenant ?? null;
  const setTenant = tenantCtx?.setTenant ?? (() => {});
  const staffPreferenceEnabled = tenantCtx?.staffPreferenceEnabled ?? false;
  const staffOptions = tenantCtx?.staffOptions ?? [];

  // Zustand store - selector pattern ile sadece gerekli state'leri çek
  const appointments = useDashboardStore((state) => state.appointments);
  const blockedDates = useDashboardStore((state) => state.blockedDates);
  const reviews = useDashboardStore((state) => state.reviews);
  const opsAlerts = useDashboardStore((state) => state.opsAlerts);
  const commandCenter = useDashboardStore((state) => state.commandCenter);
  const activeView = useDashboardStore((state) => state.activeView);
  const loading = useDashboardStore((state) => state.appointmentsLoading);
  const opsAlertsLoading = useDashboardStore((state) => state.opsAlertsLoading);
  const commandCenterLoading = useDashboardStore((state) => state.commandCenterLoading);
  const updatingAptId = useDashboardStore((state) => state.updatingAptId);
  const resolvingAlertId = useDashboardStore((state) => state.resolvingAlertId);
  const runningActionId = useDashboardStore((state) => state.runningActionId);

  // Store actions
  const setAppointments = useDashboardStore((state) => state.setAppointments);
  const setBlockedDates = useDashboardStore((state) => state.setBlockedDates);
  const setReviews = useDashboardStore((state) => state.setReviews);
  const setOpsAlerts = useDashboardStore((state) => state.setOpsAlerts);
  const setCommandCenter = useDashboardStore((state) => state.setCommandCenter);
  const setActiveView = useDashboardStore((state) => state.setActiveView);
  const setAppointmentsLoading = useDashboardStore((state) => state.setAppointmentsLoading);
  const setOpsAlertsLoading = useDashboardStore((state) => state.setOpsAlertsLoading);
  const setCommandCenterLoading = useDashboardStore((state) => state.setCommandCenterLoading);
  const setUpdatingAptId = useDashboardStore((state) => state.setUpdatingAptId);
  const setResolvingAlertId = useDashboardStore((state) => state.setResolvingAlertId);
  const setRunningActionId = useDashboardStore((state) => state.setRunningActionId);
  const updateAppointment = useDashboardStore((state) => state.updateAppointment);
  const addAppointment = useDashboardStore((state) => state.addAppointment);
  const addBlockedDate = useDashboardStore((state) => state.addBlockedDate);
  const removeBlockedDate = useDashboardStore((state) => state.removeBlockedDate);
  const resolveAlert = useDashboardStore((state) => state.resolveAlert);
  const runCommandAction = useDashboardStore((state) => state.runCommandAction);
  const resetStore = useDashboardStore((state) => state.reset);

  const modalRef = useRef<DashboardModalsHandle | null>(null);
  const appointmentsSignatureRef = useRef("");
  const opsAlertsSignatureRef = useRef("");
  const commandCenterSignatureRef = useRef("");
  const appointmentsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const tenantId = resolvedParams?.tenantId;

  // Tenant değiştiğinde store'u resetle
  useEffect(() => {
    if (tenantId) {
      resetStore();
    }
  }, [tenantId, resetStore]);

  useEffect(() => {
    if (!tenantId) return;
    appointmentsSignatureRef.current = "";
    let active = true;

    const fetchAppointments = async () => {
      if (document.visibilityState !== "visible") return;

      const now = new Date();
      const from = now.toISOString().split("T")[0];
      const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      appointmentsAbortRef.current?.abort();
      const controller = new AbortController();
      appointmentsAbortRef.current = controller;

      try {
        const res = await fetch(
          `/api/tenant/${tenantId}/appointments?from=${from}T00:00:00&to=${to}T23:59:59`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!res.ok) return;
        const raw = await res.text();
        if (!active) return;
        if (raw === appointmentsSignatureRef.current) return;

        appointmentsSignatureRef.current = raw;
        const payload = (JSON.parse(raw) as unknown) ?? [];
        const appointmentsData = Array.isArray(payload) ? (payload as Appointment[]) : [];
        setAppointments(appointmentsData);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (active) setAppointmentsLoading(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchAppointments();
      }
    };

    void fetchAppointments();
    const interval = window.setInterval(() => {
      void fetchAppointments();
    }, APPOINTMENTS_POLL_MS);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      appointmentsAbortRef.current?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const controller = new AbortController();
    const { signal } = controller;
    let active = true;
    Promise.all([
      fetch(`/api/tenant/${tenantId}/blocked-dates`, { signal })
        .then((r) => r.json())
        .then((d) => active && setBlockedDates(Array.isArray(d) ? d : []))
        .catch(() => {}),
      fetch(`/api/tenant/${tenantId}/reviews`, { signal })
        .then((r) => r.json())
        .then((d) => active && setReviews(d))
        .catch(() => {}),
    ]);
    return () => {
      active = false;
      controller.abort();
    };
  }, [tenantId, setBlockedDates, setReviews]);

  const fetchOpsAlerts = useCallback(async (silent = false) => {
    if (!tenantId) return;
    if (!silent) setOpsAlertsLoading(true);
    try {
      const res = await fetch(
        `/api/tenant/${tenantId}/ops-alerts?status=open&limit=8`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const raw = await res.text();
      if (raw === opsAlertsSignatureRef.current) return;
      opsAlertsSignatureRef.current = raw;
      const payload = (JSON.parse(raw) as unknown) ?? [];
      const alertsData = Array.isArray(payload) ? (payload as OpsAlert[]) : [];
      setOpsAlerts(alertsData);
    } catch {
      // Background polling errors should not interrupt user interaction.
    } finally {
      if (!silent) setOpsAlertsLoading(false);
    }
  }, [tenantId, setOpsAlertsLoading, setOpsAlerts]);

  const fetchCommandCenter = useCallback(async (silent = false) => {
    if (!tenantId) return;
    if (!silent) setCommandCenterLoading(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/command-center`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const raw = await res.text();
      if (raw === commandCenterSignatureRef.current) return;
      commandCenterSignatureRef.current = raw;
      const data = (JSON.parse(raw) as CommandCenterSnapshot | null) ?? null;
      if (data && typeof data === "object" && data.kpis) {
        setCommandCenter(data);
      }
    } catch {
      // Background polling errors should not interrupt user interaction.
    } finally {
      if (!silent) setCommandCenterLoading(false);
    }
  }, [tenantId, setCommandCenterLoading, setCommandCenter]);

  useEffect(() => {
    if (!tenantId) return;
    opsAlertsSignatureRef.current = "";
    commandCenterSignatureRef.current = "";

    const runBoth = (silent: boolean) => {
      if (document.visibilityState !== "visible") return;
      void fetchOpsAlerts(silent);
      void fetchCommandCenter(silent);
    };

    if (document.visibilityState === "visible") {
      runBoth(false);
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") runBoth(true);
    };

    const opsInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchOpsAlerts(true);
    }, OPS_ALERTS_POLL_MS);
    const cmdInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchCommandCenter(true);
    }, COMMAND_CENTER_POLL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(opsInterval);
      window.clearInterval(cmdInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tenantId, fetchOpsAlerts, fetchCommandCenter]);

  // runCommandAction store'da tanımlı, ama tenantId'ye ihtiyacı var
  // Bu yüzden wrapper function oluşturuyoruz
  const handleRunCommandAction = useCallback(
    async (action: CommandCenterAction) => {
      if (!tenantId) return;
      setRunningActionId(action.id);
      try {
        if (action.id === "reactivation" || action.id === "slot_fill" || action.id === "no_show_mitigation") {
          await fetch(`/api/tenant/${tenantId}/automation/reactivation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "queue", limit: 20, days: 45 }),
          });
        } else if (action.id === "reputation_recovery") {
          await fetch(`/api/tenant/${tenantId}/reputation/summary`);
        } else {
          await fetch(action.cta_endpoint);
        }
        await Promise.all([fetchCommandCenter(), fetchOpsAlerts()]);
      } finally {
        setRunningActionId(null);
      }
    },
    [tenantId, fetchCommandCenter, fetchOpsAlerts, setRunningActionId]
  );

  const handleResolveAlert = useCallback(async (alertId: string) => {
    if (!tenantId) return;
    setResolvingAlertId(alertId);
    try {
      const res = await fetch(
        `/api/tenant/${tenantId}/ops-alerts/${alertId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        }
      );
      if (res.ok) {
        resolveAlert(alertId);
      }
    } finally {
      setResolvingAlertId(null);
    }
  }, [tenantId, setResolvingAlertId, resolveAlert]);

  const onWorkingHoursSaved = useCallback(() => {
    // Availability will be refetched by AppointmentsView if needed
  }, []);

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: string) => {
      if (!tenantId) return;
      if (status === "cancelled" && !confirm("Bu randevuyu iptal etmek istiyor musunuz?")) return;
      if (status === "no_show" && !confirm("Müşteri gelmedi olarak işaretlensin mi?")) return;
      setUpdatingAptId(appointmentId);
      try {
        const res = await fetch(`/api/tenant/${tenantId}/appointments/${appointmentId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          updateAppointment(appointmentId, { status });
        }
      } finally {
        setUpdatingAptId(null);
      }
    },
    [tenantId, setUpdatingAptId, updateAppointment]
  );

  // Computed values - sadece header'da kullanılanlar
  const grouped = useMemo(() => groupByDate(appointments), [appointments]);
  const todayIso = useMemo(
    () => new Date().toISOString().slice(0, 10),
    [Math.floor(Date.now() / 86400000)]
  );
  const sortedDates = useMemo(() => getWeekDates(new Date()), []);
  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((apt) => {
        if (apt.status !== "pending" && apt.status !== "confirmed") return false;
        return new Date(apt.slot_start).getTime() >= now;
      })
      .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime())[0] || null;
  }, [appointments]);

  const nextAppointmentDisplay = useMemo(() => {
    if (!nextAppointment) return null;
    return {
      formattedTime: new Date(nextAppointment.slot_start).toLocaleString("tr-TR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      customerName: (nextAppointment.extra_data as { customer_name?: string })?.customer_name || nextAppointment.customer_phone,
      serviceLabel: getAppointmentServiceLabel(nextAppointment),
    };
  }, [nextAppointment]);
  const todayCount = useMemo(() => grouped[todayIso]?.length ?? 0, [grouped, todayIso]);
  const weekCount = useMemo(
    () => sortedDates.reduce((acc, d) => acc + (grouped[d]?.length ?? 0), 0),
    [sortedDates, grouped]
  );

  if (!tenantId) return null;

  return (
    <div className="min-h-full overflow-x-hidden bg-[var(--background)]">
      <header className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                {tenant?.name || "Randevu Paneli"}
              </h1>
              <DashboardCodeCopy tenantCode={tenant?.tenant_code} />
            </div>
            <button
              type="button"
              onClick={() => setActiveView("appointments")}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-foreground)] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 sm:w-auto"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Randevu Ekle
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Bugün", value: todayCount, hint: "randevu" },
              { label: "14 Gün", value: weekCount, hint: "randevu" },
              {
                label: "Aylık",
                value: commandCenter?.kpis.monthly_appointments || 0,
                hint: "randevu",
              },
              {
                label: "Doluluk",
                value: `%${commandCenter?.kpis.fill_rate_pct.toFixed(0) || 0}`,
                hint: "oran",
              },
            ].map((stat) => (
              <div key={stat.label} className="panel-muted px-3.5 py-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{stat.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <section className="panel-surface mb-5 p-4 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-stretch">
            <div
              className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
              role="tablist"
              aria-label="Panel görünümü"
            >
              {(
                [
                  {
                    key: "overview" as const,
                    label: "Genel Bakış",
                    icon: BarChart3,
                    badge: opsAlerts.length > 0 ? opsAlerts.length : null,
                    badgeTone: "alert" as const,
                  },
                  {
                    key: "appointments" as const,
                    label: "Randevular",
                    icon: CalendarDays,
                    badge: weekCount > 0 ? weekCount : null,
                    badgeTone: "ok" as const,
                  },
                  {
                    key: "settings" as const,
                    label: "Ayarlar",
                    icon: Settings2,
                    badge: null,
                    badgeTone: "ok" as const,
                  },
                ] as const
              ).map(({ key, label, icon: Icon, badge, badgeTone }) => {
                const active = activeView === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveView(key)}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors duration-150 sm:gap-2 sm:text-sm ${
                      active
                        ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                    {badge != null && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : badgeTone === "alert"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sıradaki randevu</p>
              {nextAppointmentDisplay ? (
                <>
                  <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                    {nextAppointmentDisplay.formattedTime} · {nextAppointmentDisplay.customerName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {nextAppointmentDisplay.serviceLabel}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-slate-600 dark:text-slate-400">Yaklaşan randevu yok</p>
              )}
            </div>
          </div>
        </section>

        {activeView === "overview" && (
          <OverviewView
            onRunAction={handleRunCommandAction}
            onResolveAlert={handleResolveAlert}
          />
        )}

        {activeView === "settings" && tenantId && (
          <SettingsView
            tenantId={tenantId}
            tenant={tenant}
            setTenant={setTenant}
            onWorkingHoursSaved={onWorkingHoursSaved}
          />
        )}

        {activeView === "appointments" && tenantId && (
          <AppointmentsView
            tenantId={tenantId}
            onUpdateAppointmentStatus={updateAppointmentStatus}
          />
        )}
      </main>

      {tenantId && (
        <DashboardModals
          ref={modalRef}
          tenantId={tenantId}
          tenantCode={tenant?.tenant_code}
        />
      )}
    </div>
  );
}
