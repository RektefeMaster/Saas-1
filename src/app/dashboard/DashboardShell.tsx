"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Calendar,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  Package,
  KanbanSquare,
  Users,
  UserRound,
  Settings,
  MessageCircle,
  QrCode,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { getAppBaseUrl } from "@/lib/app-url";
import { loginEmailToUsernameDisplay } from "@/lib/username-auth";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui";
import { fetcher } from "@/lib/swr-fetcher";

const QRCodeModal = dynamic(
  () => import("@/components/ui/QRCodeModal").then((m) => ({ default: m.QRCodeModal })),
  { ssr: false, loading: () => null }
);

type NavKey =
  | "overview"
  | "pricing"
  | "packages"
  | "campaigns"
  | "workflow"
  | "crm"
  | "staff"
  | "settings";

interface DashboardFeatureFlags {
  packages?: boolean;
  staff_preference?: boolean;
}

const COPY = {
  tr: {
    panel: "İşletme Paneli",
    loading: "Yükleniyor...",
    nav: {
      overview: "Özet",
      pricing: "Fiyat Listesi",
      packages: "Paket & Seans",
      campaigns: "Kampanyalar",
      workflow: "İş Akışı",
      crm: "Müşteri Defteri",
      staff: "Personel",
      settings: "Ayarlar",
    },
    whatsappLink: "WhatsApp Linki",
    qrCode: "QR Kod",
    logout: "Çıkış Yap",
    section: "Panel",
    quick: "Hızlı Erişim",
  },
  en: {
    panel: "Business Panel",
    loading: "Loading...",
    nav: {
      overview: "Overview",
      pricing: "Pricing",
      packages: "Packages",
      campaigns: "Campaigns",
      workflow: "Workflow",
      crm: "Customer Book",
      staff: "Staff",
      settings: "Settings",
    },
    whatsappLink: "WhatsApp Link",
    qrCode: "QR Code",
    logout: "Sign Out",
    section: "Operations",
    quick: "Quick Access",
  },
} as const;

