"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Megaphone,
  QrCode,
  Trash2,
  UserRoundCog,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
  status: string;
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
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/tenants/${id}`).then((response) => response.json()),
      fetch(`/api/tenant/${id}/assets`).then((response) => response.json()),
    ])
      .then(([tenantData, assetsData]) => {
        if (!tenantData.error) setTenant(tenantData);
        if (!assetsData.error) setAssets(assetsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

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
            <Link
              href={`/admin/campaigns?tenant_id=${tenant.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-900/50"
            >
              <Megaphone className="h-4 w-4" />
              Kampanya Gönder
            </Link>
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

      <section className="grid gap-4 md:grid-cols-3">
        <a
          href={`${baseUrl}/t/${tenant.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Public Link
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">İşletme giriş URL’i</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">`/t/{tenant.id}`</p>
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
