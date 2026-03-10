"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MessageCircle, BarChart3, CalendarDays, Settings2 } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { WhatsAppLinkModal } from "@/components/ui/WhatsAppLinkModal";
import { useDashboardTenant } from "../DashboardTenantContext";
import {
  DAY_NAMES,
  getWeekDates,
  groupByDate,
  getAppointmentServiceLabel,
  type Appointment,
  type AvailabilityData,
  type BlockedDate,
  type OpsAlert,
  type ReminderPref,
  type ReviewData,
  type WorkingHoursSlot,
} from "./components/dashboard.types";
import type { CommandCenterSnapshot, CommandCenterAction } from "./components/CommandCenterSection";

const OverviewView = dynamic(
  () => import("./components/OverviewView").then((m) => ({ default: m.OverviewView })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const AppointmentsView = dynamic(
  () => import("./components/AppointmentsView").then((m) => ({ default: m.AppointmentsView })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const SettingsView = dynamic(
  () => import("./components/SettingsView").then((m) => ({ default: m.SettingsView })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const QRCodeModal = dynamic(
  () => import("@/components/ui/QRCodeModal").then((m) => ({ default: m.QRCodeModal })),
  { ssr: false, loading: () => null }
);

type DashboardView = "overview" | "appointments" | "settings";

const APPOINTMENTS_POLL_MS = 30000;
const OPS_ALERTS_POLL_MS = 60000;
const COMMAND_CENTER_POLL_MS = 120000;
const STAGGER_DELAY_MS = 120; // ops-alerts ve command-center için kısa gecikme

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [opsAlerts, setOpsAlerts] = useState<OpsAlert[]>([]);
  const [opsAlertsLoading, setOpsAlertsLoading] = useState(false);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addStaffId, setAddStaffId] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addDatetimeLocal, setAddDatetimeLocal] = useState("");
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [reminderPref, setReminderPref] = useState<ReminderPref>("customer_only");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [workingHours, setWorkingHours] = useState<WorkingHoursSlot[]>([]);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [workingHoursSaving, setWorkingHoursSaving] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [whatsappGreeting, setWhatsappGreeting] = useState("");
  const [messagesSaving, setMessagesSaving] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(2);
  const [botSettingsSaving, setBotSettingsSaving] = useState(false);
  const [botSettingsMessage, setBotSettingsMessage] = useState("");
  const [botSettingsError, setBotSettingsError] = useState("");
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [commandCenter, setCommandCenter] = useState<CommandCenterSnapshot | null>(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [updatingAptId, setUpdatingAptId] = useState<string | null>(null);
  const appointmentsSignatureRef = useRef("");
  const opsAlertsSignatureRef = useRef("");
  const commandCenterSignatureRef = useRef("");
  const appointmentsAbortRef = useRef<AbortController | null>(null);

  const copyCode = useCallback(() => {
    if (!tenant?.tenant_code) return;
    navigator.clipboard.writeText(tenant.tenant_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [tenant?.tenant_code]);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);


  const tenantId = resolvedParams?.tenantId;

  useEffect(() => {
    const co = tenant?.config_override as Record<string, unknown> | undefined;
    const pref = co?.reminder_preference;
    if (pref && ["off", "customer_only", "merchant_only", "both"].includes(String(pref))) {
      setReminderPref(pref as ReminderPref);
    }
    const msgs = (co?.messages as Record<string, unknown> | undefined) ?? {};
    setWelcomeMsg(String(msgs.welcome ?? ""));
    setWhatsappGreeting(String(msgs.whatsapp_greeting ?? ""));
    setContactPhone(tenant?.contact_phone ?? "");
    setWorkingHoursText(tenant?.working_hours_text ?? "");
    setOpeningMessage(String(co?.opening_message ?? ""));
    setConfirmationMessage(String(msgs.confirmation ?? ""));
    setReminderMessage(String(msgs.reminder_24h ?? ""));
    if (typeof co?.slot_duration_minutes === "number") setSlotDuration(co.slot_duration_minutes);
    if (typeof co?.advance_booking_days === "number") setAdvanceBookingDays(co.advance_booking_days);
    if (typeof co?.cancellation_hours === "number") setCancellationHours(co.cancellation_hours);
  }, [tenant?.config_override, tenant?.contact_phone, tenant?.working_hours_text]);

  const handleSaveReminderPref = async () => {
    if (!tenantId) return;
    setReminderSaving(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminder_preference: reminderPref }),
      });
      if (res.ok) setTenant((t) => (t ? { ...t, config_override: { ...(t.config_override ?? {}), reminder_preference: reminderPref } } : t));
    } finally {
      setReminderSaving(false);
    }
  };

  const handleSaveMessages = async () => {
    if (!tenantId) return;
    setMessagesSaving(true);
    try {
      const msgs: Record<string, string> = {
        welcome: welcomeMsg.trim(),
        whatsapp_greeting: whatsappGreeting.trim(),
      };
      const res = await fetch(`/api/tenant/${tenantId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      if (res.ok) {
        setTenant((t) =>
          t
            ? {
                ...t,
                config_override: {
                  ...(t.config_override ?? {}),
                  messages: { ...(t.config_override?.messages ?? {}), ...msgs },
                },
              }
            : t
        );
      }
    } finally {
      setMessagesSaving(false);
    }
  };

  const handleSaveBotSettings = async () => {
    if (!tenantId) return;
    setBotSettingsSaving(true);
    setBotSettingsError("");
    setBotSettingsMessage("");
    try {
      const payload: Record<string, unknown> = {
        contact_phone: contactPhone.trim() || null,
        working_hours_text: workingHoursText.trim() || null,
        opening_message: openingMessage.trim() || undefined,
        slot_duration_minutes: slotDuration,
        advance_booking_days: advanceBookingDays,
        cancellation_hours: cancellationHours,
        messages: {
          confirmation: confirmationMessage.trim() || undefined,
          reminder_24h: reminderMessage.trim() || undefined,
        },
      };
      const res = await fetch(`/api/tenant/${tenantId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTenant((t) => (t ? { ...t, ...data } : t));
        setBotSettingsMessage("Kaydedildi");
        setTimeout(() => setBotSettingsMessage(""), 3000);
      } else {
        setBotSettingsError((data.error as string) || "Kaydedilemedi");
      }
    } finally {
      setBotSettingsSaving(false);
    }
  };

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
        setAppointments(Array.isArray(payload) ? (payload as Appointment[]) : []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (active) setLoading(false);
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
    fetch(`/api/tenant/${tenantId}/availability/slots`, { signal })
      .then((r) => r.json())
      .then((d) => active && setWorkingHours(Array.isArray(d) ? d : []))
      .catch(() => {}),
  ]);
  return () => {
    active = false;
    controller.abort();
  };
}, [tenantId]);

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
      setOpsAlerts(Array.isArray(payload) ? (payload as OpsAlert[]) : []);
    } catch {
      // Background polling errors should not interrupt user interaction.
    } finally {
      if (!silent) setOpsAlertsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    opsAlertsSignatureRef.current = "";
    const initialT = setTimeout(() => {
      if (document.visibilityState === "visible") void fetchOpsAlerts();
    }, STAGGER_DELAY_MS * 2);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchOpsAlerts(true);
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchOpsAlerts(true);
      }
    }, OPS_ALERTS_POLL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearTimeout(initialT);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tenantId, fetchOpsAlerts]);

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
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    commandCenterSignatureRef.current = "";
    const initialT = setTimeout(() => {
      if (document.visibilityState === "visible") void fetchCommandCenter();
    }, STAGGER_DELAY_MS * 2);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchCommandCenter(true);
      }
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchCommandCenter(true);
      }
    }, COMMAND_CENTER_POLL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearTimeout(initialT);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [tenantId, fetchCommandCenter]);

  const runCommandAction = useCallback(
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
    [tenantId, fetchCommandCenter, fetchOpsAlerts]
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
        setOpsAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } finally {
      setResolvingAlertId(null);
    }
  }, [tenantId]);

  const fetchAvailability = useCallback(
    async (dateStr: string) => {
      if (!tenantId) return;
      setAvailabilityLoading(true);
      try {
        const res = await fetch(`/api/tenant/${tenantId}/availability?date=${dateStr}`);
        const data = await res.json();
        setAvailability(data);
      } finally {
        setAvailabilityLoading(false);
      }
    },
    [tenantId]
  );

  useEffect(() => {
    if (selectedDate) fetchAvailability(selectedDate);
    else setAvailability(null);
  }, [selectedDate, fetchAvailability]);

  const handleAddBlocked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !blockStart || !blockEnd) return;
    const res = await fetch(`/api/tenant/${tenantId}/blocked-dates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: blockStart,
        end_date: blockEnd,
        reason: blockReason || undefined,
      }),
    });
    if (res.ok) {
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      setShowBlocked(false);
      const data = await res.json();
      setBlockedDates((prev) => [...prev, { id: data.id, start_date: blockStart, end_date: blockEnd, reason: blockReason || null }]);
    }
  };

  const handleDeleteBlocked = async (blockId: string) => {
    if (!tenantId) return;
    const res = await fetch(`/api/tenant/${tenantId}/blocked-dates/${blockId}`, {
      method: "DELETE",
    });
    if (res.ok) setBlockedDates((prev) => prev.filter((b) => b.id !== blockId));
  };

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
          setAppointments((prev) =>
            prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
          );
          if (selectedDate) fetchAvailability(selectedDate);
        }
      } finally {
        setUpdatingAptId(null);
      }
    },
    [tenantId, selectedDate, fetchAvailability]
  );

  const handleSlotClick = useCallback((dateStr: string, timeStr: string) => {
    setActiveView("appointments");
    setAddDate(dateStr);
    setAddTime(timeStr);
    setAddPhone("");
    setAddStaffId("");
    setShowAdd(true);
  }, []);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !addPhone) return;
    let slotStart: string;
    let dateStr: string;
    if (addDate && addTime) {
      slotStart = `${addDate}T${addTime}:00`;
      dateStr = addDate;
    } else if (addDatetimeLocal) {
      slotStart = addDatetimeLocal.includes("T") ? addDatetimeLocal + ":00" : `${addDatetimeLocal}:00`;
      dateStr = addDatetimeLocal.slice(0, 10);
    } else return;
    const res = await fetch(`/api/tenant/${tenantId}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_phone: addPhone,
        slot_start: slotStart,
        staff_id:
          staffPreferenceEnabled && addStaffId.trim() ? addStaffId.trim() : null,
      }),
    });
    if (res.ok) {
      setAddPhone("");
      setAddStaffId("");
      setAddDate("");
      setAddTime("");
      setAddDatetimeLocal("");
      setShowAdd(false);
      const data = await res.json();
      setAppointments((prev) => [...prev, data]);
      if (dateStr === selectedDate) fetchAvailability(dateStr);
    }
  };

  const handleSaveWorkingHours = async () => {
    if (!tenantId) return;
    setWorkingHoursSaving(true);
    try {
      const payload = workingHours
        .filter((s) => s.start_time && s.end_time)
        .map((s) => ({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }));
      const res = await fetch(`/api/tenant/${tenantId}/availability/slots`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: payload }),
      });
      if (res.ok) {
        const data = await res.json();
        setWorkingHours(data);
        setShowWorkingHours(false);
        if (selectedDate) fetchAvailability(selectedDate);
      }
    } finally {
      setWorkingHoursSaving(false);
    }
  };

  const grouped = useMemo(() => groupByDate(appointments), [appointments]);
  const sortedDates = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const weekDates = useMemo(() => getWeekDates(weekAnchor), [weekAnchor]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((apt) => {
        if (apt.status !== "pending" && apt.status !== "confirmed") return false;
        return new Date(apt.slot_start).getTime() >= now;
      })
      .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime())[0] || null;
  }, [appointments]);
  const todayCount = grouped[todayIso]?.length ?? 0;
  const weekCount = useMemo(
    () => sortedDates.reduce((acc, d) => acc + (grouped[d]?.length ?? 0), 0),
    [sortedDates, grouped]
  );

  if (!tenantId) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header — hafif parallax + gölge scroll ile artar */}
      <header
        className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                {tenant?.name || "Randevu Paneli"}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Kod:</span>
                <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {tenant?.tenant_code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title="Kodu kopyala"
                >
                  {codeCopied ? "✓ Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Bağlantısı
              </button>
              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 sm:w-auto"
              >
                <span className="text-base">📷</span> QR Kod
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveView("appointments");
                  setAddDate("");
                  setAddTime("");
                  setAddPhone("");
                  setAddStaffId("");
                  setShowAdd(true);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900 sm:w-auto"
              >
                <span className="text-lg">+</span> Randevu Ekle
              </button>
            </div>
          </div>
          {/* Mini stats - Geliştirilmiş */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Bugün</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{todayCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">randevu</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">14 Gün</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{weekCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">randevu</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Aylık</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {commandCenter?.kpis.monthly_appointments || 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">randevu</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Doluluk</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                %{commandCenter?.kpis.fill_rate_pct.toFixed(0) || 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">oranı</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-8">
        <ScrollReveal variant="fadeUp" delay={0} as="section" className="mb-6" reduceMotion>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setActiveView("overview")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    activeView === "overview"
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Genel Bakış
                  {opsAlerts.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        activeView === "overview"
                          ? "bg-white/20 text-white"
                          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                      }`}
                    >
                      {opsAlerts.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("appointments")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    activeView === "appointments"
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <CalendarDays className="h-4 w-4" />
                  Randevular
                  {weekCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                        activeView === "appointments"
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                      }`}
                    >
                      {weekCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("settings")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    activeView === "settings"
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Settings2 className="h-4 w-4" />
                  Ayarlar
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sıradaki Randevu
                </p>
                {nextAppointment ? (
                  <>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                      {new Date(nextAppointment.slot_start).toLocaleString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {(nextAppointment.extra_data as { customer_name?: string })?.customer_name || nextAppointment.customer_phone}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {getAppointmentServiceLabel(nextAppointment)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-medium text-slate-600 dark:text-slate-400">Planlanmış yaklaşan randevu yok.</p>
                )}
              </div>
            </div>
          </section>
        </ScrollReveal>

        {activeView === "overview" && (
          <OverviewView
            commandCenter={commandCenter}
            commandCenterLoading={commandCenterLoading}
            runningActionId={runningActionId}
            opsAlerts={opsAlerts}
            opsAlertsLoading={opsAlertsLoading}
            resolvingAlertId={resolvingAlertId}
            reviews={reviews}
            appointments={appointments}
            grouped={grouped}
            weekDates={weekDates}
            onRunAction={runCommandAction}
            onResolveAlert={handleResolveAlert}
          />
        )}

        {activeView === "settings" && (
          <SettingsView
            reminderPref={reminderPref}
            setReminderPref={setReminderPref}
            welcomeMsg={welcomeMsg}
            setWelcomeMsg={setWelcomeMsg}
            whatsappGreeting={whatsappGreeting}
            setWhatsappGreeting={setWhatsappGreeting}
            contactPhone={contactPhone}
            setContactPhone={setContactPhone}
            workingHoursText={workingHoursText}
            setWorkingHoursText={setWorkingHoursText}
            openingMessage={openingMessage}
            setOpeningMessage={setOpeningMessage}
            confirmationMessage={confirmationMessage}
            setConfirmationMessage={setConfirmationMessage}
            reminderMessage={reminderMessage}
            setReminderMessage={setReminderMessage}
            slotDuration={slotDuration}
            setSlotDuration={setSlotDuration}
            advanceBookingDays={advanceBookingDays}
            setAdvanceBookingDays={setAdvanceBookingDays}
            cancellationHours={cancellationHours}
            setCancellationHours={setCancellationHours}
            workingHours={workingHours}
            setWorkingHours={setWorkingHours}
            showWorkingHours={showWorkingHours}
            setShowWorkingHours={setShowWorkingHours}
            reminderSaving={reminderSaving}
            messagesSaving={messagesSaving}
            workingHoursSaving={workingHoursSaving}
            botSettingsSaving={botSettingsSaving}
            botSettingsMessage={botSettingsMessage}
            botSettingsError={botSettingsError}
            onSaveReminderPref={handleSaveReminderPref}
            onSaveMessages={handleSaveMessages}
            onSaveWorkingHours={handleSaveWorkingHours}
            onSaveBotSettings={handleSaveBotSettings}
          />
        )}

        {activeView === "appointments" && tenantId && (
          <AppointmentsView
            tenantId={tenantId}
            grouped={grouped}
            sortedDates={sortedDates}
            weekDates={weekDates}
            todayIso={todayIso}
            weekCount={weekCount}
            selectedDate={selectedDate}
            availability={availability}
            availabilityLoading={availabilityLoading}
            weekAnchor={weekAnchor}
            showAdd={showAdd}
            addPhone={addPhone}
            addStaffId={addStaffId}
            addDate={addDate}
            addTime={addTime}
            addDatetimeLocal={addDatetimeLocal}
            blockedDates={blockedDates}
            showBlocked={showBlocked}
            blockStart={blockStart}
            blockEnd={blockEnd}
            blockReason={blockReason}
            loading={loading}
            updatingAptId={updatingAptId}
            staffPreferenceEnabled={staffPreferenceEnabled}
            staffOptions={staffOptions}
            setWeekAnchor={setWeekAnchor}
            setSelectedDate={setSelectedDate}
            setShowAdd={setShowAdd}
            setAddPhone={setAddPhone}
            setAddStaffId={setAddStaffId}
            setAddDate={setAddDate}
            setAddTime={setAddTime}
            setAddDatetimeLocal={setAddDatetimeLocal}
            setShowBlocked={setShowBlocked}
            setBlockStart={setBlockStart}
            setBlockEnd={setBlockEnd}
            setBlockReason={setBlockReason}
            onSlotClick={handleSlotClick}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointmentStatus={updateAppointmentStatus}
            onAddBlocked={handleAddBlocked}
            onDeleteBlocked={handleDeleteBlocked}
          />
        )}
      </main>

      {tenantId && (
        <WhatsAppLinkModal
          tenantId={tenantId}
          tenantCode={tenant?.tenant_code}
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {tenantId && (
        <QRCodeModal
          tenantId={tenantId}
          tenantCode={tenant?.tenant_code}
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
}
