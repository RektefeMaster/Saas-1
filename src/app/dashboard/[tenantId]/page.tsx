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
  config_override?: { reminder_preference?: ReminderPref };
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
    const pref = (tenant?.config_override as { reminder_preference?: ReminderPref })?.reminder_preference;
    if (pref) setReminderPref(pref);
  }, [tenant?.config_override]);

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

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{tenant?.name || "Takvim"}</h1>
            <p className="text-sm text-zinc-500">Kod: {tenant?.tenant_code}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`${baseUrl}/api/tenant/${tenantId}/link`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              WhatsApp Link
            </a>
            <a
              href={`${baseUrl}/api/tenant/${tenantId}/qr?format=png`}
              download={`${tenant?.tenant_code || "qr"}-qr.png`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              QR Kod (PNG)
            </a>
            <button
              onClick={() => {
                setAddDate("");
                setAddTime("");
                setAddPhone("");
                setShowAdd(true);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + Randevu Ekle
            </button>
          </div>
        </header>

        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-medium text-zinc-900">Hatırlatma (yarınki randevular)</h3>
          <p className="mb-3 text-sm text-zinc-600">
            Her sabah 08:00&apos;da yarınki randevular için kimlere mesaj gitsin?
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={reminderPref}
              onChange={(e) => setReminderPref(e.target.value as ReminderPref)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
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

        {/* Çalışma saatleri */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium text-zinc-900">Çalışma saatleri</h3>
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
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
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
                    <span className="w-20 text-sm text-zinc-600">{DAY_NAMES[dow]}</span>
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
                      className="rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <span className="text-zinc-400">–</span>
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
                      className="rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                  </div>
                );
              })}
              <button
                type="button"
                onClick={handleSaveWorkingHours}
                disabled={workingHoursSaving}
                className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {workingHoursSaving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          ) : workingHours.length > 0 ? (
            <p className="text-sm text-zinc-600">
              {workingHours.map((s) => `${s.day_name} ${s.start_time}–${s.end_time}`).join(" · ")}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Çalışma saatleri tanımlanmadı. Randevu almak için ayarlayın.</p>
          )}
        </div>

        {/* Haftalık takvim */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-zinc-900">Tarih seç</h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor(new Date())}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={() => setWeekAnchor((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                  className={`flex flex-col items-center rounded-lg px-1 py-2 text-sm transition ${
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : isPast
                      ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                      : isBlocked
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : "bg-zinc-100 text-zinc-800 hover:bg-emerald-100 hover:text-emerald-800"
                  }`}
                >
                  <span className="text-xs">{DAY_NAMES[d.getDay()]}</span>
                  <span className="font-medium">{d.getDate()}</span>
                  {hasAppts && (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-emerald-500" title={`${hasAppts} randevu`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seçilen güne ait dolu/boş saatler */}
        {selectedDate && (
          <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-medium text-zinc-900">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            {availabilityLoading ? (
              <div className="py-8 text-center text-zinc-500">Yükleniyor...</div>
            ) : availability?.blocked ? (
              <p className="rounded-lg bg-amber-50 py-4 text-center text-sm text-amber-800">Bu gün kapalı (tatil/izin)</p>
            ) : availability?.noSchedule ? (
              <p className="rounded-lg bg-zinc-100 py-4 text-center text-sm text-zinc-600">Çalışma saati tanımlı değil</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availability?.available?.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleSlotClick(selectedDate, time)}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                  >
                    {time} <span className="text-emerald-600">boş</span>
                  </button>
                ))}
                {availability?.booked?.map((b) => (
                  <div
                    key={b.time + (b.id ?? "")}
                    className="rounded-lg bg-zinc-200 px-3 py-2 text-sm text-zinc-700"
                  >
                    {b.time} <span className="font-medium text-zinc-900">dolu</span> – {b.customer_phone}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Randevu ekle formu */}
        {showAdd && (
          <form
            onSubmit={handleAddAppointment}
            className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h3 className="mb-3 font-medium text-zinc-900">
              {addDate && addTime
                ? `Randevu ekle — ${new Date(addDate + "T12:00:00").toLocaleDateString("tr-TR")} saat ${addTime}`
                : "Randevu ekle"}
            </h3>
            <div className="flex flex-wrap gap-3">
              {!addDate || !addTime ? (
                <input
                  type="datetime-local"
                  value={addDatetimeLocal}
                  onChange={(e) => setAddDatetimeLocal(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                  required={!addDate || !addTime}
                />
              ) : null}
              <input
                type="tel"
                placeholder="Müşteri telefonu"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                required
              />
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
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
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                İptal
              </button>
            </div>
          </form>
        )}

        {/* Randevu listesi (özet) */}
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <h3 className="border-b border-zinc-100 p-4 font-medium text-zinc-900">Yaklaşan randevular</h3>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Yükleniyor...</div>
          ) : sortedDates.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">Henüz randevu yok</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {sortedDates.map((date) => (
                <div key={date} className="p-4">
                  <div className="mb-2 text-sm font-medium text-zinc-500">
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
                      return (
                        <div
                          key={apt.id}
                          className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800"
                        >
                          <span className="font-medium">{time}</span> – {apt.customer_phone}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-medium text-zinc-900">Tatil / İzin Günleri</h3>
          {blockedDates.length > 0 && (
            <ul className="mb-3 space-y-2">
              {blockedDates.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span>
                    {b.start_date} – {b.end_date}
                    {b.reason && ` (${b.reason})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBlocked(b.id)}
                    className="text-amber-600 hover:text-amber-800"
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
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              + İzin ekle
            </button>
          ) : (
            <form onSubmit={handleAddBlocked} className="flex flex-wrap gap-2">
              <input
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                required
              />
              <input
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                required
              />
              <input
                type="text"
                placeholder="Sebep (opsiyonel)"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => setShowBlocked(false)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
              >
                İptal
              </button>
            </form>
          )}
        </div>

        {reviews && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-medium text-zinc-900">Değerlendirmeler</h3>
            <p className="mb-2 text-sm text-zinc-600">
              Ortalama: <span className="font-semibold text-amber-600">{reviews.avgRating} ⭐</span> ({reviews.totalCount} yorum)
            </p>
            {reviews.reviews.length > 0 && (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {reviews.reviews.map((r) => (
                  <li key={r.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                    <span className="text-amber-600">{r.rating} ⭐</span>
                    {r.comment && <span className="ml-2 text-zinc-700">– {r.comment}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