const UserMenu = React.memo(function UserMenu({
  user,
  logoutLabel,
}: {
  user: User | null;
  logoutLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const accountLabel = loginEmailToUsernameDisplay(user?.email);
  const initial = accountLabel.slice(0, 1).toUpperCase() || "?";

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/api/dashboard/auth/otp/clear", { method: "POST" }).catch(() => {});
    setOpen(false);
    router.push("/dashboard/login");
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {accountLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              {logoutLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = COPY[locale];
  const isLogin = pathname === "/dashboard/login" || pathname.startsWith("/dashboard/login/");

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const closeQRModal = useCallback(() => setShowQRModal(false), []);
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const parts = pathname.split("/").filter(Boolean);
  const extractedTenantId = parts[1] && parts[0] === "dashboard" ? parts[1] : null;

  useEffect(() => {
    if (isLogin) return;
    setTenantId(extractedTenantId);
  }, [pathname, isLogin, extractedTenantId]);

  const { data: tenantData } = useSWR<{
    name?: string;
    tenant_code?: string;
    ui_preferences?: Record<string, unknown>;
    config_override?: { ui_preferences?: Record<string, unknown> };
  }>(
    extractedTenantId && !isLogin ? `/api/tenant/${extractedTenantId}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: featureData } = useSWR<{ feature_flags?: DashboardFeatureFlags }>(
    extractedTenantId && !isLogin ? `/api/tenant/${extractedTenantId}/features` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const tenantName = tenantData?.name ?? null;
  const tenantCode = tenantData?.tenant_code ?? null;
  const uiPrefs =
    (tenantData?.ui_preferences as Record<string, unknown> | undefined) ||
    (tenantData?.config_override?.ui_preferences as Record<string, unknown> | undefined) ||
    {};
  const moduleVisibility = (uiPrefs.moduleVisibility as Record<string, boolean>) || null;
  const moduleOrder = Array.isArray(uiPrefs.moduleOrder) ? (uiPrefs.moduleOrder as string[]) : null;
  const featureFlags = (featureData?.feature_flags as DashboardFeatureFlags | undefined) || null;

  useEffect(() => {
    if (isLogin) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
  }, [isLogin]);

  const appBaseUrl = getAppBaseUrl();
  const baseNav = useMemo(
    () =>
      (tenantId
        ? [
            { key: "overview" as NavKey, href: `/dashboard/${tenantId}`, label: t.nav.overview, icon: LayoutDashboard },
            { key: "pricing" as NavKey, href: `/dashboard/${tenantId}/pricing`, label: t.nav.pricing, icon: ListChecks },
            { key: "packages" as NavKey, href: `/dashboard/${tenantId}/packages`, label: t.nav.packages, icon: Package },
            { key: "workflow" as NavKey, href: `/dashboard/${tenantId}/workflow`, label: t.nav.workflow, icon: KanbanSquare },
            { key: "crm" as NavKey, href: `/dashboard/${tenantId}/crm`, label: t.nav.crm, icon: Users },
            { key: "campaigns" as NavKey, href: `/dashboard/${tenantId}/campaigns`, label: t.nav.campaigns, icon: MessageCircle },
            { key: "staff" as NavKey, href: `/dashboard/${tenantId}/staff`, label: t.nav.staff, icon: UserRound },
            { key: "settings" as NavKey, href: `/dashboard/${tenantId}/settings`, label: t.nav.settings, icon: Settings },
          ]
        : []),
    [tenantId, t]
  );

  const navItems = useMemo(() => {
    let visible = baseNav;
    if (featureFlags?.packages !== true) {
      visible = visible.filter((item) => item.key !== "packages");
    }
    if (featureFlags?.staff_preference !== true) {
      visible = visible.filter((item) => item.key !== "staff");
    }
    if (moduleVisibility) {
      visible = visible.filter((item) => moduleVisibility[item.key] !== false);
    }
    if (!moduleOrder || moduleOrder.length === 0) return visible;
    const rank = new Map(moduleOrder.map((key, index) => [key, index]));
    return [...visible].sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));
  }, [baseNav, featureFlags, moduleOrder, moduleVisibility]);

  const mobileNavItems = navItems.slice(0, 5);
  const isTenantPage = !!tenantId;

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <div className="absolute -left-16 -top-20 h-72 w-72 rounded-full bg-slate-300/25 blur-3xl dark:bg-slate-700/20" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl dark:bg-blue-900/15" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {isTenantPage && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}
            <Link href="/dashboard" className="inline-flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm dark:bg-slate-700">
                <Calendar className="h-4 w-4" />
              </span>
              <span className="font-mono text-sm font-semibold">Ahi AI</span>
            </Link>
            <div className="min-w-0 border-l border-slate-200 pl-3 dark:border-slate-700">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t.section}
              </p>
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {tenantName || (tenantId ? t.loading : t.panel)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ThemeLocaleSwitch compact />
            </div>
            <UserMenu user={user} logoutLabel={t.logout} />
          </div>
        </div>
      </header>

      {isTenantPage ? (
        <div className="relative">
          <div
            className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden ${
              mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setMobileOpen(false)}
          />

          <aside
            className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-72 border-r border-slate-200/80 bg-white/95 p-4 shadow-lg backdrop-blur transition-transform dark:border-slate-800 dark:bg-slate-900/95 lg:translate-x-0 ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t.quick}
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isRoot = href === `/dashboard/${tenantId}`;
                const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "" : "text-slate-400"}`} />
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <a
                href={`${appBaseUrl}/api/tenant/${tenantId}/link`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <MessageCircle className="h-4 w-4" />
                {t.whatsappLink}
              </a>
              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <QrCode className="h-4 w-4" />
                {t.qrCode}
              </button>
              <div className="pt-1 lg:hidden">
                <ThemeLocaleSwitch compact />
              </div>
            </div>
          </aside>

          <main className="min-h-[calc(100vh-4rem)] pb-[calc(5.6rem+env(safe-area-inset-bottom))] lg:ml-72 lg:pb-0">
            {children}
          </main>

          {tenantId && (
            <QRCodeModal
              tenantId={tenantId}
              tenantCode={tenantCode ?? undefined}
              isOpen={showQRModal}
              onClose={closeQRModal}
            />
          )}

          {mobileNavItems.length > 0 && (
            <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/98 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
                {mobileNavItems.map(({ href, label, icon: Icon }) => {
                  const isRoot = href === `/dashboard/${tenantId}`;
                  const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
                        active
                          ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className={`mb-1 h-4 w-4 ${active ? "text-slate-700 dark:text-slate-100" : ""}`} />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      ) : (
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      )}
    </div>
  );
}
