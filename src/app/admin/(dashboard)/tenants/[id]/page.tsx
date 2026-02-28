"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/tenants/${id}`).then((r) => r.json()),
      fetch(`${baseUrl}/api/tenant/${id}/assets`).then((r) => r.json()),
    ])
      .then(([tenantData, assetsData]) => {
        if (!tenantData.error) setTenant(tenantData);
        if (!assetsData.error) setAssets(assetsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, baseUrl]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async () => {
    if (!confirm("Bu kiracıyı silmek istediğinize emin misiniz?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${id}?soft=true`, {
        method: "DELETE",
      });
      if (res.ok) router.push("/admin");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Link
            href="/admin"
            className="mb-6 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            ← Admin&apos;e dön
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
            <p className="mt-1 text-slate-600">
              Kod: <span className="font-mono font-medium">{tenant.tenant_code}</span> •
              {tenant.business_types?.name || "Tip belirtilmemiş"}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={`${baseUrl}/dashboard/${tenant.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-700"
              >
                <span>📅</span> Takvim
              </a>
              <a
                href={`${baseUrl}/t/${tenant.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>💬</span> WhatsApp Link
              </a>
              <a
                href={`${baseUrl}/api/tenant/${tenant.id}/qr`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>📱</span> QR Kod
              </a>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-5 py-3 font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Sil
              </button>
            </div>

            {assets && (
              <div className="mt-8 border-t border-slate-200 pt-8">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Paylaşım Paketi</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">WhatsApp linki</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={assets.whatsapp_link}
                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(assets.whatsapp_link, "link")}
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                      >
                        {copied === "link" ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">QR kod (PNG)</label>
                    <a
                      href={`data:image/png;base64,${assets.qr_base64_png}`}
                      download={`${tenant.tenant_code}-qr.png`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      PNG İndir
                    </a>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Instagram biyografi metni</label>
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={assets.instagram_bio}
                        rows={4}
                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(assets.instagram_bio, "ig")}
                        className="h-fit rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                      >
                        {copied === "ig" ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-600">Google Maps açıklama metni</label>
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={assets.google_maps_description}
                        rows={3}
                        className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(assets.google_maps_description, "gm")}
                        className="h-fit rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                      >
                        {copied === "gm" ? "Kopyalandı" : "Kopyala"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
    </>
  );
}
