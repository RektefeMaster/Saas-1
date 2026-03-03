"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleDot,
  ClipboardList,
  Plus,
  RefreshCcw,
  Users,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";

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

interface Stats {
  tenants: number;
  businessTypes: number;
  appointmentsToday: number;
  appointmentsTotal: number;
  activeTenants: number;
}

const FLOW_LABELS: Record<string, string> = {
  appointment: "Randevu",
  appointment_with_extras: "Randevu + Ek",
  order: "Sipariş",
  reservation: "Rezervasyon",
  hybrid: "Hibrit",
};

const FLOW_LABELS_EN: Record<string, string> = {
  appointment: "Appointment",
  appointment_with_extras: "Appointment + Extras",
  order: "Order",
  reservation: "Reservation",
  hybrid: "Hybrid",
};

export default function AdminPage() {
  const { locale } = useLocale();
  const isTr = locale === "tr";
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [btRes, tRes, statsRes] = await Promise.all([
        fetch("/api/admin/business-types"),
        fetch("/api/admin/tenants"),
        fetch("/api/admin/stats"),
      ]);

      if (!btRes.ok) {
        const btErr = await btRes.json().catch(() => ({}));
        throw new Error(btErr.error || (isTr ? "İşletme tipleri alınamadı" : "Failed to load business types"));
      }
      if (!tRes.ok) {
        const tErr = await tRes.json().catch(() => ({}));
        throw new Error(tErr.error || (isTr ? "İşletmeler alınamadı" : "Failed to load businesses"));
      }

      const btData = await btRes.json();
      const tData = await tRes.json();
      const statsData = await statsRes.json().catch(() => null);
      setBusinessTypes(Array.isArray(btData) ? btData : []);
      setTenants(Array.isArray(tData) ? tData : []);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : isTr ? "Bir hata oluştu" : "An error occurred");
      setBusinessTypes([]);
      setTenants([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isTr]);

  const normalizedStats = useMemo<Stats>(() => {
    if (stats) return stats;
    const active = tenants.filter((tenant) => tenant.status === "active").length;
    return {
      tenants: tenants.length,
      businessTypes: businessTypes.length,
      appointmentsToday: 0,
      appointmentsTotal: 0,
      activeTenants: active,
    };
  }, [businessTypes.length, stats, tenants]);

  const statItems = [
    {
      label: isTr ? "Toplam İşletme" : "Total Businesses",
      value: normalizedStats.tenants,
      hint: isTr ? `${normalizedStats.activeTenants} aktif işletme` : `${normalizedStats.activeTenants} active businesses`,
      icon: Users,
      tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
    },
    {
      label: isTr ? "İşletme Tipi" : "Business Type",
      value: normalizedStats.businessTypes,
      hint: isTr ? "Tanımlı kategori" : "Defined category",
      icon: Building2,
      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    {
      label: isTr ? "Bugünkü Randevu" : "Appointments Today",
      value: normalizedStats.appointmentsToday,
      hint: isTr ? "Canlı günlük trafik" : "Live daily traffic",
      icon: CalendarClock,
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    {
      label: isTr ? "Toplam Randevu" : "Total Appointments",
      value: normalizedStats.appointmentsTotal,
      hint: isTr ? "Sistem genel hacim" : "System-wide volume",
      icon: ClipboardList,
      tone: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/60 to-emerald-50/70 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-cyan-950/20 dark:to-emerald-950/20 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <CircleDot className="h-3.5 w-3.5 text-emerald-500" />
              {isTr ? "Ahi AI Yönetim Merkezi" : "Ahi AI Control Center"}
            </p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              {isTr ? "Admin Paneli Genel Bakış" : "Admin Dashboard Overview"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
              {isTr
                ? "İşletme ekleme, tip yönetimi ve güvenlik durumunu tek panelden takip edin. Mobil ve masaüstünde aynı akışla hızlı işlem yapabilirsiniz."
                : "Track business onboarding, type management, and security from one panel. Keep the same fast flow on mobile and desktop."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/tenants/new"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              {isTr ? "Yeni İşletme" : "New Business"}
            </Link>
            <Link
              href="/admin/business-types/new"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isTr ? "İşletme Tipi Ekle" : "Add Business Type"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <RefreshCcw className="h-4 w-4" />
            {isTr ? "Tekrar dene" : "Retry"}
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {loading ? "…" : item.value}
                  </p>
                </div>
                <span className={`inline-flex rounded-xl p-2.5 ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isTr ? "İşletme Tipleri" : "Business Types"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{isTr ? "Aktif kategori özeti" : "Active category summary"}</p>
            </div>
            <Link
              href="/admin/business-types"
              className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              {isTr ? "Tümünü Gör" : "View All"}
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : businessTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{isTr ? "Henüz işletme tipi yok" : "No business type yet"}</p>
                <Link
                  href="/admin/business-types/new"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                >
                  <Plus className="h-4 w-4" />
                  {isTr ? "İlk tipi oluştur" : "Create first type"}
                </Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {businessTypes.slice(0, 6).map((bt) => (
                  <li
                    key={bt.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {bt.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                        {bt.slug}
                      </p>
                    </div>
                    <span className="ml-3 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {(isTr ? FLOW_LABELS : FLOW_LABELS_EN)[bt.flow_type] ?? bt.flow_type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{isTr ? "İşletmeler" : "Businesses"}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{isTr ? "Son kayıtlar ve durumlar" : "Latest records and statuses"}</p>
            </div>
            <Link
              href="/admin/tenants"
              className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              {isTr ? "Tümünü Gör" : "View All"}
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{isTr ? "Henüz işletme yok" : "No business yet"}</p>
                <Link
                  href="/admin/tenants/new"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                >
                  <Plus className="h-4 w-4" />
                  {isTr ? "İlk işletmeyi ekle" : "Add first business"}
                </Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {tenants.slice(0, 6).map((tenant) => (
                  <li
                    key={tenant.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {tenant.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                        {tenant.tenant_code}
                        {tenant.business_types?.name ? ` · ${tenant.business_types.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          tenant.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : tenant.status === "suspended"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {tenant.status === "active"
                          ? isTr
                            ? "Aktif"
                            : "Active"
                          : tenant.status === "suspended"
                            ? isTr
                              ? "Askıda"
                              : "Suspended"
                            : isTr
                              ? "Pasif"
                              : "Passive"}
                      </span>
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {isTr ? "Detay" : "Detail"}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
