"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  customer_phone: string;
  slot_start: string;
  status: string;
  service_slug: string | null;
  extra_data: Record<string, unknown>;
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
  const [addSlot, setAddSlot] = useState("");
  const [showBlocked, setShowBlocked] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [reminderPref, setReminderPref] = useState<ReminderPref>("customer_only");
  const [reminderSaving, setReminderSaving] = useState(false);

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

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !addPhone || !addSlot) return;
    const slotStart = addSlot.includes("T") ? addSlot : `${addSlot}:00`;
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
      setAddSlot("");
      setShowAdd(false);
      const data = await res.json();
      setAppointments((prev) => [...prev, data]);
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
              onClick={() => setShowAdd(!showAdd)}
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

        {showAdd && (
          <form
            onSubmit={handleAddAppointment}
            className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <h3 className="mb-3 font-medium text-zinc-900">Kapıdan giren müşteri</h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="tel"
                placeholder="Telefon"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                required
              />
              <input
                type="datetime-local"
                value={addSlot}
                onChange={(e) => setAddSlot(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                required
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Ekle
              </button>
            </div>
          </form>
        )}

        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
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
