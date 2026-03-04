"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Megaphone,
  Send,
  Users,
} from "lucide-react";

interface RecipientInfo {
  count: number;
  all_tags: string[];
}

export default function CampaignsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const [tenantId, setTenantId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "both">("whatsapp");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [customPhones, setCustomPhones] = useState("");
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success_count: number;
    recipient_count: number;
    last_error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setTenantId(p.tenantId));
  }, [params]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const tags = filterTags.length ? `?tags=${encodeURIComponent(filterTags.join(","))}` : "";
    fetch(`/api/tenant/${tenantId}/campaigns/recipients${tags}`)
      .then((res) => res.json())
      .then((data) => {
        setRecipientInfo({
          count: data.count ?? 0,
          all_tags: data.all_tags ?? [],
        });
      })
      .catch(() => setRecipientInfo(null))
      .finally(() => setLoading(false));
  }, [tenantId, filterTags.join(",")]);

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!tenantId || !messageText.trim()) {
      setError("Mesaj metni zorunlu.");
      return;
    }

    const phones = customPhones.trim()
      ? customPhones
          .split(/[\n,;]+/)
          .map((phone) => phone.trim())
          .filter(Boolean)
      : [];

    setSending(true);
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
        setError(data.error || "Gönderim başarısız.");
        return;
      }

      setResult({
        success_count: data.success_count ?? 0,
        recipient_count: data.recipient_count ?? 0,
        ...(data.last_error ? { last_error: data.last_error } : {}),
      });
      setMessageText("");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 p-4 pb-28 sm:p-6 lg:p-8">
      <div className="space-y-3">
        <Link
          href={`/dashboard/${tenantId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Panele Dön
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Kampanyalar
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Müşterilerinize toplu WhatsApp/SMS kampanya mesajı gönderin.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Users className="h-4 w-4" />
            Alıcılar
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Gönderim kanalı
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as "whatsapp" | "sms" | "both")}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="both">WhatsApp + SMS (fallback)</option>
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
              {loading ? "Alıcılar yükleniyor..." : `${recipientInfo?.count || 0} alıcı`}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Etiket filtresi (opsiyonel)
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Etiketler yükleniyor...
              </div>
            ) : recipientInfo && recipientInfo.all_tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recipientInfo.all_tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      filterTags.includes(tag)
                        ? "bg-cyan-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Henüz etiket yok.</p>
            )}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Özel numara listesi (opsiyonel)
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Boş bırakırsanız CRM ve randevu müşterilerine gönderilir.
            </p>
            <textarea
              value={customPhones}
              onChange={(e) => setCustomPhones(e.target.value)}
              placeholder="+905551234567, +905559876543"
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Megaphone className="h-4 w-4" />
            Kampanya Mesajı
          </h2>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Kampanya mesajını yazın..."
            rows={5}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            required
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
                {result.success_count}/{result.recipient_count} alıcıya gönderildi
              </span>
            </div>
            {result.success_count === 0 && result.last_error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                Olası sebep: {result.last_error}
              </div>
            )}
          </div>
        )}

        <div className="hidden justify-end sm:flex">
          <button
            type="submit"
            disabled={sending || !messageText.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gönder
              </>
            )}
          </button>
        </div>

        <div className="fixed inset-x-3 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
          <button
            type="submit"
            disabled={sending || !messageText.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-700 disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gönder
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
