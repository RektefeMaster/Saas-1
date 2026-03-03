"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BellPlus,
  Loader2,
  Save,
  Search,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";

interface CrmCustomer {
  customer_phone: string;
  customer_name: string | null;
  tags: string[];
  notes_summary: string | null;
  last_visit_at: string | null;
  total_visits: number;
}

interface CrmNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
}

interface CrmReminder {
  id: string;
  customer_phone: string;
  title: string;
  note?: string | null;
  remind_at: string;
  channel: "panel" | "whatsapp" | "both";
  status: "pending" | "sent" | "cancelled";
}

type ReminderFilter = "all" | "pending" | "sent" | "cancelled";

const COPY = {
  tr: {
    title: "Müşteri Defteri",
    subtitle: "Müşteri bilgileri, notlar, etiketler ve hatırlatmaları tek yerden yönetin.",
    back: "Panele Dön",
    search: "Telefon, ad veya etikete göre ara...",
    noCustomers: "Kayıt bulunamadı.",
    selectCustomer: "Soldaki listeden bir müşteri seçin.",
    profile: "Müşteri Kartı",
    notes: "Not Geçmişi",
    reminders: "Hatırlatma Planla",
    upcoming: "Hatırlatma Listesi",
    noNotes: "Henüz not yok.",
    noReminder: "Hatırlatma yok.",
    save: "Kaydet",
    saving: "Kaydediliyor...",
    addNote: "Not Ekle",
    addTag: "Etiket Ekle",
    summary: "Kısa müşteri özeti",
    customerName: "Müşteri adı",
    lastVisit: "Son ziyaret",
    visits: "ziyaret",
    reminderTitle: "Başlık",
    reminderNote: "Not (opsiyonel)",
    remindAt: "Hatırlatma zamanı",
    createReminder: "Hatırlatma Oluştur",
    updating: "Güncelleniyor...",
    sent: "Gönderildi",
    cancel: "İptal Et",
    reopen: "Tekrar Aç",
    statusAll: "Tümü",
    statusPending: "Bekleyen",
    statusSent: "Gönderilen",
    statusCancelled: "İptal Edilen",
    channels: {
      panel: "Sadece panel",
      whatsapp: "Sadece WhatsApp",
      both: "Panel + WhatsApp",
    },
  },
  en: {
    title: "Customer Notebook",
    subtitle: "Manage customer profiles, notes, tags, and reminders in one place.",
    back: "Back to Panel",
    search: "Search by phone, name, or tag...",
    noCustomers: "No records found.",
    selectCustomer: "Select a customer from the list.",
    profile: "Customer Profile",
    notes: "Note History",
    reminders: "Plan Reminder",
    upcoming: "Reminder List",
    noNotes: "No notes yet.",
    noReminder: "No reminders.",
    save: "Save",
    saving: "Saving...",
    addNote: "Add Note",
    addTag: "Add Tag",
    summary: "Short customer summary",
    customerName: "Customer name",
    lastVisit: "Last visit",
    visits: "visits",
    reminderTitle: "Title",
    reminderNote: "Note (optional)",
    remindAt: "Reminder time",
    createReminder: "Create Reminder",
    updating: "Updating...",
    sent: "Sent",
    cancel: "Cancel",
    reopen: "Reopen",
    statusAll: "All",
    statusPending: "Pending",
    statusSent: "Sent",
    statusCancelled: "Cancelled",
    channels: {
      panel: "Panel only",
      whatsapp: "WhatsApp only",
      both: "Panel + WhatsApp",
    },
  },
} as const;

