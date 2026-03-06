"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CircleAlert,
  Filter,
  Plus,
  Search,
  Users,
  CalendarPlus,
  Loader2,
  Zap,
  PowerOff,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useFuzzySearchWorker } from "@/lib/use-fuzzy-search-worker";
import { normalizePhoneE164 } from "@/lib/phone";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import { humanizeMinutes } from "@/lib/humanize-duration";
import { toast } from "@/lib/toast";
import { AdminHelpPanel } from "@/components/admin/AdminHelpPanel";
import { useTenantsStore } from "@/stores/tenants-store";

interface Tenant {
  id: string;
  name: string;
  tenant_code: string;
  status: string;
  subscription_end_at?: string | null;
  rate_limit_override?: number | Record<string, unknown> | null;
  business_types: { id: string; name: string; slug: string } | null;
}

interface BusinessType {
  id: string;
  name: string;
}

function getRateLimitValue(r: unknown): number {
  if (typeof r === "number" && Number.isFinite(r)) return Math.max(0, r);
  if (r && typeof r === "object" && "monthly" in r) {
    const v = (r as { monthly?: number }).monthly;
    if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  }
  return 0;
}

function formatSubscriptionEnd(endAt: string | null | undefined): string {
  if (!endAt) return "—";
  const end = new Date(endAt);
  const now = new Date();
  if (end < now) return "Süresi doldu";
  const ms = end.getTime() - now.getTime();
  const minutes = Math.round(ms / 60_000);
  return humanizeMinutes(minutes);
}

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const search = useTenantsStore((s) => s.search);
  const setSearch = useTenantsStore((s) => s.setSearch);
  const statusFilter = useTenantsStore((s) => s.statusFilter);
  const setStatusFilter = useTenantsStore((s) => s.setStatusFilter);
  const sorting = useTenantsStore((s) => s.sorting);
  const setSorting = useTenantsStore((s) => s.setSorting);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("quickAdd") === "1") {
      setDrawerOpen(true);
      window.history.replaceState({}, "", "/admin/tenants");
    }
  }, []);
  const [quickName, setQuickName] = useState("");
  const [quickTypeId, setQuickTypeId] = useState("");
  const [quickOwnerPhone, setQuickOwnerPhone] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<{
    id: string;
    tenant_code: string;
    owner_username: string;
    temporary_password: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState<{ tenant: Tenant; value: number } | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!limitModal) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLimitModal(null);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [limitModal]);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "200");
      const url = `/api/admin/tenants?${params}`;
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
  }, [statusFilter]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    fetch("/api/admin/business-types")
      .then((response) => response.json())
      .then((payload) => setBusinessTypes(Array.isArray(payload) ? payload : []))
      .catch(() => setBusinessTypes([]));
  }, []);

  const { result: filtered } = useFuzzySearchWorker({
    list: tenants,
    query: search,
    keys: ["name", "tenant_code", "business_types.name"],
    threshold: 0.4,
  });

  const summary = useMemo(() => {
    const active = tenants.filter((t) => t.status === "active").length;
    const suspended = tenants.filter((t) => t.status === "suspended").length;
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

  const handleQuickAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (quickLoading) return;
    setQuickError(null);
    setQuickResult(null);

    const e164 = normalizePhoneE164(quickOwnerPhone.trim());
    if (!quickName.trim() || !quickTypeId.trim() || !e164) {
      setQuickError("İsim, işletme tipi ve geçerli telefon (örn: +905551234567) zorunlu.");
      return;
    }

    setQuickLoading(true);
    try {
      const res = await fetch("/api/admin/tenants/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickName.trim(),
          business_type_id: quickTypeId,
          owner_phone_e164: e164,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        tenant_code?: string;
        owner_username?: string;
        temporary_password?: string;
      };
      if (!res.ok || !payload.id) {
        throw new Error(payload.error || "Quick Add başarısız");
      }
      setQuickResult({
        id: payload.id,
        tenant_code: payload.tenant_code || "",
        owner_username: payload.owner_username || "",
        temporary_password: payload.temporary_password || "",
      });
      setQuickName("");
      setQuickTypeId("");
      setQuickOwnerPhone("");
      await fetchTenants();
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Quick Add başarısız");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleSuspend = async (tenant: Tenant) => {
    if (actionLoading) return;
    if (!confirm(`${tenant.name} için botu durdurmak istediğinize emin misiniz?`)) return;
    setActionLoading(tenant.id);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "suspended" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      await fetchTenants();
      toast.success("Bot durduruldu", tenant.name);
    } catch (err) {
      toast.error("Bot durdurulamadı", err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (tenant: Tenant) => {
    if (actionLoading) return;
    setActionLoading(tenant.id);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      await fetchTenants();
      toast.success("Bot başlatıldı", tenant.name);
    } catch (err) {
      toast.error("Bot başlatılamadı", err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtendSubscription = async (tenant: Tenant, add: string) => {
    if (actionLoading) return;
    setActionLoading(tenant.id);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/extend-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Uzatılamadı");
      await fetchTenants();
      toast.success("Abonelik uzatıldı", `${add === "7d" ? "+1 hafta" : "+1 ay"}`);
    } catch (err) {
      toast.error("Abonelik uzatılamadı", err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRateLimitUpdate = async () => {
    if (!limitModal) return;
    if (actionLoading) return;
    setActionLoading(limitModal.tenant.id);
    try {
      const res = await fetch(`/api/admin/tenants/${limitModal.tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate_limit_override: limitModal.value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Güncellenemedi");
      await fetchTenants();
      setLimitModal(null);
      toast.success("Limit güncellendi", limitModal.tenant.name);
    } catch (err) {
      toast.error("Limit güncellenemedi", err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setActionLoading(null);
    }
  };

  const columns = useMemo<ColumnDef<Tenant>[]>(
    () => [
      {
        id: "status-dot",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                status === "active" ? "bg-emerald-500" : "bg-amber-500"
              )}
              title={statusLabel(status)}
            />
          );
        },
        size: 32,
      },
      {
        accessorKey: "name",
        header: "İşletme",
        cell: ({ getValue }) => (
          <span className="font-semibold text-slate-900 dark:text-slate-100">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "tenant_code",
        header: "Kod",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{getValue() as string}</span>
        ),
      },
      {
        id: "business_type",
        header: "Tip",
        accessorFn: (row) => row.business_types?.name ?? "—",
        cell: ({ getValue }) => (
          <span className="text-sm text-slate-600 dark:text-slate-400">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "subscription_end_at",
        header: "Kalan Abonelik",
        accessorFn: (row) => row.subscription_end_at ?? null,
        cell: ({ getValue }) => {
          const end = getValue() as string | null;
          const text = formatSubscriptionEnd(end);
          const expired = end && new Date(end) < new Date();
          return (
            <span
              className={cn(
                "text-sm",
                expired ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
              )}
            >
              {text}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Durum",
        cell: ({ getValue }) => {
          const status = getValue() as string;
          return (
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusBadge(status))}>
              {statusLabel(status)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="text-right">İşlemler</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original;
          const loading = actionLoading === t.id;
          return (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <a
                href={`${baseUrl}/dashboard/${t.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Giriş Yap
              </a>
              <button
                type="button"
                onClick={() => handleExtendSubscription(t, "7d")}
                disabled={loading}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                title="+1 Hafta"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "+1 Hafta"}
              </button>
              <button
                type="button"
                onClick={() => handleExtendSubscription(t, "30d")}
                disabled={loading}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                title="+1 Ay"
              >
                +1 Ay
              </button>
              <button
                type="button"
                onClick={() => setLimitModal({ tenant: t, value: getRateLimitValue(t.rate_limit_override) })}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title="Limit Arttır"
              >
                <Zap className="h-3.5 w-3.5" />
              </button>
              {t.status === "active" ? (
                <button
                  type="button"
                  onClick={() => handleSuspend(t)}
                  disabled={loading}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
                  title="Botu Durdur"
                >
                  <PowerOff className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleResume(t)}
                  disabled={loading}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                  title="Botu Başlat"
                >
                  <Zap className="h-3.5 w-3.5" />
                </button>
              )}
              <Link
                href={`/admin/tenants/${t.id}`}
                className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Düzenle
              </Link>
            </div>
          );
        },
      },
    ],
    [actionLoading, baseUrl]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <AdminHelpPanel />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            İşletmeler
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kayıtlı işletmeleri yönetin. <kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-700">⌘K</kbd> ile hızlı arama.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
            <Drawer.Trigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-700 hover:shadow-cyan-500/30 dark:bg-cyan-500 dark:shadow-cyan-500/20 dark:hover:bg-cyan-600"
                title="60 saniyede yeni işletme aç"
              >
                <Plus className="h-4 w-4 transition group-hover:scale-110" />
                Quick Add
              </button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm" />
              <Drawer.Content
                className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                style={{ boxShadow: "-8px 0 24px rgba(0,0,0,0.12)" }}
              >
                <div className="flex flex-1 flex-col overflow-hidden p-6">
                  <div className="rounded-xl bg-cyan-50 p-4 dark:bg-cyan-950/30">
                    <Drawer.Title className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Hızlı İşletme Ekle
                    </Drawer.Title>
                    <Drawer.Description className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      3 alan ile 60 saniyede yeni işletme. Otomatik kod, kullanıcı ve şifre üretilir.
                    </Drawer.Description>
                  </div>
                  <form onSubmit={handleQuickAdd} className="mt-6 flex flex-col gap-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        İşletme Adı
                      </span>
                      <input
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Örn: Kuaför Ahmet"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        İşletme Tipi
                      </span>
                      <select
                        value={quickTypeId}
                        onChange={(e) => setQuickTypeId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">Seçin</option>
                        {businessTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Sahip Telefonu (E.164)
                      </span>
                      <input
                        value={quickOwnerPhone}
                        onChange={(e) => setQuickOwnerPhone(e.target.value)}
                        placeholder="+905551234567"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </label>
                    {quickError && (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {quickError}
                      </p>
                    )}
                    {quickResult && (
                      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <p className="flex items-center gap-2 font-bold">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">✓</span>
                          İşletme oluşturuldu
                        </p>
                        <div className="mt-3 space-y-1.5 rounded-lg bg-white/60 p-3 font-mono text-xs dark:bg-emerald-900/20">
                          <p><span className="text-slate-500 dark:text-slate-400">Kod:</span> {quickResult.tenant_code}</p>
                          <p><span className="text-slate-500 dark:text-slate-400">Kullanıcı:</span> {quickResult.owner_username}</p>
                          <p><span className="text-slate-500 dark:text-slate-400">Şifre:</span> {quickResult.temporary_password}</p>
                        </div>
                        <Link
                          href={`/admin/tenants/${quickResult.id}`}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                          onClick={() => setDrawerOpen(false)}
                        >
                          Detaya git →
                        </Link>
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={quickLoading}
                        className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {quickLoading ? (
                          <>
                            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                            Oluşturuluyor...
                          </>
                        ) : (
                          "Oluştur"
                        )}
                      </button>
                      <Drawer.Close asChild>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Kapat
                        </button>
                      </Drawer.Close>
                    </div>
                  </form>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-700"
            title="Tam form ile yeni işletme"
          >
            <CalendarPlus className="h-4 w-4" />
            Yeni İşletme
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Toplam</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{summary.total}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">işletme</p>
        </article>
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Aktif</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{summary.active}</p>
          <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">bot çalışıyor</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Askıda</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{summary.suspended}</p>
          <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">bot durduruldu</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pasif</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-700 dark:text-slate-300">{summary.inactive}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">diğer</p>
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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="İşletme adı, kodu veya tipi ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="space-y-0 divide-y divide-slate-200 dark:divide-slate-800">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
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
              {search || statusFilter ? "Aramanıza uygun işletme bulunamadı" : "Henüz işletme yok"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {search || statusFilter ? "Arama veya filtreyi değiştirip tekrar deneyin." : "Quick Add ile hızlıca ekleyebilirsiniz."}
            </p>
            {!search && !statusFilter && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                Quick Add
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/50">
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                          style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-1",
                              h.column.getCanSort() && "cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                            onClick={h.column.getToggleSortingHandler()}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getCanSort() && (
                              <span className="ml-1">
                                {h.column.getIsSorted() === "asc" ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : h.column.getIsSorted() === "desc" ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                          tenant.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      <div>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{tenant.name}</p>
                        <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {tenant.tenant_code}
                        </p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusBadge(tenant.status))}>
                      {statusLabel(tenant.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {!tenant.subscription_end_at
                      ? "—"
                      : new Date(tenant.subscription_end_at) < new Date()
                        ? "Süresi doldu"
                        : `${formatSubscriptionEnd(tenant.subscription_end_at)} kalan`}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={`${baseUrl}/dashboard/${tenant.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Giriş Yap
                    </a>
                    <button
                      type="button"
                      onClick={() => handleExtendSubscription(tenant, "30d")}
                      disabled={actionLoading === tenant.id}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    >
                      +1 Ay
                    </button>
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
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

      {limitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="limit-modal-title"
          onClick={(e) => e.target === e.currentTarget && setLimitModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="limit-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Mesaj Limiti
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
              {limitModal.tenant.name}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Aylık mesaj kotası. <strong>0</strong> = sistem varsayılanı kullanılır.
            </p>
            <input
              type="number"
              min={0}
              value={limitModal.value}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setLimitModal((m) => m && { ...m, value: Number.isFinite(v) ? Math.max(0, v) : 0 });
              }}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleRateLimitUpdate}
                disabled={actionLoading !== null}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {actionLoading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={() => setLimitModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
