"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CircleAlert,
  Filter,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

interface BusinessType {
  id: string;
  name: string;
  slug: string;
  flow_type: string;
  bot_config?: Record<string, unknown> | null;
}

const FLOW_LABELS: Record<string, string> = {
  appointment: "Randevu",
  appointment_with_extras: "Randevu + Ek Bilgiler",
  order: "Sipariş",
  reservation: "Rezervasyon",
  hybrid: "Hibrit",
};

const FLOW_COLORS: Record<string, string> = {
  appointment: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  appointment_with_extras: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  order: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  reservation: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  hybrid: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export default function BusinessTypesListPage() {
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [flowFilter, setFlowFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BusinessType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/business-types");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Veri yüklenemedi");
      }
      const data = await res.json();
      setBusinessTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setBusinessTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(
    () =>
      businessTypes.filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.slug.toLowerCase().includes(search.toLowerCase());
        const matchesFlow = flowFilter ? item.flow_type === flowFilter : true;
        return matchesSearch && matchesFlow;
      }),
    [businessTypes, flowFilter, search]
  );

  const uniqueFlows = useMemo(
    () => Array.from(new Set(businessTypes.map((item) => item.flow_type))),
    [businessTypes]
  );

  const withBotConfig = businessTypes.filter(
    (item) => item.bot_config && Object.keys(item.bot_config).length > 0
  ).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/business-types/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(
          data.error || "Silme işlemi başarısız oldu"
        );
        return;
      }
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteModal = () => {
    if (!deleting) {
      setDeleteTarget(null);
      setDeleteError(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">İşletme Tipleri</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Sektör kategorileri ve bot akışları</p>
        </div>
        <Link
          href="/admin/business-types/new"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          Yeni Tip
        </Link>
      </header>

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Toplam
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {businessTypes.length}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Akış Türü
          </p>
          <p className="mt-2 text-2xl font-bold text-cyan-700 dark:text-cyan-300">
            {uniqueFlows.length}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bot ayarlı
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {withBotConfig}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bot ayarsız
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300">
            {Math.max(businessTypes.length - withBotConfig, 0)}
          </p>
        </article>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="İsim veya slug ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-400"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={flowFilter}
              onChange={(e) => setFlowFilter(e.target.value)}
              className="min-w-[140px] bg-transparent outline-none"
            >
              <option value="">Tüm akışlar</option>
              {uniqueFlows.map((flow) => (
                <option key={flow} value={flow}>
                  {FLOW_LABELS[flow] ?? flow}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Table / Cards */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="space-y-0 divide-y divide-slate-200 dark:divide-slate-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
              <LayoutGrid className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {search || flowFilter ? "Aramanıza uygun tip bulunamadı" : "Henüz işletme tipi yok"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search || flowFilter
                ? "Filtreleri güncelleyip tekrar deneyin."
                : "Yeni bir işletme tipi oluşturarak başlayabilirsiniz."}
            </p>
            {!search && !flowFilter && (
              <Link
                href="/admin/business-types/new"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                <Plus className="h-4 w-4" />
                İşletme tipi ekle
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-5 py-3 font-semibold">İsim</th>
                    <th className="px-5 py-3 font-semibold">Slug</th>
                    <th className="px-5 py-3 font-semibold">Akış Tipi</th>
                    <th className="px-5 py-3 font-semibold">Bot Config</th>
                    <th className="px-5 py-3 text-right font-semibold">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {item.slug}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                            FLOW_COLORS[item.flow_type] ?? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {FLOW_LABELS[item.flow_type] ?? item.flow_type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {item.bot_config && Object.keys(item.bot_config).length > 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Var
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            Yok
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/business-types/${item.id}/edit`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Düzenle
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {filtered.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {item.slug}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                          FLOW_COLORS[item.flow_type] ?? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {FLOW_LABELS[item.flow_type] ?? item.flow_type}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/admin/business-types/${item.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white dark:bg-emerald-500 dark:text-slate-950"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Düzenle
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.bot_config && Object.keys(item.bot_config).length > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {item.bot_config && Object.keys(item.bot_config).length > 0 ? "Bot Config Var" : "Bot Config Yok"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Delete Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={closeDeleteModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 id="delete-modal-title" className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">
              İşletme tipini sil
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <strong>{deleteTarget.name}</strong> ({deleteTarget.slug}) veritabanından kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              Bu tipi kullanan işletme varsa silme işlemi yapılamaz.
            </p>
            {deleteError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <CircleAlert className="h-4 w-4 shrink-0" />
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Siliniyor…" : "Kalıcı olarak sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
