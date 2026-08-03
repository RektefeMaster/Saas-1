"use client";

import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { HealthIndicator } from "@/components/admin/HealthIndicator";
import {
  BarChart3,
  Building2,
  ChevronRight,
  MessageSquareWarning,
  ExternalLink,
  History,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Menu,
  MoreHorizontal,
  Power,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AdminLogout } from "../admin-logout";

const CommandMenu = dynamic(
  () => import("@/components/admin/CommandMenu").then((m) => ({ default: m.CommandMenu })),
  { ssr: false, loading: () => null }
);

async function killSwitchFetcher(url: string): Promise<{ enabled?: boolean }> {
  const res = await fetch(url);
  if (!res.ok) return { enabled: false };
  return res.json();
}

type NavItem = {
  href: string;
  label: string;
  /** Mobil alt çubuk dar; uzun etiketler orada kısaltılır. */
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
};

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Genel Bakış", shortLabel: "Özet", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "İşletmeler", shortLabel: "İşletme", icon: Users },
  { href: "/admin/business-types", label: "İşletme Tipleri", shortLabel: "Tipler", icon: Building2 },
  { href: "/admin/campaigns", label: "Kampanyalar", shortLabel: "Kampanya", icon: Megaphone },
  { href: "/admin/security", label: "Güvenlik", shortLabel: "Güvenlik", icon: ShieldCheck },
  { href: "/admin/conversations", label: "Konuşmalar", shortLabel: "Sohbet", icon: MessageSquareWarning },
  { href: "/admin/tools", label: "Sistem Araçları", shortLabel: "Araçlar", icon: Wrench },
  { href: "/admin/time-machine", label: "Time Machine", shortLabel: "Zaman", icon: History },
  { href: "/admin/langfuse", label: "LLM Gözlemi", shortLabel: "LLM", icon: BarChart3 },
];

/** Mobil alt çubuk: 4 birincil + Diğer (sidebar). */
const MOBILE_PRIMARY_HREFS = ["/admin", "/admin/tenants", "/admin/campaigns", "/admin/security"] as const;

const BRAND_ACTIVE =
  "bg-[var(--brand)] text-[var(--brand-foreground)]";
const BRAND_CTA =
  "bg-[var(--brand)] text-[var(--brand-foreground)] hover:opacity-90";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);

  const { data: killSwitchData, isLoading: killSwitchSwrLoading, mutate: mutateKillSwitch } = useSWR<{ enabled?: boolean }>(
    "/api/admin/tools/kill-switch",
    killSwitchFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const killSwitchEnabled = Boolean(killSwitchData?.enabled);
  const killSwitchReady = !killSwitchSwrLoading;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleKillSwitchToggle = async () => {
    if (killSwitchLoading) return;
    const next = !killSwitchEnabled;
    setKillSwitchLoading(true);
    try {
      const res = await fetch("/api/admin/tools/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next,
          source: "admin_header",
        }),
      });
      if (!res.ok) throw new Error("Kill switch güncellenemedi");
      const payload = (await res.json().catch(() => null)) as { enabled?: boolean } | null;
      await mutateKillSwitch({ enabled: Boolean(payload?.enabled) });
    } catch (err) {
      console.error("[admin] kill switch update failed", err);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const currentSection = useMemo(
    () => NAV_ITEMS.find((item) => isItemActive(pathname, item.href))?.label ?? "Admin",
    [pathname]
  );

  const mobilePrimaryItems = useMemo(
    () =>
      MOBILE_PRIMARY_HREFS.map((href) => NAV_ITEMS.find((item) => item.href === href)).filter(
        (item): item is NavItem => !!item
      ),
    []
  );

  const isOverflowRouteActive = useMemo(() => {
    const primarySet = new Set<string>(MOBILE_PRIMARY_HREFS);
    return NAV_ITEMS.some((item) => !primarySet.has(item.href) && isItemActive(pathname, item.href));
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/appicon.png" alt="Ahi AI" width={28} height={28} sizes="28px" className="rounded-lg" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden dark:hover:bg-slate-800"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <nav className="flex flex-col gap-0.5 overflow-y-auto p-3">
            <Link
              href="/admin/tenants/new"
              className={cn(
                "mb-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                BRAND_CTA
              )}
            >
              <Plus className="h-4 w-4" />
              Yeni İşletme
            </Link>
            {NAV_ITEMS.map((item) => {
              const active = !item.external && isItemActive(pathname, item.href);
              const Icon = item.icon;
              const linkClass = cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? BRAND_ACTIVE
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              );
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" />
                  </a>
                );
              }
              return (
                <Link key={item.href} href={item.href} className={linkClass}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <AdminLogout />
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{currentSection}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Search className="h-4 w-4" />
                Ara
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={handleKillSwitchToggle}
                disabled={!killSwitchReady || killSwitchLoading}
                className={`hidden items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium sm:flex ${
                  killSwitchEnabled
                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {killSwitchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                {killSwitchEnabled ? "Sistemi Çöz" : "Sistemi Dondur"}
              </button>
              <Link
                href="/admin/tenants/new"
                className={cn(
                  "hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex",
                  BRAND_CTA
                )}
              >
                Yeni İşletme
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="p-4 pb-20 sm:p-6 lg:pb-8">
          <div className="mx-auto max-w-6xl">{children ?? null}</div>
        </main>

        <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
        <HealthIndicator />

        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-slate-200 bg-white p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden dark:border-slate-800 dark:bg-slate-900"
          aria-label="Admin mobil gezinme"
        >
          {mobilePrimaryItems.map((item) => {
            const active = !item.external && isItemActive(pathname, item.href);
            const Icon = item.icon;
            const navClass = cn(
              "flex min-w-0 flex-col items-center justify-center rounded-lg px-0.5 py-2 text-center text-[10px] font-medium",
              active ? BRAND_ACTIVE : "text-slate-500 dark:text-slate-400"
            );
            const shortLabel = item.shortLabel ?? item.label;
            return (
              <Link key={item.href} href={item.href} className={navClass} title={item.label}>
                <Icon className="mb-1 h-4 w-4 shrink-0" />
                <span className="w-full truncate">{shortLabel}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Diğer"
            aria-expanded={mobileOpen}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center rounded-lg px-0.5 py-2 text-center text-[10px] font-medium",
              isOverflowRouteActive || mobileOpen
                ? "text-[var(--brand)]"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            <MoreHorizontal className="mb-1 h-4 w-4 shrink-0" />
            <span className="w-full truncate">Diğer</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