function formatDate(value: string | null, locale: "tr" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CrmPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];

  const [tenantId, setTenantId] = useState("");
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reminders, setReminders] = useState<CrmReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderFilter, setReminderFilter] = useState<ReminderFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [profileForm, setProfileForm] = useState({
    customer_name: "",
    notes_summary: "",
  });
  const [reminderForm, setReminderForm] = useState({
    title: "",
    note: "",
    remind_at: "",
    channel: "both" as "panel" | "whatsapp" | "both",
  });

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const clearMessageLater = useCallback(() => {
    window.setTimeout(() => {
      setInfo("");
      setError("");
    }, 2200);
  }, []);

  const loadCustomers = useCallback(async () => {
    if (!tenantId) return;
    setCustomersLoading(true);
    const res = await fetch(
      `/api/tenant/${tenantId}/crm/customers?q=${encodeURIComponent(search.trim())}`
    );
    const data = (await res.json().catch(() => [])) as CrmCustomer[] | { error?: string };
    if (!res.ok) {
      setError((data as { error?: string }).error || "Müşteri listesi alınamadı.");
      setCustomers([]);
      setCustomersLoading(false);
      clearMessageLater();
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setCustomers(list);
    if (!selectedPhone && list.length > 0) setSelectedPhone(list[0].customer_phone);
    if (selectedPhone && !list.some((c) => c.customer_phone === selectedPhone)) {
      setSelectedPhone(list[0]?.customer_phone || "");
    }
    setCustomersLoading(false);
  }, [clearMessageLater, search, selectedPhone, tenantId]);

  const loadCustomerDetail = useCallback(
    async (phone: string) => {
      if (!tenantId || !phone) return;
      setDetailLoading(true);
      const res = await fetch(
        `/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(phone)}`
      );
      const payload = (await res.json().catch(() => ({}))) as {
        customer?: CrmCustomer;
        notes?: CrmNote[];
        error?: string;
      };
      if (!res.ok) {
        setError(payload.error || "Müşteri detayı alınamadı.");
        setDetailLoading(false);
        clearMessageLater();
        return;
      }
      const customer = payload.customer || null;
      setSelectedCustomer(customer);
      setProfileForm({
        customer_name: customer?.customer_name || "",
        notes_summary: customer?.notes_summary || "",
      });
      setNotes(Array.isArray(payload.notes) ? payload.notes : []);
      setDetailLoading(false);
    },
    [clearMessageLater, tenantId]
  );

  const loadReminders = useCallback(async () => {
    if (!tenantId) return;
    setRemindersLoading(true);
    const query = reminderFilter === "all" ? "" : `?status=${reminderFilter}`;
    const res = await fetch(`/api/tenant/${tenantId}/crm/reminders${query}`);
    const payload = (await res.json().catch(() => [])) as CrmReminder[] | { error?: string };
    if (!res.ok) {
      setError((payload as { error?: string }).error || "Hatırlatmalar alınamadı.");
      setReminders([]);
      setRemindersLoading(false);
      clearMessageLater();
      return;
    }
    setReminders(Array.isArray(payload) ? payload : []);
    setRemindersLoading(false);
  }, [clearMessageLater, reminderFilter, tenantId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!selectedPhone) return;
    loadCustomerDetail(selectedPhone);
  }, [loadCustomerDetail, selectedPhone]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const saveCustomerProfile = async () => {
    if (!tenantId || !selectedPhone) return;
    setBusy(true);
    const res = await fetch(`/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: profileForm.customer_name.trim() || null,
        notes_summary: profileForm.notes_summary.trim() || null,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(payload.error || "Müşteri kartı kaydedilemedi.");
      clearMessageLater();
      return;
    }
    setInfo(locale === "tr" ? "Müşteri kartı güncellendi." : "Customer profile updated.");
    await Promise.all([loadCustomerDetail(selectedPhone), loadCustomers()]);
    clearMessageLater();
  };

  const addTag = async () => {
    if (!tenantId || !selectedPhone || !newTag.trim() || !selectedCustomer) return;
    const nextTags = [...new Set([...(selectedCustomer.tags || []), newTag.trim()])];
    setBusy(true);
    const res = await fetch(`/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(locale === "tr" ? "Etiket eklenemedi." : "Tag could not be added.");
      clearMessageLater();
      return;
    }
    setNewTag("");
    await Promise.all([loadCustomerDetail(selectedPhone), loadCustomers()]);
  };

  const removeTag = async (tag: string) => {
    if (!tenantId || !selectedPhone || !selectedCustomer) return;
    const nextTags = (selectedCustomer.tags || []).filter((tItem) => tItem !== tag);
    setBusy(true);
    const res = await fetch(`/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: nextTags }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(locale === "tr" ? "Etiket silinemedi." : "Tag could not be removed.");
      clearMessageLater();
      return;
    }
    await Promise.all([loadCustomerDetail(selectedPhone), loadCustomers()]);
  };

  const addNote = async () => {
    if (!tenantId || !selectedPhone || !newNote.trim()) return;
    setBusy(true);
    const res = await fetch(
      `/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}/notes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote.trim(), created_by: "dashboard" }),
      }
    );
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(payload.error || "Not eklenemedi.");
      clearMessageLater();
      return;
    }
    setNewNote("");
    await Promise.all([loadCustomerDetail(selectedPhone), loadCustomers()]);
  };

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedPhone || !reminderForm.title.trim() || !reminderForm.remind_at) return;
    setBusy(true);
    const res = await fetch(`/api/tenant/${tenantId}/crm/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_phone: selectedPhone,
        title: reminderForm.title.trim(),
        note: reminderForm.note.trim() || undefined,
        remind_at: reminderForm.remind_at,
        channel: reminderForm.channel,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(payload.error || "Hatırlatma oluşturulamadı.");
      clearMessageLater();
      return;
    }
    setReminderForm({ title: "", note: "", remind_at: "", channel: "both" });
    await loadReminders();
  };

  const setReminderStatus = async (id: string, status: "pending" | "sent" | "cancelled") => {
    if (!tenantId) return;
    setBusy(true);
    const res = await fetch(`/api/tenant/${tenantId}/crm/reminders`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(locale === "tr" ? "Hatırlatma güncellenemedi." : "Reminder update failed.");
      clearMessageLater();
      return;
    }
    await loadReminders();
  };

  const selectedLabel = useMemo(
    () => selectedCustomer?.customer_name || selectedPhone,
    [selectedCustomer?.customer_name, selectedPhone]
  );

  return (
    <div className="space-y-6 p-6 sm:p-8 lg:p-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={`/dashboard/${tenantId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.back}
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 sm:text-base">{t.subtitle}</p>
          </div>
          {busy && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.updating}
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p>}
        {info && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{info}</p>}
      </header>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="space-y-2">
            {customersLoading ? (
              <div className="flex items-center justify-center rounded-lg border border-slate-200 px-3 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </div>
            ) : customers.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                {t.noCustomers}
              </p>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.customer_phone}
                  type="button"
                  onClick={() => setSelectedPhone(customer.customer_phone)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    selectedPhone === customer.customer_phone
                      ? "border-slate-400 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {customer.customer_name || customer.customer_phone}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{customer.customer_phone}</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {customer.total_visits} {t.visits}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!selectedPhone ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {t.selectCustomer}
            </div>
          ) : (
            <>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  <UserRound className="h-4 w-4" />
                  {t.profile}
                </h2>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yükleniyor...
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t.customerName}
                      </span>
                      <input
                        value={profileForm.customer_name}
                        onChange={(e) =>
                          setProfileForm((s) => ({ ...s, customer_name: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t.summary}
                      </span>
                      <textarea
                        rows={3}
                        value={profileForm.notes_summary}
                        onChange={(e) =>
                          setProfileForm((s) => ({ ...s, notes_summary: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.lastVisit}: {formatDate(selectedCustomer?.last_visit_at || null, locale)}
                      </p>
                      <button
                        type="button"
                        onClick={saveCustomerProfile}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {busy ? t.saving : t.save}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(selectedCustomer?.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                          aria-label="Etiketi kaldır"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder={t.addTag}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {t.addTag}
                    </button>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t.notes}</h3>
                <div className="space-y-2">
                  {notes.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t.noNotes}</p>
                  ) : (
                    notes.map((note) => (
                      <article
                        key={note.id}
                        className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
                      >
                        <p className="text-sm text-slate-800 dark:text-slate-100">{note.note}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDate(note.created_at, locale)}
                        </p>
                      </article>
                    ))
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={t.addNote}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={addNote}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    {t.addNote}
                  </button>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t.reminders}</h3>
                <form onSubmit={createReminder} className="grid gap-2 md:grid-cols-2">
                  <input
                    value={reminderForm.title}
                    onChange={(e) => setReminderForm((s) => ({ ...s, title: e.target.value }))}
                    placeholder={t.reminderTitle}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    required
                  />
                  <input
                    type="datetime-local"
                    value={reminderForm.remind_at}
                    onChange={(e) => setReminderForm((s) => ({ ...s, remind_at: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    required
                  />
                  <input
                    value={reminderForm.note}
                    onChange={(e) => setReminderForm((s) => ({ ...s, note: e.target.value }))}
                    placeholder={t.reminderNote}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 md:col-span-2"
                  />
                  <select
                    value={reminderForm.channel}
                    onChange={(e) =>
                      setReminderForm((s) => ({
                        ...s,
                        channel: e.target.value as "panel" | "whatsapp" | "both",
                      }))
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="both">{t.channels.both}</option>
                    <option value="panel">{t.channels.panel}</option>
                    <option value="whatsapp">{t.channels.whatsapp}</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <BellPlus className="h-4 w-4" />
                    {t.createReminder}
                  </button>
                </form>
              </article>
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t.upcoming}</h3>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setReminderFilter("all")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                reminderFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t.statusAll}
            </button>
            <button
              type="button"
              onClick={() => setReminderFilter("pending")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                reminderFilter === "pending"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t.statusPending}
            </button>
            <button
              type="button"
              onClick={() => setReminderFilter("sent")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                reminderFilter === "sent"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t.statusSent}
            </button>
            <button
              type="button"
              onClick={() => setReminderFilter("cancelled")}
              className={`rounded-lg px-2.5 py-1 font-semibold ${
                reminderFilter === "cancelled"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {t.statusCancelled}
            </button>
          </div>
        </div>

        {remindersLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : reminders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.noReminder}</p>
        ) : (
          <div className="space-y-2">
            {reminders.map((reminder) => (
              <article
                key={reminder.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{reminder.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {reminder.customer_phone} • {formatDate(reminder.remind_at, locale)} •{" "}
                    {t.channels[reminder.channel]}
                  </p>
                  {reminder.note && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{reminder.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {reminder.status}
                  </span>
                  {reminder.status !== "sent" && (
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, "sent")}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                      {t.sent}
                    </button>
                  )}
                  {reminder.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, "cancelled")}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                      {t.cancel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, "pending")}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200"
                    >
                      {t.reopen}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

