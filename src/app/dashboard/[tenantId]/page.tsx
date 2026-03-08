"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { MotionConfig, motion, useScroll, useTransform } from "motion/react";
import { ChartBar } from "@/components/charts/ChartBar";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import {
  Loader2,
  Clock,
  XCircle,
  MessageCircle,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  CalendarDays,
  Settings2,
} from "lucide-react";
import {
  CommandCenterSection,
  type CommandCenterSnapshot,
  type CommandCenterAction,
} from "./components/CommandCenterSection";
import { MessageSettings } from "./components/MessageSettings";
import AppointmentBook from "./components/AppointmentBook";
import { WhatsAppLinkModal } from "@/components/ui/WhatsAppLinkModal";
import { useDashboardTenant } from "../DashboardTenantContext";
import { group, sort } from "radash";

const QRCodeModal = dynamic(
  () => import("@/components/ui/QRCodeModal").then((m) => ({ default: m.QRCodeModal })),
  { ssr: false, loading: () => null }
);

interface Appointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: string;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
}

interface AvailabilitySlot {
  time: string;
  customer_phone?: string;
  id?: string;
}

interface AvailabilityData {
  date: string;
  blocked: boolean;
  available: string[];
  booked: AvailabilitySlot[];
  workingHours: { start: string; end: string } | null;
  noSchedule?: boolean;
}

interface WorkingHoursSlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  day_name?: string;
}

type ReminderPref = "off" | "customer_only" | "merchant_only" | "both";

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
  contact_phone?: string | null;
  working_hours_text?: string | null;
  config_override?: {
    reminder_preference?: ReminderPref;
    messages?: {
      welcome?: string;
      whatsapp_greeting?: string;
      confirmation?: string;
      reminder_24h?: string;
      [key: string]: unknown;
    };
    opening_message?: string;
    slot_duration_minutes?: number;
    advance_booking_days?: number;
    cancellation_hours?: number;
    [key: string]: unknown;
  };
}

interface BlockedDate {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface ReviewData {
  avgRating: number;
  totalCount: number;
  reviews: Array<{ id: string; rating: number; comment: string | null; created_at: string }>;
}

interface OpsAlert {
  id: string;
  type: "delay" | "cancellation" | "no_show" | "system";
  severity: "low" | "medium" | "high";
  customer_phone: string | null;
  message: string;
  status: "open" | "resolved";
  created_at: string;
}

type DashboardView = "overview" | "appointments" | "settings";

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const APPOINTMENTS_POLL_MS = 30000;
const OPS_ALERTS_POLL_MS = 60000;
const COMMAND_CENTER_POLL_MS = 120000;
const STAGGER_DELAY_MS = 120; // İlk yüklemede paralel istekleri dağıtmak için

function getWeekDates(anchor: Date): string[] {
  const dates: string[] = [];
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

function groupByDate(apts: Appointment[]): Record<string, Appointment[]> {
  const grouped = group(apts, (a) => new Date(a.slot_start).toISOString().split("T")[0] as string);
  const result: Record<string, Appointment[]> = {};
  for (const k of Object.keys(grouped)) {
    const arr = grouped[k] ?? [];
    result[k] = sort(arr, (a) => new Date(a.slot_start).getTime());
  }
  return result;
}

/** Slug'ı okunabilir etiket metnine çevirir (örn. sac-kesimi → Saç kesimi) */
function slugToLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getAppointmentServiceLabel(apt: Appointment): string {
  const extra = apt.extra_data as { service_name?: string; service_label?: string } | undefined;
  if (extra?.service_name) return extra.service_name;
  if (extra?.service_label) return extra.service_label;
  if (apt.service_slug) return slugToLabel(apt.service_slug);
  return "Randevu";
}

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
  const [reduceMotion, setReduceMotion] = useState(false);
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

  const { scrollY } = useScroll();
  const headerY = useTransform(scrollY, [0, 120], [0, -12]);
  const headerShadow = useTransform(
    scrollY,
    [0, 80],
    ["0 1px 3px 0 rgb(0 0 0 / 0.05)", "0 4px 12px -2px rgb(0 0 0 / 0.08)"]
  );

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1024px), (hover: none), (pointer: coarse)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const tenantId = resolvedParams?.tenantId;

