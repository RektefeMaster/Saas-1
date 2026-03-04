"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  MessageCircle,
  Megaphone,
  Plus,
  RotateCw,
  Send,
  Smartphone,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { LottieAnimationLazyLazy } from "@/components/ui/LottieAnimationLazyLazy";

interface RecipientItem {
  phone: string;
  name?: string;
  tags?: string[];
}

interface RecipientInfo {
  count: number;
  all_tags: string[];
  recipients: RecipientItem[];
}

interface CampaignRecord {
  id: string;
  message_text: string;
  channel: string;
  recipient_count: number;
  success_count: number;
  filter_tags: string[] | null;
  created_at: string;
}

const COPY = {
  tr: {
    contactUsMessage: "Kampanya göndermek için bizimle iletişime geçin.",
    contactUsSubtext: "Kampanya özelliği şu an hesabınızda kapalı. Açmak için bizimle iletişime geçebilirsiniz.",
    title: "Kampanyalar",
    subtitle: "Müşterilerinize toplu WhatsApp veya SMS kampanya mesajı gönderin.",
    backToPanel: "Panele dön",
    send: "Gönder",
    sending: "Gönderiliyor...",
    recipients: "Alıcılar",
    channel: "Gönderim kanalı",
    channelWhatsApp: "WhatsApp",
    channelSms: "SMS",
    channelBoth: "WhatsApp + SMS (yedek)",
    recipientCount: "alıcı",
    loadingRecipients: "Alıcılar yükleniyor...",
    tagFilter: "Etiket filtresi (opsiyonel)",
    tagFilterHint: "Seçtiğiniz etiketlerden en az birine sahip müşterilere gider",
    loadingTags: "Etiketler yükleniyor...",
    noTags: "Henüz etiket yok.",
    selectAll: "Tümünü seç",
    clearTags: "Temizle",
    customPhones: "Özel numara listesi (opsiyonel)",
    customPhonesHint: "Boş bırakırsanız CRM ve randevu müşterilerine gider. Virgül veya satırla ayırın.",
    campaignMessage: "Kampanya Mesajı",
    messagePlaceholder: "Kampanya mesajını yazın...",
    charsSms: "karakter (~{n} SMS)",
    confirmTitle: "Kampanyayı Gönder",
    confirmMessage: "{count} kişiye bu mesaj gönderilecek. Devam etmek istiyor musunuz?",
    confirmSend: "Evet, Gönder",
    confirmCancel: "İptal",
    errorRequired: "Mesaj metni zorunlu.",
    errorConnection: "Bağlantı hatası.",
    errorSend: "Gönderim başarısız.",
    resultSuccess: "{success}/{total} alıcıya gönderildi",
    resultReason: "Olası sebep:",
    historyTitle: "Geçmiş Kampanyalar",
    historyEmpty: "Henüz kampanya gönderilmedi.",
    historyLoadError: "Geçmiş yüklenemedi.",
    historyItem: "{success}/{total} alıcı • {channel} • {date}",
    channelWhatsAppShort: "WhatsApp",
    channelSmsShort: "SMS",
    channelBothShort: "WhatsApp+SMS",
    recipientsLoadError: "Alıcılar yüklenemedi.",
    resend: "Tekrar Gönder",
    resending: "Gönderiliyor...",
    delete: "Sil",
    deleting: "Siliniyor...",
    confirmDelete: "Bu kampanyayı silmek istediğinize emin misiniz?",
    confirmResend: "Aynı kişilere tekrar göndermek istiyor musunuz?",
    viewRecipients: "Alıcıları Gör / Düzenle",
    addRecipient: "Numara ekle",
    addRecipientPlaceholder: "+90 5XX XXX XX XX",
    removeRecipient: "Çıkar",
    recipientListTitle: "Kampanya Alıcıları",
    recipientListEmpty: "Alıcı yok.",
    closeRecipients: "Kapat",
  },
  en: {
    contactUsMessage: "Contact us to send campaigns.",
    contactUsSubtext: "The campaign feature is not currently active on your account. Please contact our support team to enable it.",
    title: "Campaigns",
    subtitle: "Send bulk WhatsApp or SMS campaign messages to your customers.",
    backToPanel: "Back to Panel",
    send: "Send",
    sending: "Sending...",
    recipients: "Recipients",
    channel: "Channel",
    channelWhatsApp: "WhatsApp",
    channelSms: "SMS",
    channelBoth: "WhatsApp + SMS (fallback)",
    recipientCount: "recipients",
    loadingRecipients: "Loading recipients...",
    tagFilter: "Tag filter (optional)",
    tagFilterHint: "Sent to customers with at least one of the selected tags",
    loadingTags: "Loading tags...",
    noTags: "No tags yet.",
    selectAll: "Select all",
    clearTags: "Clear",
    customPhones: "Custom phone list (optional)",
    customPhonesHint: "Leave empty to send to CRM and appointment customers. Separate with comma or newline.",
    campaignMessage: "Campaign Message",
    messagePlaceholder: "Write your campaign message...",
    charsSms: "chars (~{n} SMS)",
    confirmTitle: "Send Campaign",
    confirmMessage: "This message will be sent to {count} recipients. Are you sure?",
    confirmSend: "Yes, Send",
    confirmCancel: "Cancel",
    errorRequired: "Message text is required.",
    errorConnection: "Connection error.",
    errorSend: "Send failed.",
    resultSuccess: "{success}/{total} sent",
    resultReason: "Possible reason:",
    historyTitle: "Campaign History",
    historyEmpty: "No campaigns sent yet.",
    historyLoadError: "Failed to load history.",
    historyItem: "{success}/{total} recipients • {channel} • {date}",
    channelWhatsAppShort: "WhatsApp",
    channelSmsShort: "SMS",
    channelBothShort: "WhatsApp+SMS",
    recipientsLoadError: "Failed to load recipients.",
    resend: "Resend",
    resending: "Sending...",
    delete: "Delete",
    deleting: "Deleting...",
    confirmDelete: "Are you sure you want to delete this campaign?",
    confirmResend: "Do you want to resend this campaign to the same recipients?",
    viewRecipients: "View / Edit Recipients",
    addRecipient: "Add number",
    addRecipientPlaceholder: "+1 XXX XXX XXXX",
    removeRecipient: "Remove",
    recipientListTitle: "Campaign Recipients",
    recipientListEmpty: "No recipients.",
    closeRecipients: "Close",
  },
} as const;

