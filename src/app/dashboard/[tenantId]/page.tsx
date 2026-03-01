"use client";

import { useEffect, useState, useCallback } from "react";

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

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

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

export default function EsnafDashboard({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ tenantId: string } | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addPhone, setAddPhone] = useState("");
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
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!tenantId) return;

    const fetchTenant = async () => {
      const res = await fetch(`${baseUrl}/api/tenant/${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setTenant(data);
      }
    };
    fetchTenant();
  }, [tenantId, baseUrl]);

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
      const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/settings`, {
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
      const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/settings`, {
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
      const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/settings`, {
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

    const fetchAppointments = async () => {
      const now = new Date();
      const from = now.toISOString().split("T")[0];
      const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const res = await fetch(
        `${baseUrl}/api/tenant/${tenantId}/appointments?from=${from}T00:00:00&to=${to}T23:59:59`
      );
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
      setLoading(false);
    };

    fetchAppointments();
    const interval = setInterval(fetchAppointments, 3000);
    return () => clearInterval(interval);
  }, [tenantId, baseUrl]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`${baseUrl}/api/tenant/${tenantId}/blocked-dates`)
      .then((r) => r.json())
      .then((d) => setBlockedDates(Array.isArray(d) ? d : []));
  }, [tenantId, baseUrl]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`${baseUrl}/api/tenant/${tenantId}/reviews`)
      .then((r) => r.json())
      .then((d) => setReviews(d));
  }, [tenantId, baseUrl]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`${baseUrl}/api/tenant/${tenantId}/availability/slots`)
      .then((r) => r.json())
      .then((d) => setWorkingHours(Array.isArray(d) ? d : []));
  }, [tenantId, baseUrl]);

  const fetchAvailability = useCallback(
    async (dateStr: string) => {
      if (!tenantId) return;
      setAvailabilityLoading(true);
      try {
        const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/availability?date=${dateStr}`);
        const data = await res.json();
        setAvailability(data);
      } finally {
        setAvailabilityLoading(false);
      }
    },
    [tenantId, baseUrl]
  );

  useEffect(() => {
    if (selectedDate) fetchAvailability(selectedDate);
    else setAvailability(null);
  }, [selectedDate, fetchAvailability]);

  const handleAddBlocked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !blockStart || !blockEnd) return;
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/blocked-dates`, {
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
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/blocked-dates/${blockId}`, {
      method: "DELETE",
    });
    if (res.ok) setBlockedDates((prev) => prev.filter((b) => b.id !== blockId));
  };

  const handleSlotClick = (dateStr: string, timeStr: string) => {
    setAddDate(dateStr);
    setAddTime(timeStr);
    setAddPhone("");
    setShowAdd(true);
  };

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
    const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_phone: addPhone,
        slot_start: slotStart,
      }),
    });
    if (res.ok) {
      setAddPhone("");
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
      const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/availability/slots`, {
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

  const groupByDate = (apts: Appointment[]) => {
    const groups: Record<string, Appointment[]> = {};
    for (const a of apts) {
      const d = new Date(a.slot_start);
      const key = d.toISOString().split("T")[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());
    }
    return groups;
  };

  if (!tenantId) return null;

  const grouped = groupByDate(appointments);
  const sortedDates = Object.keys(grouped).sort();

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = grouped[todayStr]?.length ?? 0;
  const weekCount = sortedDates.reduce((acc, d) => acc + (grouped[d]?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {tenant?.name || "Randevu Paneli"}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-slate-500">Kod:</span>
                <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-medium text-slate-700">
                  {tenant?.tenant_code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Kodu kopyala"
                >
                  {codeCopied ? "✓ Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`${baseUrl}/api/tenant/${tenantId}/link`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                <span aria-hidden>📱</span> WhatsApp Link
              </a>
              <a
                href={`${baseUrl}/api/tenant/${tenantId}/qr?format=png`}
                download={`${tenant?.tenant_code || "qr"}-qr.png`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <span aria-hidden>📷</span> QR Kod
              </a>
              <button
                type="button"
                onClick={() => {
                  setAddDate("");
                  setAddTime("");
                  setAddPhone("");
                  setShowAdd(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <span aria-hidden>+</span> Randevu Ekle
              </button>
            </div>
          </div>
          {/* Mini stats */}
          <div className="mt-4 flex gap-4">
            <div className="rounded-xl bg-slate-100/80 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Bugün</span>
              <p className="text-lg font-bold text-slate-900">{todayCount} randevu</p>
            </div>
            <div className="rounded-xl bg-slate-100/80 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">14 gün</span>
              <p className="text-lg font-bold text-slate-900">{weekCount} randevu</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">

        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowSettingsPanel((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50"
          >
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span aria-hidden>⚙️</span> Ayarlar
            </span>
            <span className="text-sm text-slate-500">{showSettingsPanel ? "Gizle" : "Göster"}</span>
          </button>
        </div>

        {showSettingsPanel && (
        <div className="mb-8 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 font-semibold text-slate-900">🔔 Hatırlatma</h3>
          <p className="mb-4 text-sm text-slate-600">
            Her sabah 08:00&apos;da yarınki randevular için kimlere mesaj gitsin?
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={reminderPref}
              onChange={(e) => setReminderPref(e.target.value as ReminderPref)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="off">Kapalı (kimseye gitmesin)</option>
              <option value="customer_only">Sadece müşteriye</option>
              <option value="merchant_only">Sadece bana (dashboard’da görürüm)</option>
              <option value="both">İkisine de (müşteriye + bana)</option>
            </select>
            <button
              type="button"
              onClick={handleSaveReminderPref}
              disabled={reminderSaving}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {reminderSaving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 font-semibold text-slate-900">💬 Mesaj Ayarları</h3>
          <p className="mb-4 text-sm text-slate-600">
            Müşterilere gönderilen karşılama ve WhatsApp mesajlarını özelleştirin.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Karşılama mesajı
              </label>
              <input
                type="text"
                value={welcomeMsg}
                onChange={(e) => setWelcomeMsg(e.target.value)}
                placeholder="Merhaba! {tenant_name} olarak nasıl yardımcı olabilirim?"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                Müşteri ilk yazdığında gönderilen mesaj. {"{tenant_name}"} yerine işletme adı yazılır.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                WhatsApp link mesajı
              </label>
              <input
                type="text"
                value={whatsappGreeting}
                onChange={(e) => setWhatsappGreeting(e.target.value)}
                placeholder="Merhaba, {tenant_name} için randevu almak istiyorum"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                Müşteri QR kod veya linke tıkladığında WhatsApp&apos;ta hazır görünen mesaj. {"{tenant_name}"} yerine işletme adı yazılır.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveMessages}
              disabled={messagesSaving}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {messagesSaving ? "Kaydediliyor…" : "Mesajları Kaydet"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-1 font-semibold text-slate-900">🤖 Bot Ayarları</h3>
          <p className="mb-4 text-sm text-slate-600">
            İşletme tipine göre bot davranışını buradan özelleştirebilirsiniz. Boş bırakılan alanlar varsayılan değeri kullanır.
          </p>
          {botSettingsError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {botSettingsError}
            </div>
          )}
          {botSettingsMessage && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              {botSettingsMessage}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">İletişim telefonu</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="İnsan yönlendirme mesajında gösterilir"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Çalışma saatleri metni</label>
              <input
                type="text"
                value={workingHoursText}
                onChange={(e) => setWorkingHoursText(e.target.value)}
                placeholder="Örn: Hafta içi 09:00-18:00"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Açılış mesajı</label>
              <input
                type="text"
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                placeholder="Müşteri ilk yazdığında gönderilen mesaj"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Randevu onay mesajı</label>
              <input
                type="text"
                value={confirmationMessage}
                onChange={(e) => setConfirmationMessage(e.target.value)}
                placeholder="Randevu alındığında gönderilen mesaj. {date}, {time} kullanabilirsiniz"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hatırlatma mesajı (24 saat önce)</label>
              <input
                type="text"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                placeholder="Yarın randevu hatırlatması. {time} kullanabilirsiniz"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Slot süresi (dk)</label>
                <select
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                  <option value={60}>60</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Kaç gün önceden randevu</label>
                <select
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">İptal (saat öncesi)</label>
                <select
                  value={cancellationHours}
                  onChange={(e) => setCancellationHours(Number(e.target.value))}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                  <option value={24}>24</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveBotSettings}
              disabled={botSettingsSaving}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {botSettingsSaving ? "Kaydediliyor…" : "Bot Ayarlarını Kaydet"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">🕐 Çalışma saatleri</h3>
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
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-emerald-600 shadow-sm transition hover:bg-emerald-50"
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
                  <div key={dow} className="flex items-center gap-2">
                    <span className="w-20 text-sm text-slate-600">{DAY_NAMES[dow]}</span>
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
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
                    />
                    <span className="text-slate-400">–</span>
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
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleSaveWorkingHours}
                disabled={workingHoursSaving}
                className="mt-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {workingHoursSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          ) : workingHours.length > 0 ? (
            <p className="text-sm text-slate-600">
              {workingHours.map((s) => `${s.day_name} ${s.start_time}–${s.end_time}`).join(" · ")}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Çalışma saatleri tanımlanmadı. Randevu almak için ayarlayın.</p>
          )}
        </div>

        </div>
        )}

        {/* Haftalık takvim */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">📅 Tarih seç</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                ← Önceki
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(new Date())}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Sonraki →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {getWeekDates(weekAnchor).map((dateStr) => {
              const d = new Date(dateStr + "T12:00:00");
              const isSelected = selectedDate === dateStr;
              const hasAppts = grouped[dateStr]?.length;
              const isBlocked = blockedDates.some(
                (b) => dateStr >= b.start_date && dateStr <= b.end_date
              );
              const isPast = dateStr < new Date().toISOString().slice(0, 10);
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  disabled={isPast}
                  className={`flex flex-col items-center rounded-xl px-1 py-3 text-sm font-medium transition ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-md"
                      : isPast
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : isBlocked
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : "bg-slate-100 text-slate-800 hover:bg-emerald-50 hover:text-emerald-800"
                  }`}
                >
                  <span className="text-xs font-medium opacity-80">{DAY_NAMES[d.getDay()]}</span>
                  <span>{d.getDate()}</span>
                  {hasAppts && (
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" title={`${hasAppts} randevu`} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {selectedDate && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold capitalize text-slate-900">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            {availabilityLoading ? (
              <div className="py-8 text-center text-slate-500">Yükleniyor...</div>
            ) : availability?.blocked ? (
              <p className="rounded-xl bg-amber-50 py-4 text-center text-sm font-medium text-amber-800">Bu gün kapalı (tatil/izin)</p>
            ) : availability?.noSchedule ? (
              <p className="rounded-xl bg-slate-100 py-4 text-center text-sm text-slate-600">Çalışma saati tanımlı değil</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availability?.available?.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleSlotClick(selectedDate, time)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                  >
                    {time} <span className="text-emerald-600">boş</span>
                  </button>
                ))}
                {availability?.booked?.map((b) => (
                  <div
                    key={b.time + (b.id ?? "")}
                    className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700"
                  >
                    {b.time} <span className="font-medium text-slate-900">dolu</span> – {b.customer_phone}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {showAdd && (
          <form
            onSubmit={handleAddAppointment}
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="mb-4 font-semibold text-slate-900">
              {addDate && addTime
                ? `Randevu ekle — ${new Date(addDate + "T12:00:00").toLocaleDateString("tr-TR")} saat ${addTime}`
                : "Randevu ekle"}
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              {!addDate || !addTime ? (
                <input
                  type="datetime-local"
                  value={addDatetimeLocal}
                  onChange={(e) => setAddDatetimeLocal(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required={!addDate || !addTime}
                />
              ) : null}
              <input
                type="tel"
                placeholder="Müşteri telefonu"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                Ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setAddDate("");
                  setAddTime("");
                  setAddDatetimeLocal("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </form>
        )}

        {/* Yaklaşan randevular */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h3 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">📋 Yaklaşan randevular</h3>
          {loading ? (
            <div className="p-8 text-center text-slate-500">Yükleniyor...</div>
          ) : sortedDates.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Henüz randevu yok</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedDates.map((date) => (
                <div key={date} className="p-4">
                  <div className="mb-2 text-sm font-medium capitalize text-slate-500">
                    {new Date(date + "T12:00:00").toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {grouped[date].map((apt) => {
                      const time = new Date(apt.slot_start).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const name = (apt.extra_data as { customer_name?: string })?.customer_name;
                      return (
                        <div
                          key={apt.id}
                          className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 shadow-sm"
                        >
                          <div>
                            <span className="font-semibold">{time}</span> – {name || apt.customer_phone}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Bu randevuyu iptal etmek istiyor musunuz?")) return;
                              const res = await fetch(`${baseUrl}/api/tenant/${tenantId}/cancel`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ appointment_id: apt.id, cancelled_by: "tenant" }),
                              });
                              if (res.ok) {
                                setAppointments((prev) => prev.filter((a) => a.id !== apt.id));
                                if (selectedDate) fetchAvailability(selectedDate);
                              }
                            }}
                            className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                            title="İptal et"
                          >
                            İptal
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-900">🏖️ Tatil / İzin Günleri</h3>
          {blockedDates.length > 0 && (
            <ul className="mb-4 space-y-2">
              {blockedDates.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  <span>
                    {b.start_date} – {b.end_date}
                    {b.reason && ` (${b.reason})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlocked(b.id)}
                    className="rounded-lg px-2 py-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-800"
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
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              + İzin ekle
            </button>
          ) : (
            <form onSubmit={handleAddBlocked} className="flex flex-wrap items-end gap-3">
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm"
                required
              />
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm"
                required
              />
              <input
                type="text"
                placeholder="Sebep (opsiyonel)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => setShowBlocked(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                İptal
              </button>
            </form>
          )}
        </section>

        {reviews && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">⭐ Değerlendirmeler</h3>
            <p className="mb-3 text-sm text-slate-600">
              Ortalama: <span className="font-semibold text-amber-600">{reviews.avgRating} ⭐</span> ({reviews.totalCount} yorum)
            </p>
            {reviews.reviews.length > 0 && (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {reviews.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                    <span className="text-amber-600">{r.rating} ⭐</span>
                    {r.comment && <span className="ml-2 text-slate-700">– {r.comment}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
