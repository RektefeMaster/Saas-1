"use client";

import React, { memo, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { DAY_NAMES, type ReminderPref, type WorkingHoursSlot } from "./dashboard.types";
import type { TenantBasic } from "@/app/dashboard/DashboardTenantContext";

const MessageSettings = dynamic(
  () => import("./MessageSettings").then((m) => ({ default: m.MessageSettings })),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

export interface SettingsViewProps {
  tenantId: string;
  tenant: TenantBasic | null;
  setTenant: React.Dispatch<React.SetStateAction<TenantBasic | null>>;
  onWorkingHoursSaved?: () => void;
}

function SettingsViewInner({ tenantId, tenant, setTenant, onWorkingHoursSaved }: SettingsViewProps) {
  const [reminderPref, setReminderPref] = useState<ReminderPref>("customer_only");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [whatsappGreeting, setWhatsappGreeting] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [workingHoursText, setWorkingHoursText] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
  const [cancellationHours, setCancellationHours] = useState(2);
  const [workingHours, setWorkingHours] = useState<WorkingHoursSlot[]>([]);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [messagesSaving, setMessagesSaving] = useState(false);
  const [workingHoursSaving, setWorkingHoursSaving] = useState(false);
  const [botSettingsSaving, setBotSettingsSaving] = useState(false);
  const [botSettingsMessage, setBotSettingsMessage] = useState("");
  const [botSettingsError, setBotSettingsError] = useState("");

  useEffect(() => {
    if (!tenant) return;
    const co = tenant.config_override as Record<string, unknown> | undefined;
    const pref = co?.reminder_preference;
    if (pref && ["off", "customer_only", "merchant_only", "both"].includes(String(pref))) {
      setReminderPref(pref as ReminderPref);
    }
    const msgs = (co?.messages as Record<string, unknown> | undefined) ?? {};
    setWelcomeMsg(String(msgs.welcome ?? ""));
    setWhatsappGreeting(String(msgs.whatsapp_greeting ?? ""));
    setContactPhone(tenant.contact_phone ?? "");
    setWorkingHoursText(tenant.working_hours_text ?? "");
    setOpeningMessage(String(co?.opening_message ?? ""));
    setConfirmationMessage(String(msgs.confirmation ?? ""));
    setReminderMessage(String(msgs.reminder_24h ?? ""));
    if (typeof co?.slot_duration_minutes === "number") setSlotDuration(co.slot_duration_minutes);
    if (typeof co?.advance_booking_days === "number") setAdvanceBookingDays(co.advance_booking_days);
    if (typeof co?.cancellation_hours === "number") setCancellationHours(co.cancellation_hours);
  }, [tenant?.id, tenant?.config_override, tenant?.contact_phone, tenant?.working_hours_text]);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    fetch(`/api/tenant/${tenantId}/availability/slots`)
      .then((r) => r.json())
      .then((d) => active && setWorkingHours(Array.isArray(d) ? d : []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [tenantId]);

  const handleSaveReminderPref = useCallback(async () => {
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
  }, [tenantId, reminderPref, setTenant]);

  const handleSaveMessages = useCallback(async () => {
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
  }, [tenantId, welcomeMsg, whatsappGreeting, setTenant]);

  const handleSaveBotSettings = useCallback(async () => {
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
  }, [
    tenantId,
    contactPhone,
    workingHoursText,
    openingMessage,
    slotDuration,
    advanceBookingDays,
    cancellationHours,
    confirmationMessage,
    reminderMessage,
    setTenant,
  ]);

  const handleSaveWorkingHours = useCallback(async () => {
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
        onWorkingHoursSaved?.();
      }
    } finally {
      setWorkingHoursSaving(false);
    }
  }, [tenantId, workingHours, onWorkingHoursSaved]);

  return (
    <div className="mb-8 space-y-6">
      <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-blue-50/30 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-blue-950/20">
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
            <option value="merchant_only">Sadece bana (dashboard&apos;da görürüm)</option>
            <option value="both">İkisine de (müşteriye + bana)</option>
          </select>
          <button
            type="button"
            onClick={handleSaveReminderPref}
            disabled={reminderSaving}
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
          </button>
        </div>
      </div>

      <MessageSettings
        welcomeMsg={welcomeMsg}
        whatsappGreeting={whatsappGreeting}
        onWelcomeChange={setWelcomeMsg}
        onWhatsappGreetingChange={setWhatsappGreeting}
        onSave={handleSaveMessages}
        saving={messagesSaving}
      />

      <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-indigo-50/30 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900 dark:to-indigo-950/20">
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
          <button
            type="button"
            onClick={handleSaveBotSettings}
            disabled={botSettingsSaving}
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
          </button>
        </div>
      </div>

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
    </div>
  );
}

export const SettingsView = memo(SettingsViewInner);
