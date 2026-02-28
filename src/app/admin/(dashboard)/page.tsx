"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BusinessType {
  id: string;
  name: string;
  slug: string;
  flow_type: string;
}

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
  status: string;
  business_types: { name: string } | null;
}

export default function AdminPage() {
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [btRes, tRes] = await Promise.all([
        fetch("/api/admin/business-types"),
        fetch("/api/admin/tenants"),
      ]);

      if (!btRes.ok) {
        const btErr = await btRes.json().catch(() => ({}));
        throw new Error(btErr.error || "Veri yüklenemedi");
      }
      if (!tRes.ok) {
        const tErr = await tRes.json().catch(() => ({}));
        throw new Error(tErr.error || "Veri yüklenemedi");
      }

      const btData = await btRes.json();
      const tData = await tRes.json();
      setBusinessTypes(Array.isArray(btData) ? btData : []);
      setTenants(Array.isArray(tData) ? tData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setBusinessTypes([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-600">
          İşletme tipleri ve kiracıları yönetin
        </p>
      </header>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-medium text-red-800">{error}</p>
          <button
            onClick={fetchData}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Tekrar dene
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">İşletme Tipleri</h2>
            <Link
              href="/admin/business-types/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Ekle
            </Link>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
            ) : businessTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-base font-medium text-slate-800">Liste boş</p>
                <p className="mt-2 text-sm text-slate-600">Yeni işletme tipi ekleyerek başlayın</p>
                <Link
                  href="/admin/business-types/new"
                  className="mt-4 rounded-lg border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Ekle
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {businessTypes.map((bt) => (
                  <li
                    key={bt.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{bt.name}</span>
                      <span className="ml-2 rounded bg-slate-300 px-2 py-0.5 text-xs font-medium text-slate-800">
                        {bt.flow_type}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-600" title="Tanım">
                      {bt.slug}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Kiracılar</h2>
            <Link
              href="/admin/tenants/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Ekle
            </Link>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-base font-medium text-slate-800">Liste boş</p>
                <p className="mt-2 text-sm text-slate-600">Yeni kiracı ekleyerek başlayın</p>
                <Link
                  href="/admin/tenants/new"
                  className="mt-4 rounded-lg border-2 border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Ekle
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {tenants.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{t.name}</span>
                      <span className="ml-2 font-mono text-sm font-medium text-slate-700">
                        {t.tenant_code}
                      </span>
                      <span className="ml-2 text-sm text-slate-600">
                        • {t.business_types?.name || "—"}
                      </span>
                    </div>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Düzenle
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