  useEffect(() => {
    const co = tenant?.config_override;
    const pref = co?.reminder_preference;
    if (pref) setReminderPref(pref);
    setWelcomeMsg((co?.messages?.welcome as string) || "");
    setWhatsappGreeting((co?.messages?.whatsapp_greeting as string) || "");
    setContactPhone(tenant?.contact_phone ?? "");
    setWorkingHoursText(tenant?.working_hours_text ?? "");
    setOpeningMessage((co?.opening_message as string) || "");
    setConfirmationMessage((co?.messages?.confirmation as string) || "");
    setReminderMessage((co?.messages?.reminder_24h as string) || "");
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
      if (res.ok) setTenant((t) => (t ? { ...t, config_override: { ...t.config_override, reminder_preference: reminderPref } } : t));
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
                  ...t.config_override,
                  messages: { ...t.config_override?.messages, ...msgs },
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
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/blocked-dates`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setBlockedDates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, STAGGER_DELAY_MS);
  return () => {
    clearTimeout(t);
    controller.abort();
  };
}, [tenantId]);

useEffect(() => {
  if (!tenantId) return;
  const controller = new AbortController();
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/reviews`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setReviews(d))
      .catch(() => {});
  }, STAGGER_DELAY_MS * 2);
  return () => {
    clearTimeout(t);
    controller.abort();
  };
}, [tenantId]);

