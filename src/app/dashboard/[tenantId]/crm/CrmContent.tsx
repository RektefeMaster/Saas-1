"use client";

import Link from "next/link";
import { preload } from "swr";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
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
import { fetcher } from "@/lib/swr-fetcher";
import { VirtualList } from "@/components/ui";
import { useCrmStore } from "@/stores/crm-store";
import { useDashboardTenant } from "../../DashboardTenantContext";
import {
  extractProfileValues,
  getProfileFields,
  getUnmanagedKeys,
  mergeProfileMetadata,
  type ProfileField,
} from "./profile-fields";

interface CrmCustomer {
  customer_phone: string;
  customer_name: string | null;
  tags: string[];
  notes_summary: string | null;
  metadata?: Record<string, unknown> | null;
  last_visit_at: string | null;
  total_visits: number;
  pipeline_stage?: string | null;
  lead_score?: number | null;
  lead_score_breakdown?: Record<string, number> | null;
  lifecycle_stage?: string | null;
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
    title: "Müşteri defteri",
    subtitle: "Profil, not ve hatırlatmaları tek yerde tutun; bir sonraki ziyaret için hazır olun.",
    back: "Panele dön",
    backToList: "Listeye dön",
    search: "Telefon, ad veya etiket ara…",
    index: "Müşteriler",
    noCustomers: "Henüz müşteri yok.",
    selectCustomer: "Listeden bir müşteri seçin.",
    profile: "Müşteri kartı",
    notes: "Notlar",
    reminders: "Hatırlatma ekle",
    upcoming: "Hatırlatmalar",
    noNotes: "Henüz not yok.",
    noReminder: "Planlanmış hatırlatma yok.",
    loading: "Yükleniyor…",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    addNote: "Not ekle",
    addTag: "Etiket ekle",
    summary: "Kısa özet",
    extendedProfile: "Ek bilgiler",
    extendedProfileHint:
      "Alanlar işletme tipinize göre gelir. Girdiğiniz bilgiler bu müşteri kartında saklanır.",
    advancedJson: "Gelişmiş (JSON)",
    advancedJsonHint:
      "Formda olmayan alanları buradan düzenleyin. Geçerli bir JSON nesnesi olmalı.",
    keptKeys: "Formda olmayan korunan alanlar",
    healthNotice:
      "KVKK: Sağlık notları özel nitelikli veridir. Yalnızca hizmet için gerekli ve müşterinin açık rızasıyla paylaştığı bilgileri yazın.",
    customerName: "Müşteri adı",
    lastVisit: "Son ziyaret",
    visits: "ziyaret",
    reminderTitle: "Başlık",
    reminderNote: "Not (isteğe bağlı)",
    remindAt: "Hatırlatma zamanı",
    createReminder: "Hatırlatma oluştur",
    updating: "Güncelleniyor…",
    sent: "Gönderildi",
    cancel: "İptal et",
    reopen: "Yeniden aç",
    statusAll: "Tümü",
    statusPending: "Bekleyen",
    statusSent: "Gönderilen",
    statusCancelled: "İptal",
    channels: {
      panel: "Yalnızca panel",
      whatsapp: "Yalnızca WhatsApp",
      both: "Panel ve WhatsApp",
    },
  },
  en: {
    title: "Customer Notebook",
    subtitle: "Manage customer profiles, notes, tags, and reminders in one place.",
    back: "Back to Panel",
    backToList: "Back to list",
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
    loading: "Loading…",
    save: "Save",
    saving: "Saving...",
    addNote: "Add Note",
    addTag: "Add Tag",
    summary: "Short customer summary",
    extendedProfile: "Customer Details",
    extendedProfileHint:
      "These fields are tailored to your business type and stored on the customer card.",
    advancedJson: "Advanced (JSON)",
    advancedJsonHint:
      "Edit fields that are not part of the form above. Must be a valid JSON object.",
    keptKeys: "Preserved fields not shown in the form",
    healthNotice:
      "Health data is sensitive personal data. Only record what is necessary for the service and shared with the customer's explicit consent.",
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

const TOUCH_INPUT =
  "min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-700 sm:text-sm";
const TOUCH_BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition";

function useIsLgUp() {
  const [isLgUp, setIsLgUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isLgUp;
}

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

export function CrmContent({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];
  const isLgUp = useIsLgUp();

  const { tenantId } = use(params);
  const tenantCtx = useDashboardTenant();
  const sectorKey = tenantCtx?.sector?.key ?? null;
  const isHealthcareSector = Boolean(tenantCtx?.sector?.healthcare);
  const profileFields = useMemo<ProfileField[]>(
    () => getProfileFields(sectorKey),
    [sectorKey]
  );
  const [crmExtendedProfileEnabled, setCrmExtendedProfileEnabled] = useState(false);
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const search = useCrmStore((s) => s.search);
  const setSearch = useCrmStore((s) => s.setSearch);
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const selectedPhone = useCrmStore((s) => s.selectedPhone);
  const setSelectedPhone = useCrmStore((s) => s.setSelectedPhone);
  const showMobileDetail = !isLgUp && Boolean(selectedPhone);
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomer | null>(null);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [reminders, setReminders] = useState<CrmReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [reminderFilter, setReminderFilter] = useState<ReminderFilter>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const busyRef = useRef(false);
  const notesEndRef = useRef<HTMLDivElement | null>(null);

  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [profileForm, setProfileForm] = useState({
    customer_name: "",
    notes_summary: "",
  });
  const [metadataJson, setMetadataJson] = useState("{}");
  /** Kaydedilmiş metadata; form dışı anahtarlar buradan korunur. */
  const [metadataRaw, setMetadataRaw] = useState<Record<string, unknown>>({});
  const [profileValues, setProfileValues] = useState<Record<string, string>>({});
  const [reminderForm, setReminderForm] = useState({
    title: "",
    note: "",
    remind_at: "",
    channel: "both" as "panel" | "whatsapp" | "both",
  });
  const [listHeight, setListHeight] = useState(400);

  useEffect(() => {
    useCrmStore.getState().setSearch("");
    useCrmStore.getState().setSelectedPhone("");
  }, [tenantId]);

  useEffect(() => {
    const update = () => {
      setListHeight(
        window.matchMedia("(min-width: 1024px)").matches
          ? 400
          : Math.max(320, window.innerHeight - 300)
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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

  const clearTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (isLgUp && !selectedPhone && customers.length > 0) {
      setSelectedPhone(customers[0].customer_phone);
    }
  }, [isLgUp, selectedPhone, customers, setSelectedPhone]);

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
    if (isLgUp) {
      if (!selectedPhone && list.length > 0) setSelectedPhone(list[0].customer_phone);
      if (selectedPhone && !list.some((c) => c.customer_phone === selectedPhone)) {
        setSelectedPhone(list[0]?.customer_phone || "");
      }
    } else if (selectedPhone && !list.some((c) => c.customer_phone === selectedPhone)) {
      setSelectedPhone("");
    }
    setCustomersLoading(false);
  }, [clearMessageLater, isLgUp, searchQuery, selectedPhone, tenantId, setSelectedPhone]);

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
    setMetadataRaw(metadata);
    setMetadataJson(JSON.stringify(metadata, null, 2));
    setProfileValues(extractProfileValues(metadata, profileFields));
    setNotes(Array.isArray(detailData.notes) ? detailData.notes : []);
  }, [detailData, selectedPhone, clearMessageLater, profileFields]);

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
      // Gelişmiş mod açıkken JSON kaynak kabul edilir; kapalıyken form değerleri
      // kaydedilmiş metadata üzerine yazılır, bilinmeyen anahtarlar silinmez.
      let base = metadataRaw;
      if (showAdvancedJson) {
        try {
          const parsed = JSON.parse(metadataJson || "{}");
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("invalid_metadata");
          }
          base = parsed as Record<string, unknown>;
        } catch {
          setError(
            locale === "tr"
              ? "Gelişmiş alan geçerli bir JSON nesnesi olmalı."
              : "Advanced field must be a valid JSON object."
          );
          clearMessageLater();
          return;
        }
      }
      metadataPayload = mergeProfileMetadata(base, profileFields, profileValues);
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
    if (!tenantId || !selectedPhone || !newNote.trim() || busyRef.current) return;
    setBusy(true);
    busyRef.current = true;
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
    busyRef.current = false;
    if (!res.ok) {
      setError(payload.error || "Not eklenemedi.");
      clearMessageLater();
      return;
    }
    setNewNote("");
    await Promise.all([mutateDetail(), loadCustomers()]);
    requestAnimationFrame(() => {
      notesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
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
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-10">
      <header
        className={`panel-surface p-4 sm:p-6 ${showMobileDetail ? "hidden lg:block" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href={tenantId ? `/dashboard/${tenantId}` : "#"}
              className={`${TOUCH_BTN} rounded-lg border border-slate-200 bg-slate-50 px-3 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Link>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              {t.subtitle}
            </p>
          </div>
          {busy && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.updating}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {info}
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-6">
        <aside
          className={`panel-surface p-4 ${showMobileDetail ? "hidden lg:block" : ""}`}
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t.index}
          </h2>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className={`${TOUCH_INPUT} w-full pl-10 pr-3`}
              aria-label={t.search}
            />
          </div>
          {customersLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t.loading}
            </div>
          ) : customers.length === 0 ? (
            <p className="rounded-lg bg-slate-50 py-6 text-center text-sm text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              {t.noCustomers}
            </p>
          ) : (
            <VirtualList
              items={customers}
              height={listHeight}
              estimateSize={80}
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
                  className={`mb-2 w-full min-h-[72px] rounded-xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                    selectedPhone === customer.customer_phone
                      ? "border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {customer.customer_name || customer.customer_phone}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {customer.customer_phone}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {customer.total_visits} {t.visits}
                    {customer.pipeline_stage
                      ? ` · ${customer.pipeline_stage}`
                      : ""}
                    {typeof customer.lead_score === "number"
                      ? ` · skor ${customer.lead_score}`
                      : ""}
                  </p>
                </button>
              )}
            />
          )}
        </aside>

        <section className={`min-w-0 space-y-4 lg:space-y-6 ${showMobileDetail ? "" : "hidden lg:block"}`}>
          {!selectedPhone ? (
            <div className="flex min-h-[280px] panel-surface items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
              {t.selectCustomer}
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-10 -mx-1 border-b border-slate-200 bg-white/95 px-1 pb-3 pt-1 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 lg:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedPhone("")}
                  className={`${TOUCH_BTN} w-full justify-start rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
                >
                  <ArrowLeft className="h-5 w-5 shrink-0" />
                  <span className="truncate">{t.backToList}</span>
                </button>
                <p className="mt-2 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedCustomer?.customer_name || selectedPhone}
                </p>
                {selectedCustomer?.customer_name && (
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{selectedPhone}</p>
                )}
                {error && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                    {error}
                  </p>
                )}
                {info && (
                  <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {info}
                  </p>
                )}
              </div>

              <article className="panel-surface overflow-hidden p-4 sm:p-5">
                <h2 className="mb-4 hidden items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 lg:flex">
                  <UserRound className="h-4 w-4" />
                  {t.profile}
                </h2>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loading}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {(selectedCustomer?.pipeline_stage ||
                      typeof selectedCustomer?.lead_score === "number") && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800/60">
                        {selectedCustomer.pipeline_stage && (
                          <p>
                            Pipeline:{" "}
                            <strong>{selectedCustomer.pipeline_stage}</strong>
                          </p>
                        )}
                        {typeof selectedCustomer.lead_score === "number" && (
                          <p>
                            Lead skor:{" "}
                            <strong>{selectedCustomer.lead_score}</strong>
                          </p>
                        )}
                        {selectedCustomer.lead_score_breakdown &&
                          Object.keys(selectedCustomer.lead_score_breakdown).length >
                            0 && (
                            <p className="mt-1 text-xs text-slate-500">
                              {Object.entries(selectedCustomer.lead_score_breakdown)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")}
                            </p>
                          )}
                      </div>
                    )}
                    <label>
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t.customerName}
                      </span>
                      <input
                        value={profileForm.customer_name}
                        onChange={(e) =>
                          setProfileForm((s) => ({ ...s, customer_name: e.target.value }))
                        }
                        className={TOUCH_INPUT + " w-full"}
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
                        className={TOUCH_INPUT + " w-full resize-y"}
                      />
                    </label>
                    {crmExtendedProfileEnabled && (
                      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t.extendedProfile}
                            {tenantCtx?.sector?.label ? ` · ${tenantCtx.sector.label}` : ""}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setShowAdvancedJson((v) => !v)}
                            aria-expanded={showAdvancedJson}
                            className={`${TOUCH_BTN} shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800`}
                          >
                            {t.advancedJson}
                          </button>
                        </div>
                        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                          {t.extendedProfileHint}
                        </p>
                        {isHealthcareSector && (
                          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                            {t.healthNotice}
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {profileFields.map((field) => {
                            const value = profileValues[field.key] ?? "";
                            const onChange = (next: string) =>
                              setProfileValues((s) => ({ ...s, [field.key]: next }));
                            const inputClass = TOUCH_INPUT + " w-full rounded-lg";
                            return (
                              <label
                                key={field.key}
                                className={field.type === "textarea" ? "lg:col-span-2" : undefined}
                              >
                                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                                  {field.label[locale]}
                                </span>
                                {field.type === "textarea" ? (
                                  <textarea
                                    rows={3}
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    placeholder={field.placeholder?.[locale]}
                                    className={inputClass}
                                  />
                                ) : field.type === "select" ? (
                                  <select
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    className={inputClass}
                                  >
                                    <option value="">—</option>
                                    {(field.options || []).map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={
                                      field.type === "date"
                                        ? "date"
                                        : field.type === "number"
                                          ? "number"
                                          : "text"
                                    }
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    placeholder={field.placeholder?.[locale]}
                                    className={inputClass}
                                  />
                                )}
                              </label>
                            );
                          })}
                        </div>
                        {showAdvancedJson && (
                          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                            <textarea
                              rows={8}
                              value={metadataJson}
                              onChange={(e) => setMetadataJson(e.target.value)}
                              aria-label={t.advancedJson}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-xs outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-slate-700"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {t.advancedJsonHint}
                            </p>
                          </div>
                        )}
                        {!showAdvancedJson &&
                          getUnmanagedKeys(metadataRaw, profileFields).length > 0 && (
                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                              {t.keptKeys}:{" "}
                              {getUnmanagedKeys(metadataRaw, profileFields).join(", ")}
                            </p>
                          )}
                      </section>
                    )}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.lastVisit}: {formatDate(selectedCustomer?.last_visit_at || null, locale)}
                      </p>
                      <button
                        type="button"
                        onClick={saveCustomerProfile}
                        className={`${TOUCH_BTN} w-full bg-slate-900 text-white hover:bg-slate-700 sm:w-auto dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`}
                      >
                        <Save className="h-4 w-4" />
                        {busy ? t.saving : t.save}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(selectedCustomer?.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="min-h-8 min-w-8 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-100"
                          aria-label="Etiketi kaldır"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder={t.addTag}
                      className={`${TOUCH_INPUT} min-w-0 flex-1 rounded-lg`}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className={`${TOUCH_BTN} w-full shrink-0 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 sm:w-auto dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`}
                    >
                      {t.addTag}
                    </button>
                  </div>
                </div>
              </article>

              <article className="panel-surface overflow-hidden">
                <h3 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100 sm:px-5">
                  {t.notes}
                </h3>
                <div className="max-h-80 space-y-3 overflow-y-auto overscroll-contain bg-slate-50/80 px-3 py-4 dark:bg-slate-950/40 sm:px-4">
                  {notes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t.noNotes}
                    </p>
                  ) : (
                    // API newest-first döner; sohbet görünümü için kronolojik sıraya çevir.
                    [...notes].reverse().map((note) => (
                      <div key={note.id} className="flex justify-end gap-2">
                        <div className="flex max-w-[min(90%,24rem)] flex-col items-end">
                          <div className="rounded-2xl rounded-tr-md bg-emerald-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                            <p className="whitespace-pre-wrap break-words">{note.note}</p>
                          </div>
                          <p className="mt-1 px-1 text-[10px] text-slate-400">
                            {formatDate(note.created_at, locale)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={notesEndRef} />
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 p-3 dark:border-slate-800 sm:flex-row sm:p-4">
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={t.addNote}
                    disabled={busy}
                    className={`${TOUCH_INPUT} min-w-0 flex-1 rounded-xl disabled:opacity-50`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (busyRef.current) return;
                        void addNote();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || !newNote.trim()}
                    onClick={() => void addNote()}
                    className={`${TOUCH_BTN} w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto dark:bg-emerald-500 dark:hover:bg-emerald-400`}
                  >
                    {t.addNote}
                  </button>
                </div>
              </article>

              <article className="panel-surface overflow-hidden p-4 sm:p-5">
                <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">{t.reminders}</h3>
                <form onSubmit={createReminder} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <input
                    value={reminderForm.title}
                    onChange={(e) => setReminderForm((s) => ({ ...s, title: e.target.value }))}
                    placeholder={t.reminderTitle}
                    className={`${TOUCH_INPUT} rounded-lg`}
                    required
                  />
                  <input
                    type="datetime-local"
                    value={reminderForm.remind_at}
                    onChange={(e) => setReminderForm((s) => ({ ...s, remind_at: e.target.value }))}
                    className={`${TOUCH_INPUT} rounded-lg`}
                    required
                  />
                  <input
                    value={reminderForm.note}
                    onChange={(e) => setReminderForm((s) => ({ ...s, note: e.target.value }))}
                    placeholder={t.reminderNote}
                    className={`${TOUCH_INPUT} rounded-lg lg:col-span-2`}
                  />
                  <select
                    value={reminderForm.channel}
                    onChange={(e) =>
                      setReminderForm((s) => ({
                        ...s,
                        channel: e.target.value as "panel" | "whatsapp" | "both",
                      }))
                    }
                    className={`${TOUCH_INPUT} rounded-lg`}
                  >
                    <option value="both">{t.channels.both}</option>
                    <option value="panel">{t.channels.panel}</option>
                    <option value="whatsapp">{t.channels.whatsapp}</option>
                  </select>
                  <button
                    type="submit"
                    className={`${TOUCH_BTN} w-full bg-slate-900 text-white hover:bg-slate-700 lg:w-auto dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`}
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

      <section
        className={`panel-surface overflow-hidden p-4 sm:p-5 ${showMobileDetail ? "hidden lg:block" : ""}`}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t.upcoming}</h3>
          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "sent", "cancelled"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setReminderFilter(filter)}
                className={`min-h-11 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  reminderFilter === filter
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </div>
        ) : reminders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.noReminder}</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-800"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {reminder.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {reminder.customer_phone} · {formatDate(reminder.remind_at, locale)} ·{" "}
                    {t.channels[reminder.channel]}
                  </p>
                  {reminder.note && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{reminder.note}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium dark:bg-slate-800">
                    {reminder.status}
                  </span>
                  {reminder.status !== "sent" && (
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, "sent")}
                      className={`${TOUCH_BTN} rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800`}
                    >
                      {t.sent}
                    </button>
                  )}
                  {reminder.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, "cancelled")}
                      className={`${TOUCH_BTN} rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800`}
                    >
                      {t.cancel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReminderStatus(reminder.id, "pending")}
                      className={`${TOUCH_BTN} rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800`}
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
    </div>
  );
}
