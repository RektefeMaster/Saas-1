"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CircleAlert,
  Filter,
  Plus,
  Search,
  Users,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
  status: string;
  business_types: { id: string; name: string; slug: string } | null;
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetchTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const url = `/api/admin/tenants${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Veri yüklenemedi");
      }
      const data = await res.json();
      setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [statusFilter]);

  const filtered = useMemo(
    () =>
      tenants.filter(
        (tenant) =>
          tenant.name.toLowerCase().includes(search.toLowerCase()) ||
          tenant.tenant_code.toLowerCase().includes(search.toLowerCase()) ||
          tenant.business_types?.name?.toLowerCase().includes(search.toLowerCase())
      ),
    [search, tenants]
  );

  const summary = useMemo(() => {
    const active = tenants.filter((tenant) => tenant.status === "active").length;
    const suspended = tenants.filter((tenant) => tenant.status === "suspended").length;
    return {
      total: tenants.length,
      active,
      suspended,
      inactive: Math.max(tenants.length - active - suspended, 0),
    };
  }, [tenants]);

  const statusBadge = (status: string) => {
    if (status === "active") {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    }
    if (status === "suspended") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    }
    return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  };

  const statusLabel = (status: string) =>
    status === "active" ? "Aktif" : status === "suspended" ? "Askıda" : "Pasif";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/60 to-slate-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-cyan-950/20 dark:to-slate-900 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <Building2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
              İşletme Yönetimi
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Tüm İşletmeler
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              İşletme kayıtlarını tek listede yönetin, filtreleyin ve hızlıca düzenleyin.
            </p>
          </div>
          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Yeni İşletme
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Toplam</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{summary.total}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktif</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{summary.active}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Askıda</p>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-300">{summary.suspended}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pasif</p>
          <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300">{summary.inactive}</p>
        </article>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="h-4 w-4" />
            {error}
          </p>
          <button
            type="button"
            onClick={fetchTenants}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Tekrar dene
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="İşletme adı, kodu veya tipi ile ara..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
              <option value="suspended">Askıda</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="space-y-0 divide-y divide-slate-200 dark:divide-slate-800">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="flex items-center justify-between px-5 py-4">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
              <Users className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {search || statusFilter ? "Filtreye uygun işletme bulunamadı" : "Henüz işletme yok"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search || statusFilter
                ? "Arama metnini veya filtreyi güncelleyip tekrar deneyin."
                : "Yeni işletme oluşturarak başlayabilirsiniz."}
            </p>
            {!search && !statusFilter && (
              <Link
                href="/admin/tenants/new"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <Plus className="h-4 w-4" />
                İşletme ekle
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-5 py-3 font-semibold">İşletme</th>
                    <th className="px-5 py-3 font-semibold">Kod</th>
                    <th className="px-5 py-3 font-semibold">İşletme Tipi</th>
                    <th className="px-5 py-3 font-semibold">Durum</th>
                    <th className="px-5 py-3 text-right font-semibold">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {tenant.name}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {tenant.tenant_code}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {tenant.business_types?.name || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge(tenant.status)}`}>
                          {statusLabel(tenant.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`${baseUrl}/dashboard/${tenant.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Takvim
                          </a>
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                          >
                            Düzenle
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {filtered.map((tenant) => (
                <article
                  key={tenant.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {tenant.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {tenant.tenant_code}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge(tenant.status)}`}>
                      {statusLabel(tenant.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {tenant.business_types?.name || "İşletme tipi tanımlı değil"}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={`${baseUrl}/dashboard/${tenant.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Takvim
                    </a>
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-slate-950"
                    >
                      Düzenle
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