function getChannelLabel(channel: string, t: (typeof COPY)["tr"] | (typeof COPY)["en"]): string {
  if (channel === "whatsapp") return t.channelWhatsAppShort;
  if (channel === "sms") return t.channelSmsShort;
  if (channel === "both") return t.channelBothShort;
  return channel;
}

function normalizePhoneForCompare(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "90" + d.slice(1);
  else if (!d.startsWith("90")) d = "90" + d;
  return d.slice(-12) || phone;
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return locale === "tr"
    ? d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CampaignsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { locale } = useLocale();
  const t = COPY[locale];

  const [tenantId, setTenantId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "both">("whatsapp");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [customPhones, setCustomPhones] = useState("");
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    success_count: number;
    recipient_count: number;
    last_error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<CampaignRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [excludedPhones, setExcludedPhones] = useState<Set<string>>(new Set());
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [addPhoneInput, setAddPhoneInput] = useState("");
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [campaignEnabled, setCampaignEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/tenant/${tenantId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setCampaignEnabled((data as { campaign_enabled?: boolean }).campaign_enabled !== false);
        } else {
          setCampaignEnabled(true);
        }
      })
      .catch(() => setCampaignEnabled(true));
  }, [tenantId]);

  const loadRecipients = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    const tags = filterTags.length ? `?tags=${encodeURIComponent(filterTags.join(","))}` : "";
    fetch(`/api/tenant/${tenantId}/campaigns/recipients${tags}`, { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || data.error) throw new Error(data?.error || "Request failed");
        setError(null);
        setExcludedPhones(new Set());
        setExtraPhones([]);
        setRecipientInfo({
          count: data.count ?? 0,
          all_tags: data.all_tags ?? [],
          recipients: (data.recipients ?? []).map((r: { phone: string; name?: string; customer_name?: string; tags?: string[] }) => ({
            phone: String(r.phone || "").trim(),
            name: r.name || r.customer_name,
            tags: r.tags,
          })).filter((r: { phone: string }) => r.phone),
        });
      })
      .catch(() => {
        setRecipientInfo(null);
        setError(t.recipientsLoadError);
      })
      .finally(() => setLoading(false));
  }, [tenantId, filterTags.join(","), t.recipientsLoadError]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const loadHistory = useCallback(() => {
    if (!tenantId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    fetch(`/api/tenant/${tenantId}/campaigns/history?limit=15`, { cache: "no-store" })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok && data?.error) throw new Error(data.error);
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setHistory([]);
        setHistoryError(t.historyLoadError);
      })
      .finally(() => setHistoryLoading(false));
  }, [tenantId, t.historyLoadError]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!showConfirm && !showRecipientsModal) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showRecipientsModal) setShowRecipientsModal(false);
        else setShowConfirm(false);
      }
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = showConfirm || showRecipientsModal ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [showConfirm, showRecipientsModal]);

  const baseRecipientsFromApi = recipientInfo?.recipients ?? [];
  const effectiveRecipients: { phone: string; name?: string }[] = customPhones.trim()
    ? customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean).map((p) => ({ phone: p }))
    : [
        ...baseRecipientsFromApi.filter((r) => !excludedPhones.has(normalizePhoneForCompare(r.phone))).map((r) => ({ phone: r.phone, name: r.name })),
        ...extraPhones.filter((p) => p.trim()).map((p) => ({ phone: p })),
      ];
  const effectiveCount = effectiveRecipients.length;

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((tagItem) => tagItem !== tag) : [...prev, tag]
    );
  };

  const selectAllTags = () => {
    if (recipientInfo?.all_tags.length) {
      setFilterTags(recipientInfo.all_tags);
    }
  };

  const clearTags = () => setFilterTags([]);

  const excludeRecipient = (phone: string) => {
    setExcludedPhones((prev) => new Set(prev).add(normalizePhoneForCompare(phone)));
  };

  const includeRecipient = (phone: string) => {
    setExcludedPhones((prev) => {
      const next = new Set(prev);
      next.delete(normalizePhoneForCompare(phone));
      return next;
    });
  };

  const addRecipient = () => {
    const p = addPhoneInput.trim();
    if (!p) return;
    if (customPhones.trim()) {
      addToCustomPhones(p);
    } else {
      if (extraPhones.includes(p)) return;
      setExtraPhones((prev) => [...prev, p]);
    }
    setAddPhoneInput("");
  };

  const removeExtraRecipient = (phone: string) => {
    setExtraPhones((prev) => prev.filter((x) => x !== phone));
  };

  const removeFromCustomPhones = (phone: string) => {
    const list = customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
    setCustomPhones(list.filter((p) => p !== phone).join("\n"));
  };

  const addToCustomPhones = (phone: string) => {
    const list = customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
    if (phone.trim() && !list.includes(phone.trim())) {
      setCustomPhones([...list, phone.trim()].join("\n"));
    }
  };

  const isExcluded = (phone: string) => excludedPhones.has(normalizePhoneForCompare(phone));

  const smsCharCount = messageText.length;
  const smsSegments = Math.ceil(smsCharCount / 160) || 0;

  const handleSubmitClick = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setResult(null);
    if (!tenantId || !messageText.trim()) {
      setError(t.errorRequired);
      return;
    }
    if (effectiveCount === 0) {
      setError(locale === "tr" ? "Gönderilecek alıcı yok." : "No recipients to send to.");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    if (!tenantId || !messageText.trim()) return;

    const phones = customPhones.trim()
      ? customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean)
      : excludedPhones.size > 0 || extraPhones.length > 0
        ? effectiveRecipients.map((r) => r.phone)
        : [];

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/campaigns/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_text: messageText.trim(),
          channel,
          recipient_phones: phones.length > 0 ? phones : undefined,
          filter_tags: phones.length === 0 && filterTags.length > 0 ? filterTags : undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success_count?: number;
        recipient_count?: number;
        error?: string;
        last_error?: string;
      };

      if (!res.ok) {
        setError(data.error || t.errorSend);
        return;
      }

      setResult({
        success_count: data.success_count ?? 0,
        recipient_count: data.recipient_count ?? 0,
        ...(data.last_error ? { last_error: data.last_error } : {}),
      });
      setMessageText("");
      loadHistory();
    } catch {
      setError(t.errorConnection);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (item: CampaignRecord) => {
    if (!tenantId || !window.confirm(t.confirmDelete)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/campaigns/history/${item.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || (locale === "tr" ? "Silinemedi" : "Delete failed"));
        return;
      }
      setHistory((prev) => prev.filter((h) => h.id !== item.id));
    } catch {
      setError(t.errorConnection);
    } finally {
      setDeletingId(null);
    }
  };

  const handleResend = async (item: CampaignRecord) => {
    if (!tenantId || !window.confirm(t.confirmResend)) return;
    setResendingId(item.id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/campaigns/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_text: item.message_text,
          channel: item.channel as "whatsapp" | "sms" | "both",
          filter_tags: (item.filter_tags || []).length > 0 ? item.filter_tags : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success_count?: number;
        recipient_count?: number;
        error?: string;
        last_error?: string;
      };
      if (!res.ok) {
        setError(data.error || t.errorSend);
        return;
      }
      setResult({
        success_count: data.success_count ?? 0,
        recipient_count: data.recipient_count ?? 0,
        ...(data.last_error ? { last_error: data.last_error } : {}),
      });
      loadHistory();
    } catch {
      setError(t.errorConnection);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32 sm:p-6 lg:p-10">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link
            href={tenantId ? `/dashboard/${tenantId}` : "/dashboard"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.backToPanel}
          </Link>
          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {t.title}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.subtitle}</p>
            </div>
          </div>
        </header>

        {campaignEnabled === null && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
            <LottieAnimationLazy src="loading" width={64} height={64} />
          </div>
        )}

        {campaignEnabled === false && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-950/40">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <Megaphone className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-amber-900 dark:text-amber-100">
              {t.contactUsMessage}
            </h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              {t.contactUsSubtext}
            </p>
          </div>
        )}

        {campaignEnabled !== false && (
        <form onSubmit={handleSubmitClick} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.recipients}</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.tagFilterHint}</p>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.channel}</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "whatsapp" as const, label: t.channelWhatsApp, icon: MessageCircle, color: "emerald" as const },
                  { value: "sms" as const, label: t.channelSms, icon: Smartphone, color: "blue" as const },
                  { value: "both" as const, label: t.channelBoth, icon: Send, color: "violet" as const },
                ].map(({ value, label, icon: Icon, color }) => {
                  const isActive = channel === value;
                  const colorClasses: Record<"emerald" | "blue" | "violet", string> = {
                    emerald: isActive
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/30 dark:border-emerald-500"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                    blue: isActive
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/30 dark:border-blue-500"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                    violet: isActive
                      ? "border-violet-500 bg-violet-50 ring-2 ring-violet-500/20 dark:bg-violet-950/30 dark:border-violet-500"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
                  };
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChannel(value)}
                      className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition-all duration-200 ${colorClasses[color]}`}
                    >
                      <Icon
                        className={`h-6 w-6 shrink-0 ${isActive ? (value === "whatsapp" ? "text-[#25D366]" : value === "sms" ? "text-blue-600 dark:text-blue-400" : "text-violet-600 dark:text-violet-400") : "text-slate-500 dark:text-slate-400"}`}
                      />
                      <span className={`text-xs font-semibold ${isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/80 px-5 py-4 dark:border-slate-700 dark:from-slate-800/50 dark:to-slate-900/50">
              {loading ? (
                <div className="flex items-center gap-3">
                  <LottieAnimationLazy src="loading" width={48} height={48} />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.loadingRecipients}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {effectiveCount.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t.recipientCount}
                        {customPhones.trim() && (
                          <span className="ml-1 text-xs text-slate-500">
                            • {locale === "tr" ? "özel liste" : "custom list"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {effectiveCount > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                        {locale === "tr" ? "Hazır" : "Ready"}
                      </span>
                    )}
                    {effectiveCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowRecipientsModal(true)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                      >
                        {t.viewRecipients}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.tagFilter}</label>
                {recipientInfo && recipientInfo.all_tags.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllTags}
                      className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {t.selectAll}
                    </button>
                    {filterTags.length > 0 && (
                      <button
                        type="button"
                        onClick={clearTags}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      >
                        {t.clearTags}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {loading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loadingTags}
                </div>
              ) : recipientInfo && recipientInfo.all_tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recipientInfo.all_tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                        filterTags.includes(tag)
                          ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.noTags}</p>
              )}
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.customPhones}</label>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{t.customPhonesHint}</p>
              <textarea
                value={customPhones}
                onChange={(e) => setCustomPhones(e.target.value)}
                placeholder="+905551234567, +905559876543"
                rows={2}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.campaignMessage}</h2>
                  {(channel === "sms" || channel === "both") && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {smsCharCount} {t.charsSms.replace("{n}", String(smsSegments))}
                    </p>
                  )}
                </div>
              </div>
              {(channel === "sms" || channel === "both") && smsCharCount > 0 && (
                <div className="shrink-0">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (smsCharCount / 480) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {smsSegments} {locale === "tr" ? "SMS" : "SMS"}
                  </p>
                </div>
              )}
            </div>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t.messagePlaceholder}
              rows={5}
              autoComplete="off"
              required
              className="w-full resize-y min-h-[120px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </section>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-4 rounded-xl border px-5 py-4 text-sm transition-all ${
                  result.success_count > 0
                    ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/50 text-emerald-800 dark:border-emerald-800 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:text-emerald-200"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${result.success_count > 0 ? "bg-emerald-200/80 dark:bg-emerald-800/50" : "bg-amber-200/80 dark:bg-amber-800/50"}`}>
                  {result.success_count > 0 ? (
                    <LottieAnimationLazy src="success" width={48} height={48} loop={false} />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">
                    {t.resultSuccess.replace("{success}", String(result.success_count)).replace("{total}", String(result.recipient_count))}
                  </p>
                  {result.success_count > 0 && (
                    <p className="mt-0.5 text-xs opacity-90">
                      {locale === "tr" ? "Kampanya başarıyla gönderildi" : "Campaign sent successfully"}
                    </p>
                  )}
                </div>
              </div>
              {result.success_count === 0 && result.last_error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  <span className="font-medium">{t.resultReason}</span>
                  <span>{result.last_error}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={sending || !messageText.trim() || effectiveCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700 hover:shadow-slate-900/30 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:shadow-emerald-500/25 dark:hover:bg-emerald-400 dark:hover:shadow-emerald-500/30"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.sending}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t.send}
                </>
              )}
            </button>
          </div>
        </form>
        )}

        {campaignEnabled !== false && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.historyTitle}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {locale === "tr" ? "Son gönderilen kampanyalar" : "Recently sent campaigns"}
                </p>
              </div>
            </div>
          </div>
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LottieAnimationLazy src="loading" width={64} height={64} />
            </div>
          ) : historyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 dark:border-slate-700">
              <LottieAnimationLazy src="empty" width={80} height={80} />
              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">{t.historyEmpty}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {locale === "tr" ? "İlk kampanyanızı gönderin" : "Send your first campaign"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const chLabel = getChannelLabel(item.channel, t);
                const channelBadges: Record<string, string> = {
                  whatsapp: "bg-[#25D366]/15 text-[#25D366] dark:bg-[#25D366]/20",
                  sms: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                  both: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
                };
                const channelBadge = channelBadges[item.channel] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
                  >
                    <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-200">{item.message_text}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${channelBadge}`}>
                          {chLabel}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {item.success_count}/{item.recipient_count} {t.recipientCount}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          • {formatDate(item.created_at, locale)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleResend(item)}
                          disabled={!!resendingId || !!deletingId}
                          title={t.resend}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          {resendingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={!!resendingId || !!deletingId}
                          title={t.delete}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {campaignEnabled !== false && (
      <div className="fixed inset-x-3 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 sm:hidden">
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={sending || !messageText.trim() || effectiveCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition active:scale-[0.98] hover:bg-slate-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.sending}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t.send}
            </>
          )}
        </button>
      </div>
        )}

      {showRecipientsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowRecipientsModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipients-modal-title"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                  <Users className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <h2 id="recipients-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {t.recipientListTitle}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {effectiveCount} {t.recipientCount}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecipientsModal(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={t.closeRecipients}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={addPhoneInput}
                  onChange={(e) => setAddPhoneInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                  placeholder={t.addRecipientPlaceholder}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addRecipient}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" />
                  {t.addRecipient}
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                {effectiveRecipients.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">{t.recipientListEmpty}</p>
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                    {effectiveRecipients.map(({ phone, name }) => {
                      const handleRemove = customPhones.trim()
                        ? () => removeFromCustomPhones(phone)
                        : baseRecipientsFromApi.some((r) => normalizePhoneForCompare(r.phone) === normalizePhoneForCompare(phone))
                          ? () => excludeRecipient(phone)
                          : () => removeExtraRecipient(phone);
                      return (
                        <li
                          key={phone}
                          className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-slate-800 dark:text-slate-200">{phone}</span>
                            {name && (
                              <span className="ml-2 text-slate-500 dark:text-slate-400">{name}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleRemove}
                            className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                            title={t.removeRecipient}
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                <Megaphone className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <h3 id="confirm-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.confirmTitle}</h3>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  {t.confirmMessage.replace("{count}", String(effectiveCount))}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t.confirmCancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={sending}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.sending}
                  </span>
                ) : (
                  t.confirmSend
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