useEffect(() => {
  if (!tenantId) return;
  const controller = new AbortController();
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/availability/slots`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setWorkingHours(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, STAGGER_DELAY_MS * 3);
  return () => {
    clearTimeout(t);
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
    }, STAGGER_DELAY_MS * 4);

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
    }, STAGGER_DELAY_MS * 5);

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
  const todayIso = new Date().toISOString().slice(0, 10);
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
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header — hafif parallax + gölge scroll ile artar */}
      <motion.header
        style={reduceMotion ? undefined : { y: headerY, boxShadow: headerShadow }}
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
              <motion.button
                type="button"
                onClick={() => setShowWhatsAppModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Bağlantısı
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setShowQRModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700 sm:w-auto"
              >
                <span className="text-base">📷</span> QR Kod
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  setActiveView("appointments");
                  setAddDate("");
                  setAddTime("");
                  setAddPhone("");
                  setAddStaffId("");
                  setShowAdd(true);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900 sm:w-auto"
              >
                <span className="text-lg">+</span> Randevu Ekle
              </motion.button>
            </div>
          </div>
          {/* Mini stats - Geliştirilmiş */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Bugün</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{todayCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">randevu</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">14 Gün</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{weekCount}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">randevu</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Aylık</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {commandCenter?.kpis.monthly_appointments || 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">randevu</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Doluluk</span>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                %{commandCenter?.kpis.fill_rate_pct.toFixed(0) || 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">oranı</p>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-8">
        <ScrollReveal variant="fadeUp" delay={0} as="section" className="mb-6">
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
          <>
        <ScrollReveal variant="fadeUp" delay={0} as="section" className="mb-6">
          <CommandCenterSection
            commandCenter={commandCenter}
            loading={commandCenterLoading}
            runningActionId={runningActionId}
            onRunAction={runCommandAction}
          />
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.08} as="section" className="mb-6">
        <section className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-white to-red-50/30 p-5 shadow-lg dark:border-red-900/50 dark:from-slate-900 dark:to-red-950/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-red-900 dark:text-red-200">
                <AlertCircle className="h-5 w-5" />
                Önemli Bildirimler
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {opsAlerts.length > 0
                  ? `${opsAlerts.length} açık bildirim`
                  : "Açık bildirim yok"}
              </p>
            </div>
            {opsAlertsLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yenileniyor…
              </div>
            )}
          </div>
          {opsAlerts.length === 0 ? (
            <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 p-6 text-center dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-800">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">Açık bildirim yok</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Şu an takip edilmesi gereken bir konu görünmüyor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opsAlerts.map((alert, idx) => {
                const severityStyles = {
                  high: "from-red-50 to-red-100 border-red-300 text-red-900 dark:from-red-900/40 dark:to-red-800/40 dark:border-red-800 dark:text-red-200",
                  medium: "from-amber-50 to-amber-100 border-amber-300 text-amber-900 dark:from-amber-900/40 dark:to-amber-800/40 dark:border-amber-700 dark:text-amber-200",
                  low: "from-blue-50 to-blue-100 border-blue-300 text-blue-900 dark:from-blue-900/40 dark:to-blue-800/40 dark:border-blue-700 dark:text-blue-200",
                };
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-xl border-2 bg-gradient-to-r ${severityStyles[alert.severity]} px-4 py-3 shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold">{alert.message}</p>
                            <p className="mt-1.5 flex items-center gap-2 text-xs opacity-80">
                              <Clock className="h-3 w-3" />
                              {new Date(alert.created_at).toLocaleString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {alert.customer_phone && (
                                <>
                                  <span>•</span>
                                  <span>{alert.customer_phone}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      <motion.button
                        type="button"
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={resolvingAlertId === alert.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:shadow-md disabled:opacity-50 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {resolvingAlertId === alert.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Kapanıyor…
                          </span>
                        ) : (
                          "Kapat"
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
        </ScrollReveal>
        </>
        )}

        {activeView === "settings" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-8 space-y-6"
        >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-blue-50/30 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-blue-950/20"
        >
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <span className="text-xl">🔔</span> Hatırlatma Ayarları
          </h3>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Her sabah 08:00&apos;da yarınki randevular için kimlere mesaj gitsin?
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={reminderPref}
              onChange={(e) => setReminderPref(e.target.value as ReminderPref)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="off">Kapalı (kimseye gitmesin)</option>
              <option value="customer_only">Sadece müşteriye</option>
              <option value="merchant_only">Sadece bana (dashboard’da görürüm)</option>
              <option value="both">İkisine de (müşteriye + bana)</option>
            </select>
            <motion.button
              type="button"
              onClick={handleSaveReminderPref}
              disabled={reminderSaving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50 dark:from-slate-200 dark:to-slate-100 dark:text-slate-900 dark:hover:from-slate-100 dark:hover:to-slate-200"
            >
              {reminderSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor…
                </span>
              ) : (
                "Kaydet"
              )}
            </motion.button>
          </div>
        </motion.div>

        <MessageSettings
          welcomeMsg={welcomeMsg}
          whatsappGreeting={whatsappGreeting}
          onWelcomeChange={setWelcomeMsg}
          onWhatsappGreetingChange={setWhatsappGreeting}
          onSave={handleSaveMessages}
          saving={messagesSaving}
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-indigo-50/30 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-indigo-950/20"
        >
          <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <span className="text-xl">🤖</span> Bot Ayarları
          </h3>
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            İşletme tipine göre bot davranışını buradan özelleştirebilirsiniz. Boş bırakılan alanlar varsayılan değeri kullanır.
          </p>
          {botSettingsError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
              {botSettingsError}
            </div>
          )}
          {botSettingsMessage && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              {botSettingsMessage}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">İletişim Telefonu</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="İnsan yönlendirme mesajında gösterilir"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Çalışma Saatleri Metni</label>
              <input
                type="text"
                value={workingHoursText}
                onChange={(e) => setWorkingHoursText(e.target.value)}
                placeholder="Örn: Hafta içi 09:00-18:00"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Açılış Mesajı</label>
              <input
                type="text"
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                placeholder="Müşteri ilk yazdığında gönderilen mesaj"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Randevu Onay Mesajı</label>
              <input
                type="text"
                value={confirmationMessage}
                onChange={(e) => setConfirmationMessage(e.target.value)}
                placeholder="Randevu alındığında gönderilen mesaj. {date}, {time} kullanabilirsiniz"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Hatırlatma Mesajı (24 saat önce)</label>
              <input
                type="text"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="Yarın randevu hatırlatması. {time} kullanabilirsiniz"
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Slot Süresi (dk)</label>
                <select
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={30}>30 dakika</option>
                  <option value={45}>45 dakika</option>
                  <option value={60}>60 dakika</option>
                  <option value={90}>90 dakika</option>
                  <option value={120}>120 dakika</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Kaç Gün Önceden Randevu</label>
                <select
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={7}>7 gün</option>
                  <option value={14}>14 gün</option>
                  <option value={30}>30 gün</option>
                  <option value={60}>60 gün</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">İptal Süresi (saat)</label>
                <select
                  value={cancellationHours}
                  onChange={(e) => setCancellationHours(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={1}>1 saat</option>
                  <option value={2}>2 saat</option>
                  <option value={4}>4 saat</option>
                  <option value={24}>24 saat</option>
                  <option value={48}>48 saat</option>
                </select>
              </div>
            </div>
              <motion.button
                type="button"
                onClick={handleSaveBotSettings}
                disabled={botSettingsSaving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50 dark:from-slate-200 dark:to-slate-100 dark:text-slate-900 dark:hover:from-slate-100 dark:hover:to-slate-200"
              >
                {botSettingsSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Kaydediliyor…
                  </span>
                ) : (
                  "Bot Ayarlarını Kaydet"
                )}
              </motion.button>
          </div>
        </motion.div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">🕐 Çalışma saatleri</h3>
            <button
              type="button"
              onClick={() => {
                if (!showWorkingHours && workingHours.length === 0) {
                  setWorkingHours(
                    [1, 2, 3, 4, 5].map((dow) => ({
                      day_of_week: dow,
                      start_time: "09:00",
                      end_time: "18:00",
                      day_name: DAY_NAMES[dow],
                    }))
                  );
                }
                setShowWorkingHours(!showWorkingHours);
              }}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-emerald-600 shadow-sm transition hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            >
              {showWorkingHours ? "Kapat" : workingHours.length ? "Düzenle" : "Ayarla"}
            </button>
          </div>
          {showWorkingHours ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                const slot = workingHours.find((s) => s.day_of_week === dow) ?? {
                  day_of_week: dow,
                  start_time: "",
                  end_time: "",
                  day_name: DAY_NAMES[dow],
                };
                return (
                  <div key={dow} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:flex sm:items-center sm:gap-2 sm:border-0 sm:p-0">
                    <div className="mb-2 text-sm font-medium text-slate-700 sm:mb-0 sm:w-20 sm:text-slate-600 dark:text-slate-300">
                      {DAY_NAMES[dow]}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => {
                          const arr = [...workingHours];
                          const idx = arr.findIndex((s) => s.day_of_week === dow);
                          if (idx >= 0) arr[idx] = { ...arr[idx], start_time: e.target.value };
                          else arr.push({ day_of_week: dow, start_time: e.target.value, end_time: slot.end_time || "18:00" });
                          setWorkingHours(arr);
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => {
                          const arr = [...workingHours];
                          const idx = arr.findIndex((s) => s.day_of_week === dow);
                          if (idx >= 0) arr[idx] = { ...arr[idx], end_time: e.target.value };
                          else arr.push({ day_of_week: dow, start_time: slot.start_time || "09:00", end_time: e.target.value });
                          setWorkingHours(arr);
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleSaveWorkingHours}
                disabled={workingHoursSaving}
                className="mt-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                {workingHoursSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          ) : workingHours.length > 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {workingHours.map((s) => `${s.day_name} ${s.start_time}–${s.end_time}`).join(" · ")}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Çalışma saatleri tanımlanmadı. Randevu almak için ayarlayın.</p>
          )}
        </div>

        </motion.div>
        )}

        {/* Haftalık randevu grafiği */}
        {activeView === "overview" && appointments.length > 0 && (
          <ScrollReveal variant="fadeUp" delay={0.02} as="section" className="mb-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Haftalık Randevu Özeti
              </h3>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                Son 7 günün randevu dağılımı
              </p>
              <ChartBar
                data={weekDates.slice(0, 7).map((dateStr) => {
                  const d = new Date(dateStr + "T12:00:00");
                  return {
                    gün: DAY_NAMES[d.getDay()],
                    Randevu: grouped[dateStr]?.length ?? 0,
                  };
                })}
                xKey="gün"
                bars="Randevu"
                colors="emerald"
                height={280}
              />
            </section>
          </ScrollReveal>
        )}

        {activeView === "appointments" && (
          <>
        {/* Haftalık takvim - defter temalı */}
        <ScrollReveal variant="fadeUp" delay={0.05} as="section" className="mb-6">
        <section className="defter-takvim">
          <div className="defter-takvim-baslik">
            <h3 className="font-serif text-[15px] font-semibold text-amber-900/70 dark:text-amber-200/70">Sayfa Seç</h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-50/40 px-3 py-1.5 font-serif text-sm font-medium text-amber-800/60 shadow-sm transition hover:bg-amber-100/50 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300/60 dark:hover:bg-amber-800/30"
              >
                ← Önceki
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(new Date())}
                className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-50/40 px-3 py-1.5 font-serif text-sm font-medium text-amber-800/60 shadow-sm transition hover:bg-amber-100/50 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300/60 dark:hover:bg-amber-800/30"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="shrink-0 rounded-lg border border-amber-300/40 bg-amber-50/40 px-3 py-1.5 font-serif text-sm font-medium text-amber-800/60 shadow-sm transition hover:bg-amber-100/50 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300/60 dark:hover:bg-amber-800/30"
              >
                Sonraki →
              </button>
            </div>
          </div>
          <div className="defter-takvim-grid">
            {weekDates.map((dateStr, idx) => {
              const d = new Date(dateStr + "T12:00:00");
              const isSelected = selectedDate === dateStr;
              const hasAppts = grouped[dateStr]?.length;
              const isBlocked = blockedDates.some(
                (b) => dateStr >= b.start_date && dateStr <= b.end_date
              );
              const isPast = dateStr < todayIso;
              const isToday = dateStr === todayIso;
              return (
                <motion.button
                  key={dateStr}
                  type="button"
                  onClick={() => !isPast && setSelectedDate(dateStr)}
                  disabled={isPast}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  whileHover={!isPast ? { scale: 1.04 } : {}}
                  whileTap={!isPast ? { scale: 0.96 } : {}}
                  className={`defter-takvim-gun ${
                    isSelected
                      ? "defter-takvim-secili"
                      : isPast
                      ? "defter-takvim-gecmis"
                      : isBlocked
                      ? "defter-takvim-kapali"
                      : isToday
                      ? "defter-takvim-bugun"
                      : "defter-takvim-normal"
                  }`}
                >
                  <span className={`text-xs font-semibold ${isSelected ? "text-white/80" : "opacity-60"}`}>
                    {DAY_NAMES[d.getDay()]}
                  </span>
                  <span className={`mt-0.5 font-serif text-lg font-bold ${isSelected ? "text-white" : ""}`}>
                    {d.getDate()}
                  </span>
                  {hasAppts ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-amber-700/80 text-white dark:bg-amber-500/80"
                      }`}
                    >
                      {hasAppts}
                    </motion.span>
                  ) : null}
                  {isToday && !isSelected && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#faf7f0] dark:ring-[#1a1510]" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>
        </ScrollReveal>

        {selectedDate && (
          <ScrollReveal variant="slideLeft" delay={0} as="section" className="mb-6">
          <section className="defter-takvim" style={{ borderRadius: "2px 10px 10px 2px" }}>
            <div className="defter-takvim-baslik">
              <h3 className="font-serif text-[15px] font-semibold capitalize text-amber-900/70 dark:text-amber-200/70">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
            </div>
            <div className="p-4">
            {availabilityLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-amber-800/30" />
                <p className="mt-3 font-serif text-sm text-amber-800/40">Müsaitlik kontrol ediliyor...</p>
              </div>
            ) : availability?.blocked ? (
              <div className="rounded-lg border border-amber-300/30 bg-amber-50/30 py-6 text-center dark:border-amber-700/30 dark:bg-amber-900/10">
                <XCircle className="mx-auto h-8 w-8 text-amber-600/50 dark:text-amber-400/50" />
                <p className="mt-3 font-serif text-sm font-semibold text-amber-900/60 dark:text-amber-200/60">Bu gün kapalı</p>
                <p className="mt-1 font-serif text-xs text-amber-700/50 dark:text-amber-300/50">Tatil veya izin günü</p>
              </div>
            ) : availability?.noSchedule ? (
              <div className="rounded-lg border border-amber-300/20 bg-amber-50/20 py-6 text-center dark:border-amber-700/20 dark:bg-amber-900/10">
                <Clock className="mx-auto h-8 w-8 text-amber-800/30 dark:text-amber-400/30" />
                <p className="mt-3 font-serif text-sm font-semibold text-amber-900/50 dark:text-amber-200/50">Çalışma saati tanımlı değil</p>
                <p className="mt-1 font-serif text-xs text-amber-800/40 dark:text-amber-300/40">Ayarlardan çalışma saatlerini tanımlayın</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availability?.available && availability.available.length > 0 && (
                  <div>
                    <p className="mb-2 font-serif text-xs font-semibold text-emerald-700/70 dark:text-emerald-400/70">
                      Müsait Saatler ({availability.available.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availability.available.map((time) => (
                        <motion.button
                          key={time}
                          type="button"
                          onClick={() => handleSlotClick(selectedDate, time)}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="rounded-lg border border-emerald-300/40 bg-emerald-50/40 px-4 py-2.5 font-mono text-sm font-semibold text-emerald-800/80 transition hover:border-emerald-400/60 hover:bg-emerald-50/60 dark:border-emerald-700/30 dark:bg-emerald-900/15 dark:text-emerald-300/80 dark:hover:bg-emerald-900/25"
                        >
                          {time}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
                {availability?.booked && availability.booked.length > 0 && (
                  <div>
                    <p className="mb-2 font-serif text-xs font-semibold text-amber-800/50 dark:text-amber-400/50">
                      Dolu Saatler ({availability.booked.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availability.booked.map((b) => (
                        <div
                          key={b.time + (b.id ?? "")}
                          className="rounded-lg border border-amber-300/25 bg-amber-50/25 px-4 py-2.5 text-sm dark:border-amber-700/20 dark:bg-amber-900/10"
                        >
                          <span className="font-mono font-semibold text-amber-900/60 dark:text-amber-200/60">{b.time}</span>
                          {b.customer_phone && (
                            <span className="ml-2 font-serif text-xs text-amber-800/40 dark:text-amber-300/40">– {b.customer_phone}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!availability?.available || availability.available.length === 0) &&
                  (!availability?.booked || availability.booked.length === 0) && (
                    <div className="rounded-lg border border-amber-300/15 bg-amber-50/15 py-6 text-center dark:border-amber-700/15 dark:bg-amber-900/10">
                      <p className="font-serif text-sm text-amber-800/40 dark:text-amber-300/40">Bu gün için müsait saat bulunmuyor</p>
                    </div>
                  )}
              </div>
            )}
            </div>
          </section>
          </ScrollReveal>
        )}

        {showAdd && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleAddAppointment}
            className="mb-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 p-6 shadow-lg dark:border-emerald-800 dark:from-slate-900 dark:to-emerald-950/30"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {addDate && addTime
                  ? `Randevu Ekle — ${new Date(addDate + "T12:00:00").toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    })} saat ${addTime}`
                  : "Yeni Randevu Ekle"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddDate("");
                  setAddTime("");
                  setAddDatetimeLocal("");
                  setAddPhone("");
                  setAddStaffId("");
                }}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {!addDate || !addTime ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tarih ve Saat
                  </label>
                  <input
                    type="datetime-local"
                    value={addDatetimeLocal}
                    onChange={(e) => setAddDatetimeLocal(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    required={!addDate || !addTime}
                  />
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/30">
                  <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">
                      {new Date(addDate + "T12:00:00").toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        weekday: "long",
                      })}
                    </span>
                    <span className="mx-2">•</span>
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{addTime}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAddDate("");
                        setAddTime("");
                        setAddDatetimeLocal("");
                      }}
                      className="ml-auto text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      Değiştir
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Müşteri Telefonu
                </label>
                <input
                  type="tel"
                  placeholder="05XX XXX XX XX"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  required
                />
              </div>
              {staffPreferenceEnabled && staffOptions.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Personel (opsiyonel)
                  </label>
                  <select
                    value={addStaffId}
                    onChange={(e) => setAddStaffId(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">Otomatik atama</option>
                    {staffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
                >
                  Randevuyu Ekle
                </motion.button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setAddDate("");
                    setAddTime("");
                    setAddDatetimeLocal("");
                    setAddPhone("");
                    setAddStaffId("");
                  }}
                  className="rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  İptal
                </button>
              </div>
            </div>
          </motion.form>
        )}

        {/* Randevu Defteri */}
        <ScrollReveal variant="fadeUp" delay={0.1} as="section" className="mb-6">
          <AppointmentBook
            grouped={grouped}
            sortedDates={sortedDates}
            todayIso={todayIso}
            loading={loading}
            weekCount={weekCount}
            updatingAptId={updatingAptId}
            onUpdateStatus={updateAppointmentStatus}
            getServiceLabel={getAppointmentServiceLabel}
            tenantId={tenantId}
          />
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.06} as="section" className="mt-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">🏖️ Tatil / İzin Günleri</h3>
          {blockedDates.length > 0 && (
            <ul className="mb-4 space-y-2">
              {blockedDates.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <span>
                    {b.start_date} – {b.end_date}
                    {b.reason && ` (${b.reason})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlocked(b.id)}
                    className="rounded-lg px-2 py-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-800/50 dark:hover:text-amber-200"
                  >
                    Sil
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showBlocked ? (
            <button
              type="button"
              onClick={() => setShowBlocked(true)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              + İzin ekle
            </button>
          ) : (
            <form onSubmit={handleAddBlocked} className="flex flex-wrap items-end gap-3">
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
                required
              />
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
                required
              />
              <input
                type="text"
                placeholder="Sebep (opsiyonel)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 sm:flex-1"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 sm:w-auto"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => setShowBlocked(false)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:w-auto"
              >
                İptal
              </button>
            </form>
          )}
        </section>
        </ScrollReveal>
          </>
        )}

        {activeView === "overview" && reviews && (
          <ScrollReveal variant="scale" delay={0} as="section" className="mt-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">⭐ Değerlendirmeler</h3>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Ortalama: <span className="font-semibold text-amber-600 dark:text-amber-400">{reviews.avgRating} ⭐</span> ({reviews.totalCount} yorum)
            </p>
            {reviews.reviews.length > 0 && (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {reviews.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm dark:bg-slate-800/60">
                    <span className="text-amber-600 dark:text-amber-400">{r.rating} ⭐</span>
                    {r.comment && <span className="ml-2 text-slate-700 dark:text-slate-300">– {r.comment}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          </ScrollReveal>
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
    </MotionConfig>
  );
}
