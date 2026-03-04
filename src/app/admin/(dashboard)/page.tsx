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
  Star,
  Users,
  UserCircle,
  Wrench,
} from "lucide-react";

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

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Az önce";
  if (diffMins < 60) return `${diffMins} dk önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  return d.toLocaleDateString("tr-TR");
}

export default function AdminPage() {
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
        throw new Error(btErr.error || "İşletme tipleri alınamadı");
      }
      if (!tRes.ok) {
        const tErr = await tRes.json().catch(() => ({}));
        throw new Error(tErr.error || "İşletmeler alınamadı");
      }

      const btData = await btRes.json();
      const tData = await tRes.json();
      const statsData = statsRes.ok ? await statsRes.json().catch(() => null) : null;
      setBusinessTypes(Array.isArray(btData) ? btData : []);
      setTenants(Array.isArray(tData) ? tData : []);
      setStats(statsData && !("error" in (statsData || {})) ? statsData : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setBusinessTypes([]);
      setTenants([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    { label: "İşletme", value: normalizedStats.tenants, hint: `${normalizedStats.activeTenants} aktif`, icon: Users, href: "/admin/tenants" },
    { label: "İşletme Tipi", value: normalizedStats.businessTypes, hint: "Kategori", icon: Building2, href: "/admin/business-types" },
    { label: "Bugün Randevu", value: normalizedStats.appointmentsToday, hint: "Günlük", icon: CalendarClock, href: null },
    { label: "Toplam Randevu", value: normalizedStats.appointmentsTotal, hint: "Sistem", icon: ClipboardList, href: null },
    { label: "CRM Müşteri", value: normalizedStats.crmCustomers ?? 0, hint: "Tümü", icon: UserCircle, href: null },
    { label: "Kampanya", value: normalizedStats.campaignMessages ?? 0, hint: "Gönderilen", icon: Megaphone, href: "/admin/campaigns" },
    { label: "Hizmet", value: normalizedStats.services ?? 0, hint: "Tanımlı", icon: Wrench, href: null },
    { label: "Personel", value: normalizedStats.staff ?? 0, hint: "Kayıtlı", icon: Users, href: null },
    { label: "Değerlendirme", value: normalizedStats.reviews ?? 0, hint: "Yorum", icon: Star, href: null },
  ];

  const recentAppointments = normalizedStats.recentAppointments ?? [];
  const recentCampaigns = normalizedStats.recentCampaigns ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Genel Bakış</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Sistem özeti</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
            Yeni İşletme
          </Link>
          <Link
            href="/admin/business-types/new"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            İşletme Tipi
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <RefreshCcw className="mr-1.5 inline h-4 w-4" />
            Tekrar dene
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statItems.map((item) => {
          const Icon = item.icon;
          const card = (
            <article
              key={item.label}
              className={`rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${
                item.href ? "hover:border-slate-300 dark:hover:border-slate-600" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {loading ? "—" : item.value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                </div>
                <Icon className="h-5 w-5 text-slate-400" />
              </div>
              {item.href && (
                <Link
                  href={item.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                >
                  Görüntüle
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </article>
          );
          return item.href ? (
            <Link key={item.label} href={item.href}>
              {card}
            </Link>
          ) : (
            <div key={item.label}>{card}</div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">İşletme Tipleri</h2>
            <Link href="/admin/business-types" className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300">
              Tümü
            </Link>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            ) : businessTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center dark:border-slate-600">
                <p className="text-sm text-slate-600 dark:text-slate-400">Henüz tip yok</p>
                <Link href="/admin/business-types/new" className="mt-2 inline-block text-sm font-medium text-slate-700 hover:underline dark:text-slate-300">
                  Oluştur
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {businessTypes.slice(0, 6).map((bt) => (
                  <li key={bt.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{bt.name}</p>
                      <p className="font-mono text-xs text-slate-500">{bt.slug}</p>
                    </div>
                    <span className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {FLOW_LABELS[bt.flow_type] ?? bt.flow_type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <div className="space-y-6 lg:col-span-2">
          <article className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Son Randevular</h2>
              <Link href="/admin/tenants" className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300">
                İşletmeler
              </Link>
            </div>
            <div className="max-h-56 overflow-y-auto p-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : recentAppointments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-slate-600">
                  <CalendarClock className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-500">Henüz randevu yok</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentAppointments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                      <div>
                        <p className="text-sm font-medium">{a.tenant_name ?? a.tenant_id.slice(0, 8)}</p>
                        <p className="text-xs text-slate-500">{new Date(a.slot_start).toLocaleString("tr-TR")}</p>
                      </div>
                      <span className={`rounded text-[11px] font-medium ${
                        a.status === "completed" ? "text-emerald-600 dark:text-emerald-400" :
                        a.status === "confirmed" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500"
                      }`}>
                        {a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Son Kampanyalar</h2>
              <Link href="/admin/campaigns" className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300">
                Kampanyalar
              </Link>
            </div>
            <div className="max-h-40 overflow-y-auto p-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : recentCampaigns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center dark:border-slate-600">
                  <MessageSquare className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-500">Henüz kampanya yok</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentCampaigns.map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                      <div>
                        <p className="text-sm font-medium">{c.tenant_name ?? c.tenant_id.slice(0, 8)}</p>
                        <p className="text-xs text-slate-500">
                          {formatRelativeTime(c.created_at)} · {c.success_count}/{c.recipient_count} gönderildi
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">İşletmeler</h2>
          <Link href="/admin/tenants" className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300">
            Tümünü gör
          </Link>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : tenants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-slate-600">
              <p className="text-sm text-slate-600 dark:text-slate-400">Henüz işletme yok</p>
              <Link href="/admin/tenants/new" className="mt-2 inline-block text-sm font-medium text-slate-700 hover:underline dark:text-slate-300">
                İlk işletmeyi ekle
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {tenants.slice(0, 8).map((tenant) => (
                <li key={tenant.id} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{tenant.name}</p>
                    <p className="font-mono text-xs text-slate-500">
                      {tenant.tenant_code}
                      {tenant.business_types?.name ? ` · ${tenant.business_types.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      tenant.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      tenant.status === "suspended" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                      "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    }`}>
                      {tenant.status === "active" ? "Aktif" : tenant.status === "suspended" ? "Askıda" : "Pasif"}
                    </span>
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Detay
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
