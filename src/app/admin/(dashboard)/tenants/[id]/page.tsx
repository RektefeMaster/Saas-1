"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarPlus2,
  Copy,
  ExternalLink,
  Link2,
  Megaphone,
  QrCode,
  Trash2,
  UserRoundCog,
  Loader2,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
  status: string;
  campaign_enabled?: boolean;
  subscription_end_at?: string | null;
  subscription_plan?: string | null;
  business_types: { name: string } | null;
}

interface SharePackage {
  whatsapp_link: string;
  qr_base64_png: string;
  instagram_bio: string;
  google_maps_description: string;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [assets, setAssets] = useState<SharePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [campaignEnabled, setCampaignEnabled] = useState<boolean>(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState("starter");
  const [subscriptionEndAt, setSubscriptionEndAt] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicExpiresIn, setMagicExpiresIn] = useState("7d");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [opsMessage, setOpsMessage] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/tenants/${id}`).then((response) => response.json()),
      fetch(`/api/tenant/${id}/assets`).then((response) => response.json()),
    ])
      .then(([tenantData, assetsData]) => {
        if (!tenantData.error) {
          setTenant(tenantData);
          setCampaignEnabled(tenantData.campaign_enabled !== false);
          setSubscriptionPlan(tenantData.subscription_plan || "starter");
          setSubscriptionEndAt(tenantData.subscription_end_at || null);
        }
        if (!assetsData.error) setAssets(assetsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleCampaignToggle = async () => {
    if (!tenant) return;
    setSavingCampaign(true);
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_enabled: !campaignEnabled }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi");
      setCampaignEnabled(!campaignEnabled);
      setTenant((prev) => (prev ? { ...prev, campaign_enabled: !campaignEnabled } : null));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Kampanya ayarı güncellenemedi");
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleExtendSubscription = async (action: "1w" | "1m") => {
    setOpsMessage(null);
    setSubscriptionLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${id}/extend-subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subscription_plan: subscriptionPlan,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        subscription_end_at?: string | null;
        subscription_plan?: string | null;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Abonelik uzatilamadi");
      }
      setSubscriptionEndAt(payload.subscription_end_at || null);
      if (payload.subscription_plan) setSubscriptionPlan(payload.subscription_plan);
      setOpsMessage(
        action === "1w" ? "Abonelik 1 hafta uzatildi." : "Abonelik 1 ay uzatildi."
      );
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Abonelik uzatma islemi basarisiz"
      );
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleCreateMagicLink = async () => {
    setOpsMessage(null);
    setMagicLinkLoading(true);
    setMagicLink(null);
    try {
      const res = await fetch(`/api/admin/tenants/${id}/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expires_in: magicExpiresIn,
          purpose: "tenant_public_link",
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        magic_url?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Magic link olusturulamadi");
      }
      if (payload.magic_url) {
        setMagicLink(payload.magic_url);
        setOpsMessage("Magic link olusturuldu.");
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Magic link olusturulamadi");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async () => {
    if (!confirm("Bu işletmeyi silmek istediğinize emin misiniz?")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/tenants/${id}?soft=false&purge_auth=true`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        auth_delete_warning?: string | null;
      };
      if (!res.ok) {
        throw new Error(payload.error || "İşletme silinemedi");
      }
      if (payload.auth_delete_warning) {
        setDeleteError(
          `İşletme silindi ancak auth kullanıcı silinemedi: ${payload.auth_delete_warning}`
        );
      }
      router.push("/admin/tenants");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "İşletme silinemedi");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        İşletmeler listesine dön
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <UserRoundCog className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
              İşletme Detayı
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {tenant.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Kod: <span className="font-mono font-semibold">{tenant.tenant_code}</span>
              {tenant.business_types?.name ? ` · ${tenant.business_types.name}` : ""}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kampanya Gönderimi</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {campaignEnabled ? "İşletme kampanya gönderebilir" : "Kısıtlı — iletişime geçin mesajı gösterilir"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCampaignToggle}
                  disabled={savingCampaign}
                  className={`relative inline-flex h-8 w-12 shrink-0 items-center rounded-full transition-colors ${
                    campaignEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                      campaignEnabled ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                  {savingCampaign && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </span>
                  )}
                </button>
              </div>
              <Link
                href={`/admin/campaigns?tenant_id=${tenant.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-900/50"
              >
                <Megaphone className="h-4 w-4" />
                Kampanya Gönder
              </Link>
            </div>
            <a
              href={`${baseUrl}/dashboard/${tenant.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              Takvime Git
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Siliniyor..." : "İşletmeyi Sil"}
            </button>
          </div>
        </div>
        {deleteError && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
            {deleteError}
          </p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <CalendarPlus2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            Abonelik Uzatma
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tenant aboneligini hizli uzatmak icin kullanin.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Plan
              <select
                value={subscriptionPlan}
                onChange={(event) => setSubscriptionPlan(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="starter">starter</option>
                <option value="growth">growth</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Bitis
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {subscriptionEndAt
                  ? new Date(subscriptionEndAt).toLocaleString("tr-TR")
                  : "Tanimsiz"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleExtendSubscription("1w")}
              disabled={subscriptionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              {subscriptionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              +1 Hafta
            </button>
            <button
              type="button"
              onClick={() => handleExtendSubscription("1m")}
              disabled={subscriptionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-300"
            >
              {subscriptionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              +1 Ay
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Link2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            Magic Link
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tek kullanimlik baglanti olusturup tenanta iletebilirsiniz.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={magicExpiresIn}
              onChange={(event) => setMagicExpiresIn(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="15m">15 dakika</option>
              <option value="1h">1 saat</option>
              <option value="1d">1 gun</option>
              <option value="7d">7 gun</option>
            </select>
            <button
              type="button"
              onClick={handleCreateMagicLink}
              disabled={magicLinkLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {magicLinkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Magic Link Uret
            </button>
          </div>
          {magicLink && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={magicLink}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(magicLink, "magic")}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Copy className="h-4 w-4" />
                {copied === "magic" ? "Kopyalandi" : "Kopyala"}
              </button>
            </div>
          )}
        </article>
      </section>

      {opsMessage && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {opsMessage}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <a
          href={assets?.whatsapp_link || `${baseUrl}/t/${tenant.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            WhatsApp Link
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Doğrudan WhatsApp URL’i</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">wa.me üzerinden direkt sohbet açılır</p>
        </a>
        <a
          href={`${baseUrl}/api/tenant/${tenant.id}/qr`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            QR Servisi
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <QrCode className="h-4 w-4" />
            PNG / SVG Üret
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Anlık QR üretim endpoint’i</p>
        </a>
        <a
          href={`${baseUrl}/dashboard/${tenant.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Operasyon Paneli
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">İşletme dashboard</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Randevu, CRM ve akış yönetimi</p>
        </a>
      </section>

      {assets && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Paylaşım Paketi</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            İşletmenin WhatsApp ve sosyal medya paylaşım metinlerini buradan kopyalayabilirsiniz.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">WhatsApp linki</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={assets.whatsapp_link}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(assets.whatsapp_link, "link")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Copy className="h-4 w-4" />
                  {copied === "link" ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">QR kod (PNG)</label>
              <a
                href={`data:image/png;base64,${assets.qr_base64_png}`}
                download={`${tenant.tenant_code}-qr.png`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <QrCode className="h-4 w-4" />
                PNG İndir
              </a>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Instagram biyografi metni</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  readOnly
                  value={assets.instagram_bio}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(assets.instagram_bio, "ig")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Copy className="h-4 w-4" />
                  {copied === "ig" ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Google Maps açıklama metni</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  readOnly
                  value={assets.google_maps_description}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(assets.google_maps_description, "gm")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Copy className="h-4 w-4" />
                  {copied === "gm" ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
