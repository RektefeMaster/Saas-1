"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  Megaphone,
  Send,
  Users,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";

interface RecipientInfo {
  count: number;
  all_tags: string[];
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
    title: "Kampanyalar",
    subtitle: "Müşterilerinize toplu WhatsApp veya SMS kampanya mesajı gönderin.",
    backToPanel: "Panele Dön",
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
    tagFilterHint: "Seçili etiketlerden en az birine sahip müşterilere gönderilir",
    loadingTags: "Etiketler yükleniyor...",
    noTags: "Henüz etiket yok.",
    selectAll: "Tümünü seç",
    clearTags: "Temizle",
    customPhones: "Özel numara listesi (opsiyonel)",
    customPhonesHint: "Boş bırakırsanız CRM ve randevu müşterilerine gönderilir. Virgül veya satır ile ayırın.",
    campaignMessage: "Kampanya Mesajı",
    messagePlaceholder: "Kampanya mesajını yazın...",
    charsSms: "karakter (~{n} SMS)",
    confirmTitle: "Kampanyayı Gönder",
    confirmMessage: "{count} alıcıya bu mesaj gönderilecek. Emin misiniz?",
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
  },
  en: {
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
  },
} as const;

function getChannelLabel(channel: string, t: (typeof COPY)["tr"]): string {
  if (channel === "whatsapp") return t.channelWhatsAppShort;
  if (channel === "sms") return t.channelSmsShort;
  if (channel === "both") return t.channelBothShort;
  return channel;
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

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  const loadRecipients = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    const tags = filterTags.length ? `?tags=${encodeURIComponent(filterTags.join(","))}` : "";
    fetch(`/api/tenant/${tenantId}/campaigns/recipients${tags}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setError(null);
        setRecipientInfo({
          count: data.count ?? 0,
          all_tags: data.all_tags ?? [],
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
      .then((res) => res.json())
      .then((data) => {
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
    if (!showConfirm) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConfirm(false);
    };
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [showConfirm]);

  const effectiveCount = customPhones.trim()
    ? customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean).length
    : (recipientInfo?.count ?? 0);

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const selectAllTags = () => {
    if (recipientInfo?.all_tags.length) {
      setFilterTags(recipientInfo.all_tags);
    }
  };

  const clearTags = () => setFilterTags([]);

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
          filter_tags: filterTags.length > 0 ? filterTags : undefined,
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-32 sm:p-6 lg:p-10">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link
            href={tenantId ? `/dashboard/${tenantId}` : "/dashboard"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.backToPanel}
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t.subtitle}</p>
        </header>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t.channel}</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "whatsapp" | "sms" | "both")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-300/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="whatsapp">{t.channelWhatsApp}</option>
                  <option value="sms">{t.channelSms}</option>
                  <option value="both">{t.channelBoth}</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.loadingRecipients}
                    </span>
                  ) : (
                    <>
                      {effectiveCount} {t.recipientCount}
                      {customPhones.trim() && (
                        <span className="ml-1 text-xs text-slate-500">
                          ({locale === "tr" ? "özel liste" : "custom list"})
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
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
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        filterTags.includes(tag)
                          ? "bg-emerald-600 text-white dark:bg-emerald-500"
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
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                  result.success_count > 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                }`}
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  {t.resultSuccess.replace("{success}", String(result.success_count)).replace("{total}", String(result.recipient_count))}
                </span>
              </div>
              {result.success_count === 0 && result.last_error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {t.resultReason} {result.last_error}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={sending || !messageText.trim() || effectiveCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.historyTitle}</h2>
            </div>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : historyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t.historyEmpty}</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30"
                >
                  <p className="line-clamp-2 text-sm text-slate-800 dark:text-slate-200">{item.message_text}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t.historyItem
                      .replace("{success}", String(item.success_count))
                      .replace("{total}", String(item.recipient_count))
                      .replace("{channel}", getChannelLabel(item.channel, t))
                      .replace("{date}", formatDate(item.created_at, locale))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(5.1rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 sm:hidden">
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={sending || !messageText.trim() || effectiveCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
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

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.confirmTitle}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t.confirmMessage.replace("{count}", String(effectiveCount))}
            </p>
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
  );
}
