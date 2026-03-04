"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  ClipboardList,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCcw,
  Shield,
  Star,
  Users,
  UserCircle,
  Wrench,
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
  crmCustomers?: number;
  campaignMessages?: number;
  services?: number;
  staff?: number;
  reviews?: number;
  recentAppointments?: Array<{
    id: string;
    tenant_id: string;
    slot_start: string;
    status: string;
    tenant_name?: string;
  }>;
  recentCampaigns?: Array<{
    id: string;
    tenant_id: string;
    success_count: number;
    recipient_count: number;
    created_at: string;
    tenant_name?: string;
  }>;
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

function formatRelativeTime(dateStr: string, isTr: boolean): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return isTr ? "Az önce" : "Just now";
  if (diffMins < 60) return isTr ? `${diffMins} dk önce` : `${diffMins}m ago`;
  if (diffHours < 24) return isTr ? `${diffHours} saat önce` : `${diffHours}h ago`;
  if (diffDays < 7) return isTr ? `${diffDays} gün önce` : `${diffDays}d ago`;
  return d.toLocaleDateString();
}

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
      const statsData = statsRes.ok ? await statsRes.json().catch(() => null) : null;
      setBusinessTypes(Array.isArray(btData) ? btData : []);
      setTenants(Array.isArray(tData) ? tData : []);
      setStats(statsData && !("error" in (statsData || {})) ? statsData : null);
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
    if (stats && !("error" in stats) && typeof stats.tenants === "number") return stats;
    const active = tenants.filter((t) => t.status === "active").length;
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
      hint: isTr ? `${normalizedStats.activeTenants} aktif` : `${normalizedStats.activeTenants} active`,
      icon: Users,
      tone: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
      href: "/admin/tenants",
    },
    {
      label: isTr ? "İşletme Tipi" : "Business Type",
      value: normalizedStats.businessTypes,
      hint: isTr ? "Kategori" : "Category",
      icon: Building2,
      tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      href: "/admin/business-types",
    },
    {
      label: isTr ? "Bugünkü Randevu" : "Appointments Today",
      value: normalizedStats.appointmentsToday,
      hint: isTr ? "Canlı trafik" : "Live traffic",
      icon: CalendarClock,
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      href: null,
    },
    {
      label: isTr ? "Toplam Randevu" : "Total Appointments",
      value: normalizedStats.appointmentsTotal,
      hint: isTr ? "Sistem hacmi" : "System volume",
      icon: ClipboardList,
      tone: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
      href: null,
    },
    {
      label: isTr ? "CRM Müşteri" : "CRM Customers",
      value: normalizedStats.crmCustomers ?? 0,
      hint: isTr ? "Tüm işletmeler" : "All businesses",
      icon: UserCircle,
      tone: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
      href: null,
    },
    {
      label: isTr ? "Kampanya" : "Campaigns",
      value: normalizedStats.campaignMessages ?? 0,
      hint: isTr ? "Gönderilen" : "Sent",
      icon: Megaphone,
      tone: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
      href: "/admin/campaigns",
    },
    {
      label: isTr ? "Hizmet" : "Services",
      value: normalizedStats.services ?? 0,
      hint: isTr ? "Tanımlı" : "Defined",
      icon: Wrench,
      tone: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
      href: null,
    },
    {
      label: isTr ? "Personel" : "Staff",
      value: normalizedStats.staff ?? 0,
      hint: isTr ? "Kayıtlı" : "Registered",
      icon: Users,
      tone: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
      href: null,
    },
    {
      label: isTr ? "Değerlendirme" : "Reviews",
      value: normalizedStats.reviews ?? 0,
      hint: isTr ? "Müşteri yorumu" : "Customer feedback",
      icon: Star,
      tone: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      href: null,
    },
  ];

  const recentAppointments = normalizedStats.recentAppointments ?? [];
  const recentCampaigns = normalizedStats.recentCampaigns ?? [];

  return (
    <div className="space-y-6">
      {/* Hero - God Mode Header */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl dark:border-slate-700 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.15),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(16,185,129,0.12),transparent)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
              <Shield className="h-3.5 w-3.5" />
              {isTr ? "God Mode" : "God Mode"}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {isTr ? "Admin Kontrol Merkezi" : "Admin Control Center"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
              {isTr
                ? "Tüm işletmeleri, randevuları, kampanyaları ve sistem metriklerini tek panelden yönetin. Tam yetki ile her şeyi görüntüleyin ve yönetin."
                : "Manage all businesses, appointments, campaigns and system metrics from one panel. Full access to view and manage everything."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/tenants/new"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              {isTr ? "Yeni İşletme" : "New Business"}
            </Link>
            <Link
              href="/admin/business-types/new"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-500 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              {isTr ? "İşletme Tipi" : "Business Type"}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin/campaigns"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-500 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <Megaphone className="h-4 w-4" />
              {isTr ? "Kampanya" : "Campaign"}
            </Link>
            <Link
              href="/admin/security"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-500 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <Shield className="h-4 w-4" />
              {isTr ? "Güvenlik" : "Security"}
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

      {/* Stats Grid - 3x3 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statItems.map((item) => {
          const Icon = item.icon;
          const card = (
            <article
              key={item.label}
              className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 ${
                item.href ? "hover:border-cyan-300 dark:hover:border-cyan-700" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {loading ? "…" : item.value}
                  </p>
                </div>
                <span className={`inline-flex rounded-xl p-2.5 ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  {isTr ? "Görüntüle" : "View"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </article>
          );
          return item.href ? (
            <Link key={item.label} href={item.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={item.label}>{card}</div>
          );
        })}
      </section>

      {/* Main Content Grid */}
      <section className="grid gap-6 xl:grid-cols-3">
        {/* İşletme Tipleri */}
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isTr ? "İşletme Tipleri" : "Business Types"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{isTr ? "Aktif kategoriler" : "Active categories"}</p>
            </div>
            <Link
              href="/admin/business-types"
              className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              {isTr ? "Tümü" : "All"}
            </Link>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : businessTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{isTr ? "Henüz tip yok" : "No types yet"}</p>
                <Link
                  href="/admin/business-types/new"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                >
                  <Plus className="h-4 w-4" />
                  {isTr ? "Oluştur" : "Create"}
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
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{bt.name}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">{bt.slug}</p>
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

        {/* Son Randevular + Son Kampanyalar */}
        <div className="space-y-6 xl:col-span-2">
          <article className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{isTr ? "Son Randevular" : "Recent Appointments"}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{isTr ? "Sistem genelinde" : "System-wide"}</p>
              </div>
              <Link
                href="/admin/tenants"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                {isTr ? "İşletmelere git" : "Go to businesses"}
              </Link>
            </div>
            <div className="max-h-64 overflow-y-auto p-5">
              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : recentAppointments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
                  <CalendarClock className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{isTr ? "Henüz randevu yok" : "No appointments yet"}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentAppointments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {a.tenant_name ?? a.tenant_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(a.slot_start).toLocaleString(locale)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          a.status === "completed"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : a.status === "confirmed"
                              ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {a.status}
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
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{isTr ? "Son Kampanyalar" : "Recent Campaigns"}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{isTr ? "Admin gönderimleri" : "Admin sends"}</p>
              </div>
              <Link
                href="/admin/campaigns"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                {isTr ? "Kampanyalar" : "Campaigns"}
              </Link>
            </div>
            <div className="max-h-48 overflow-y-auto p-5">
              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : recentCampaigns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
                  <MessageSquare className="mx-auto h-10 w-10 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{isTr ? "Henüz kampanya yok" : "No campaigns yet"}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentCampaigns.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {c.tenant_name ?? c.tenant_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatRelativeTime(c.created_at, isTr)} · {c.success_count}/{c.recipient_count} {isTr ? "gönderildi" : "sent"}
                        </p>
                      </div>
                      <Megaphone className="h-4 w-4 text-slate-400" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* İşletmeler Listesi */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
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
              {tenants.slice(0, 8).map((tenant) => (
                <li
                  key={tenant.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</p>
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
                      {tenant.status === "active" ? (isTr ? "Aktif" : "Active") : tenant.status === "suspended" ? (isTr ? "Askıda" : "Suspended") : isTr ? "Pasif" : "Passive"}
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
      </section>
    </div>
  );
}
