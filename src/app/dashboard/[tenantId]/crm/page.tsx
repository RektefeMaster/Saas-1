"use client";

import Link from "next/link";
import { preload } from "swr";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  BellPlus,
  Loader2,
  Save,
  Search,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/swr-fetcher";
import { VirtualList } from "@/components/ui";
import { useCrmStore } from "@/stores/crm-store";
import { useDashboardTenant } from "../../DashboardTenantContext";
import { DefterLayout } from "../components/DefterLayout";

interface CrmCustomer {
  customer_phone: string;
  customer_name: string | null;
  tags: string[];
  notes_summary: string | null;
  metadata?: Record<string, unknown> | null;
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

interface TenantFeaturesResponse {
  feature_flags?: {
    crm_extended_profile?: boolean;
  };
}

type ReminderFilter = "all" | "pending" | "sent" | "cancelled";

const COPY = {
  tr: {
    title: "Müşteri Defteri",
    subtitle: "Müşteri bilgilerinizi, notlarınızı ve hatırlatmalarınızı tek yerden yönetin.",
    back: "Panele dön",
    search: "Telefon, ad veya etikete göre ara...",
    index: "İndeks",
    noCustomers: "Müşteri bulunamadı.",
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
    extendedProfile: "Genişletilmiş Profil (JSON)",
    extendedProfileHint:
      "Alerji, cilt tipi, renk geçmişi gibi bilgileri buraya ekleyebilirsiniz.",
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
    index: "Index",
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
    extendedProfile: "Extended Profile (JSON)",
    extendedProfileHint:
      "Store allergy, skin type, color history and similar fields as JSON.",
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
  const tenantCtx = useDashboardTenant();
  const [crmExtendedProfileEnabled, setCrmExtendedProfileEnabled] = useState(false);
  const search = useCrmStore((s) => s.search);
  const setSearch = useCrmStore((s) => s.setSearch);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const selectedPhone = useCrmStore((s) => s.selectedPhone);
  const setSelectedPhone = useCrmStore((s) => s.setSelectedPhone);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [notes, setNotes] = useState<CrmNote[]>([]);
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
  const [metadataJson, setMetadataJson] = useState("{}");
  const [reminderForm, setReminderForm] = useState({
    title: "",
    note: "",
    remind_at: "",
    channel: "both" as "panel" | "whatsapp" | "both",
  });

  useEffect(() => {
    params.then((p) => {
      setTenantId(p.tenantId);
      useCrmStore.getState().setSearch("");
      useCrmStore.getState().setSelectedPhone("");
    });
  }, [params]);

  useEffect(() => {
    if (!tenantId) {
      setCrmExtendedProfileEnabled(false);
      return;
    }
    const flags = tenantCtx?.features as Record<string, unknown> | null;
    setCrmExtendedProfileEnabled(Boolean(flags?.crm_extended_profile));
  }, [tenantId, tenantCtx?.features]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search.trim());
    }, 260);
    return () => window.clearTimeout(timer);
  }, [search]);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMessageLater = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      setInfo("");
      setError("");
      clearTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(
    () => () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    },
    []
  );

  const loadCustomers = useCallback(async () => {
    if (!tenantId) return;
    setCustomersLoading(true);
    const res = await fetch(
      `/api/tenant/${tenantId}/crm/customers?q=${encodeURIComponent(searchQuery)}`
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
  }, [clearMessageLater, searchQuery, selectedPhone, tenantId]);

  const detailKey =
    selectedPhone && tenantId
      ? `/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}`
      : null;
  const {
    data: detailData,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR<{ customer?: CrmCustomer; notes?: CrmNote[]; error?: string }>(detailKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  useEffect(() => {
    if (!detailData || !selectedPhone) return;
    if (detailData.error) {
      setError(detailData.error);
      clearMessageLater();
      return;
    }
    const customer = detailData.customer || null;
    setSelectedCustomer(customer);
    setProfileForm({
      customer_name: customer?.customer_name || "",
      notes_summary: customer?.notes_summary || "",
    });
    const metadata =
      customer?.metadata && typeof customer.metadata === "object" ? customer.metadata : {};
    setMetadataJson(JSON.stringify(metadata, null, 2));
    setNotes(Array.isArray(detailData.notes) ? detailData.notes : []);
  }, [detailData, selectedPhone, clearMessageLater]);

  useEffect(() => {
    if (detailError) {
      setError("Müşteri detayı alınamadı.");
      clearMessageLater();
    }
  }, [detailError, clearMessageLater]);

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
    loadReminders();
  }, [loadReminders]);

  const saveCustomerProfile = async () => {
    if (!tenantId || !selectedPhone) return;
    let metadataPayload: Record<string, unknown> | undefined;
    if (crmExtendedProfileEnabled) {
      try {
        const parsed = JSON.parse(metadataJson || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("invalid_metadata");
        }
        metadataPayload = parsed as Record<string, unknown>;
      } catch {
        setError(
          locale === "tr"
            ? "Genişletilmiş profil alanı geçerli bir JSON olmalı."
            : "Extended profile field must be valid JSON."
        );
        clearMessageLater();
        return;
      }
    }

    setBusy(true);
    const res = await fetch(`/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(selectedPhone)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: profileForm.customer_name.trim() || null,
        notes_summary: profileForm.notes_summary.trim() || null,
        ...(crmExtendedProfileEnabled ? { metadata: metadataPayload || {} } : {}),
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
    await Promise.all([mutateDetail(), loadCustomers()]);
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
    await Promise.all([mutateDetail(), loadCustomers()]);
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
    await Promise.all([mutateDetail(), loadCustomers()]);
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
    await Promise.all([mutateDetail(), loadCustomers()]);
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

  return (
    <div className="p-4 pb-24 sm:p-6 lg:p-8">
      <DefterLayout
        variant="musteri"
        title={t.title}
        subtitle={t.subtitle}
        backHref={tenantId ? `/dashboard/${tenantId}` : undefined}
        backLabel={t.back}
        coverExtra={
          busy ? (
            <span className="inline-flex items-center gap-2 font-serif text-xs italic text-amber-800/50 dark:text-amber-300/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.updating}
            </span>
          ) : null
        }
        ruled={false}
      >
        {error && (
          <div className="defter-musteri-mesaj defter-musteri-mesaj-hata mb-4">
            {error}
          </div>
        )}
        {info && (
          <div className="defter-musteri-mesaj defter-musteri-mesaj-bilgi mb-4">
            {info}
          </div>
        )}

        <div className="defter-musteri-grid">
          {/* Sol: İndeks (müşteri listesi) */}
          <aside className="defter-indeks">
            <div className="defter-indeks-baslik">{t.index}</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-800/40 dark:text-amber-400/40" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className="defter-indeks-ara"
                aria-label={t.search}
              />
            </div>
            <div className="space-y-0">
              {customersLoading ? (
                <div className="flex items-center justify-center py-10 font-serif text-sm text-amber-800/50 dark:text-amber-300/50">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Yükleniyor…
                </div>
              ) : customers.length === 0 ? (
                <p className="py-6 font-serif text-sm text-amber-800/50 dark:text-amber-300/50">
                  {t.noCustomers}
                </p>
              ) : (
                <VirtualList
                  items={customers}
                  height={380}
                  estimateSize={72}
                  renderItem={(customer) => (
                    <button
                      type="button"
                      onMouseEnter={() =>
                        tenantId &&
                        preload(
                          `/api/tenant/${tenantId}/crm/customers/${encodeURIComponent(customer.customer_phone)}`,
                          fetcher
                        )
                      }
                      onClick={() => setSelectedPhone(customer.customer_phone)}
                      className={`defter-indeks-item ${
                        selectedPhone === customer.customer_phone ? "defter-indeks-secili" : ""
                      }`}
                    >
                      <span className="block font-medium">
                        {customer.customer_name || customer.customer_phone}
                      </span>
                      <span className="defter-indeks-item-telefon">{customer.customer_phone}</span>
                      <span className="defter-indeks-item-ziyaret">
                        {customer.total_visits} {t.visits}
                      </span>
                    </button>
                  )}
                />
              )}
            </div>
          </aside>

          <section className="space-y-4">
            {!selectedPhone ? (
              <div className="defter-sayfa flex min-h-[200px] items-center justify-center font-serif text-sm italic text-amber-800/50 dark:text-amber-300/50">
                {t.selectCustomer}
              </div>
            ) : (
              <>
                <article className="defter-sayfa">
                  <h2 className="defter-sayfa-baslik">
                    <UserRound className="h-4 w-4" />
                    {t.profile}
                  </h2>
                {detailLoading ? (
                  <div className="flex items-center gap-2 font-serif text-sm text-amber-800/50 dark:text-amber-300/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yükleniyor…
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <label>
                      <span className="defter-sayfa-label">{t.customerName}</span>
                      <input
                        value={profileForm.customer_name}
                        onChange={(e) =>
                          setProfileForm((s) => ({ ...s, customer_name: e.target.value }))
                        }
                        className="defter-sayfa-input"
                      />
                    </label>
                    <label>
                      <span className="defter-sayfa-label">{t.summary}</span>
                      <textarea
                        rows={3}
                        value={profileForm.notes_summary}
                        onChange={(e) =>
                          setProfileForm((s) => ({ ...s, notes_summary: e.target.value }))
                        }
                        className="defter-sayfa-textarea"
                      />
                    </label>
                    {crmExtendedProfileEnabled && (
                      <label>
                        <span className="defter-sayfa-label">{t.extendedProfile}</span>
                        <textarea
                          rows={8}
                          value={metadataJson}
                          onChange={(e) => setMetadataJson(e.target.value)}
                          className="defter-sayfa-textarea font-mono text-xs"
                        />
                        <p className="mt-1 font-serif text-xs text-amber-800/50 dark:text-amber-300/50">
                          {t.extendedProfileHint}
                        </p>
                      </label>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <p className="font-serif text-xs text-amber-800/50 dark:text-amber-300/50">
                        {t.lastVisit}: {formatDate(selectedCustomer?.last_visit_at || null, locale)}
                      </p>
                      <button
                        type="button"
                        onClick={saveCustomerProfile}
                        className="defter-sayfa-btn"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {busy ? t.saving : t.save}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 border-t border-amber-300/30 pt-4 dark:border-amber-700/20">
                  <div className="mb-2 flex flex-wrap">
                    {(selectedCustomer?.tags || []).map((tag) => (
                      <span key={tag} className="defter-etiket">
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="rounded-full p-0.5 opacity-70 hover:opacity-100"
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
                      className="defter-sayfa-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="defter-sayfa-btn defter-sayfa-btn-ikincil"
                    >
                      {t.addTag}
                    </button>
                  </div>
                </div>
              </article>

                <article className="defter-sayfa">
                  <h3 className="defter-sayfa-baslik">{t.notes}</h3>
                  <div className="space-y-0">
                    {notes.length === 0 ? (
                      <p className="py-4 font-serif text-sm text-amber-800/50 dark:text-amber-300/50">
                        {t.noNotes}
                      </p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="defter-not-satir">
                          <p>{note.note}</p>
                          <p className="defter-not-tarih">{formatDate(note.created_at, locale)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder={t.addNote}
                      className="defter-sayfa-input flex-1"
                    />
                    <button type="button" onClick={addNote} className="defter-sayfa-btn">
                      {t.addNote}
                    </button>
                  </div>
                </article>

                <article className="defter-sayfa">
                  <h3 className="defter-sayfa-baslik">{t.reminders}</h3>
                  <form onSubmit={createReminder} className="grid gap-3 md:grid-cols-2">
                    <input
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm((s) => ({ ...s, title: e.target.value }))}
                      placeholder={t.reminderTitle}
                      className="defter-sayfa-input"
                      required
                    />
                    <input
                      type="datetime-local"
                      value={reminderForm.remind_at}
                      onChange={(e) => setReminderForm((s) => ({ ...s, remind_at: e.target.value }))}
                      className="defter-sayfa-input"
                      required
                    />
                    <input
                      value={reminderForm.note}
                      onChange={(e) => setReminderForm((s) => ({ ...s, note: e.target.value }))}
                      placeholder={t.reminderNote}
                      className="defter-sayfa-input md:col-span-2"
                    />
                    <select
                      value={reminderForm.channel}
                      onChange={(e) =>
                        setReminderForm((s) => ({
                          ...s,
                          channel: e.target.value as "panel" | "whatsapp" | "both",
                        }))
                      }
                      className="defter-sayfa-input"
                    >
                      <option value="both">{t.channels.both}</option>
                      <option value="panel">{t.channels.panel}</option>
                      <option value="whatsapp">{t.channels.whatsapp}</option>
                    </select>
                    <button type="submit" className="defter-sayfa-btn">
                      <BellPlus className="h-4 w-4" />
                      {t.createReminder}
                    </button>
                  </form>
                </article>
              </>
            )}
          </section>
        </div>

        {/* Hatırlatma listesi — tüm sayfanın altında, defter sayfası gibi */}
        <section className="defter-sayfa mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="defter-sayfa-baslik mb-0 border-0 pb-0">{t.upcoming}</h3>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "pending", "sent", "cancelled"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setReminderFilter(filter)}
                  className={`rounded-lg px-2.5 py-1 font-serif text-xs font-semibold transition ${
                    reminderFilter === filter
                      ? "defter-sayfa-btn"
                      : "defter-sayfa-btn-ikincil"
                  }`}
                >
                  {filter === "all"
                    ? t.statusAll
                    : filter === "pending"
                      ? t.statusPending
                      : filter === "sent"
                        ? t.statusSent
                        : t.statusCancelled}
                </button>
              ))}
            </div>
          </div>

          {remindersLoading ? (
            <div className="flex items-center gap-2 font-serif text-sm text-amber-800/50 dark:text-amber-300/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Yükleniyor…
            </div>
          ) : reminders.length === 0 ? (
            <p className="font-serif text-sm text-amber-800/50 dark:text-amber-300/50">
              {t.noReminder}
            </p>
          ) : (
            <div className="space-y-0">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="defter-not-satir flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-amber-900/80 dark:text-amber-100/80">
                      {reminder.title}
                    </p>
                    <p className="defter-not-tarih mt-0.5">
                      {reminder.customer_phone} • {formatDate(reminder.remind_at, locale)} •{" "}
                      {t.channels[reminder.channel]}
                    </p>
                    {reminder.note && (
                      <p className="mt-1 font-serif text-xs text-amber-800/60 dark:text-amber-300/60">
                        {reminder.note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="defter-etiket text-[11px]">
                      {reminder.status}
                    </span>
                    {reminder.status !== "sent" && (
                      <button
                        type="button"
                        onClick={() => setReminderStatus(reminder.id, "sent")}
                        className="defter-sayfa-btn-ikincil px-2 py-1 text-xs"
                      >
                        {t.sent}
                      </button>
                    )}
                    {reminder.status !== "cancelled" ? (
                      <button
                        type="button"
                        onClick={() => setReminderStatus(reminder.id, "cancelled")}
                        className="defter-sayfa-btn-ikincil px-2 py-1 text-xs"
                      >
                        {t.cancel}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReminderStatus(reminder.id, "pending")}
                        className="defter-sayfa-btn-ikincil px-2 py-1 text-xs"
                      >
                        {t.reopen}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </DefterLayout>
    </div>
  );
}
