"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TenantItem {
  id: string;
  name: string;
  tenant_code: string;
  whatsapp_link: string;
}

export default function IsletmelerPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/tenants")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setTenants(data) : setTenants([])))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-slate-900">
            SaaSRandevu
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-slate-800">
            Randevu alabileceğiniz işletmeler
          </h1>
          <p className="mt-2 text-slate-600">
            İşletmeyi seçip WhatsApp üzerinden randevu alın
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-slate-600">Henüz kayıtlı işletme yok</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tenants.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300"
              >
                <div>
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="ml-2 font-mono text-sm text-slate-500">
                    {t.tenant_code}
                  </span>
                </div>
                <a
                  href={t.whatsapp_link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  WhatsApp ile Randevu Al
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-700">
            ← Ana sayfaya dön
          </Link>
        </p>
      </div>
    </div>
  );
}
