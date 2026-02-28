"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface BusinessType {
  id: string;
  name: string;
  slug: string;
}

export default function NewTenantPage() {
  const router = useRouter();
  const [types, setTypes] = useState<BusinessType[]>([]);
  const [name, setName] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [businessTypeId, setBusinessTypeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/business-types")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setTypes(data) : setTypes([])))
      .catch(() => setTypes([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          tenant_code: tenantCode,
          business_type_id: businessTypeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hata oluştu");
      router.push(`/admin/tenants/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kiracılar listesine dön
      </Link>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Yeni Kiracı</h1>
      <p className="mt-1.5 text-slate-600 dark:text-slate-400">
        İşletme bilgilerini girin
      </p>

      <form
            onSubmit={handleSubmit}
            className="mt-8 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  İşletme Adı
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="İşletme adı"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tenant Kodu
                </label>
                <input
                  type="text"
                  value={tenantCode}
                  onChange={(e) =>
                    setTenantCode(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="AHMET01"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  required
                />
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  QR ve WhatsApp için benzersiz kod
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  İşletme Tipi
                </label>
                <select
                  value={businessTypeId}
                  onChange={(e) => setBusinessTypeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                >
                  <option value="">Seçin</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {types.length === 0 && (
                    <option value="" disabled>
                      Önce işletme tipi tanımlayın
                    </option>
                  )}
                </select>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Oluşturuluyor..." : "Oluştur"}
              </button>
              <Link
                href="/admin/tenants"
                className="rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                İptal
              </Link>
            </div>
          </form>
    </div>
  );
}
