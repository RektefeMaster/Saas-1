"use client";

import { useEffect, useState } from "react";
import { Megaphone, Send, Users, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
}

interface RecipientInfo {
  count: number;
  all_tags: string[];
}

export default function CampaignsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "both">("whatsapp");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [customPhones, setCustomPhones] = useState("");
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success_count: number; recipient_count: number; last_error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTenants(list);
        const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tenant_id") : null;
        if (fromUrl && list.some((t: Tenant) => t.id === fromUrl)) setTenantId(fromUrl);
        else if (list.length > 0 && !tenantId) setTenantId(list[0].id);
      })
      .catch(() => setTenants([]));
  }, []);

  useEffect(() => {
    if (!tenantId) {
      setRecipientInfo(null);
      return;
    }
    setLoading(true);
    const tags = filterTags.length ? `?tags=${filterTags.join(",")}` : "";
    fetch(`/api/admin/campaigns/recipients?tenant_id=${tenantId}${tags}`)
      .then((r) => r.json())
      .then((data) => {
        setRecipientInfo({
          count: data.count ?? 0,
          all_tags: data.all_tags ?? [],
        });
      })
      .catch(() => setRecipientInfo(null))
      .finally(() => setLoading(false));
  }, [tenantId, filterTags.join(",")]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!tenantId || !messageText.trim()) {
      setError("İşletme seçin ve mesaj yazın.");
      return;
    }

    const phones = customPhones.trim()
      ? customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean)
      : [];

    setSending(true);
    try {
      const res = await fetch("/api/admin/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          message_text: messageText.trim(),
          channel,
          recipient_phones: phones.length > 0 ? phones : undefined,
          filter_tags: filterTags.length > 0 ? filterTags : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        success_count?: number;
        recipient_count?: number;
        error?: string;
        last_error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Gönderim başarısız");
        return;
      }
      setResult({
        success_count: data.success_count ?? 0,
        recipient_count: data.recipient_count ?? 0,
        ...(data.last_error ? { last_error: data.last_error } : {}),
      });
      setMessageText("");
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setSending(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Kampanya Mesajları
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          İşletme müşterilerine toplu veya tek tek WhatsApp/SMS mesajı gönderin. Sadece admin panelinden kullanılır.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Users className="h-4 w-4" />
            İşletme ve Alıcılar
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                İşletme
              </label>
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                required
              >
                <option value="">Seçin</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.tenant_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Gönderim kanalı
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as "whatsapp" | "sms" | "both")}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="both">WhatsApp + SMS (WhatsApp yoksa SMS)</option>
              </select>
            </div>
          </div>

          {tenantId && (
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
                Alıcı filtrele (opsiyonel)
              </label>
              <p className="mb-2 text-xs text-slate-500">
                Tüm müşteriler yerine sadece belirli etiketli müşterilere gönder
              </p>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Alıcılar yükleniyor…
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
                <p className="text-xs text-slate-500">Henüz CRM etiketi yok</p>
              )}
              <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                {recipientInfo ? `${recipientInfo.count} alıcı` : "—"}
              </p>
            </div>
          )}

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400">
              Özel numara listesi (opsiyonel)
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Boş bırakırsanız işletmenin tüm CRM ve randevu müşterilerine gider. Virgül, noktalı virgül veya satırla ayırın.
            </p>
            <textarea
              value={customPhones}
              onChange={(e) => setCustomPhones(e.target.value)}
              placeholder="+905551234567, +905559876543"
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Megaphone className="h-4 w-4" />
            Mesaj
          </h2>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Kampanya mesajı buraya yazın…"
            rows={5}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            required
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${result.success_count > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}`}>
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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !tenantId || !messageText.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-600"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gönderiliyor…
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
