"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { loginEmailToUsernameDisplay } from "@/lib/username-auth";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui";
import { DashboardTenantProvider, useDashboardTenant } from "./DashboardTenantContext";

const QRCodeModal = dynamic(
  () => import("@/components/ui/QRCodeModal").then((m) => ({ default: m.QRCodeModal })),
  { ssr: false, loading: () => null }
);

const WhatsAppLinkModal = dynamic(
  () => import("@/components/ui/WhatsAppLinkModal").then((m) => ({ default: m.WhatsAppLinkModal })),
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
    loading: "Yükleniyor…",
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
    whatsappLink: "WhatsApp Bağlantısı",
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
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {accountLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" aria-hidden />
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
  const [showLinkModal, setShowLinkModal] = useState(false);
  const closeQRModal = useCallback(() => setShowQRModal(false), []);
  const closeLinkModal = useCallback(() => setShowLinkModal(false), []);
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

  const tenantCtx = useDashboardTenant();
  const tenantData = tenantCtx?.tenant ?? null;
  const tenantName = tenantData?.name ?? null;
  const tenantCode = tenantData?.tenant_code ?? null;
  const uiPrefs =
    (tenantData as { ui_preferences?: Record<string, unknown> } | null)?.ui_preferences ||
    (tenantData?.config_override as { ui_preferences?: Record<string, unknown> } | undefined)?.ui_preferences ||
    {};
  const moduleVisibility = (uiPrefs.moduleVisibility as Record<string, boolean>) || null;
  const moduleOrder = Array.isArray(uiPrefs.moduleOrder) ? (uiPrefs.moduleOrder as string[]) : null;
  const featureFlags = tenantCtx?.features ?? null;

  useEffect(() => {
    if (isLogin) return;
    const supabase = createClient();
    supabase.auth.getUser().then((res: { data: { user: User | null } }) => setUser(res.data.user ?? null));
  }, [isLogin]);

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

  // Null check ekle
  const safeChildren = children ?? null;

  if (isLogin) return <>{safeChildren}</>;

  return (
    <DashboardTenantProvider tenantId={extractedTenantId}>
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {isTenantPage && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 lg:hidden"
                aria-label={locale === "tr" ? "Menüyü aç" : "Open menu"}
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
            )}
            <Link href="/dashboard" className="inline-flex items-center gap-2.5">
              <Image
                src="/appicon.png"
                alt=""
                width={32}
                height={32}
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-700"
              />
              <span className="text-sm font-semibold tracking-tight">Ahi AI</span>
            </Link>
            <div className="min-w-0 border-l border-slate-200 pl-3 dark:border-slate-700">
              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
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
            className={`fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden ${
              mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setMobileOpen(false)}
          />

          <aside
            className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r border-slate-200 bg-white p-3 transition-transform duration-200 sm:top-16 sm:h-[calc(100vh-4rem)] dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t.quick}
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label={locale === "tr" ? "Menüyü kapat" : "Close menu"}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <nav className="space-y-0.5" aria-label={t.section}>
              {navItems.map(({ href, label, icon: Icon }) => {
                const isRoot = href === `/dashboard/${tenantId}`;
                const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-slate-400"}`} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t.whatsappLink}
              </button>
              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <QrCode className="h-4 w-4" aria-hidden />
                {t.qrCode}
              </button>
              <div className="pt-1 lg:hidden">
                <ThemeLocaleSwitch compact />
              </div>
            </div>
          </aside>

          <main className="min-h-[calc(100vh-3.5rem)] pb-[calc(5.6rem+env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-4rem)] lg:ml-64 lg:pb-0">
            {safeChildren}
          </main>

          {tenantId && (
            <>
              <QRCodeModal
                tenantId={tenantId}
                tenantCode={tenantCode ?? undefined}
                isOpen={showQRModal}
                onClose={closeQRModal}
              />
              <WhatsAppLinkModal
                tenantId={tenantId}
                tenantCode={tenantCode ?? undefined}
                isOpen={showLinkModal}
                onClose={closeLinkModal}
              />
            </>
          )}

          {mobileNavItems.length > 0 && (
            <nav
              className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
              aria-label={t.section}
            >
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
                {mobileNavItems.map(({ href, label, icon: Icon }) => {
                  const isRoot = href === `/dashboard/${tenantId}`;
                  const active = isRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors duration-150 ${
                        active
                          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon
                        className={`mb-0.5 h-4 w-4 ${active ? "text-[var(--brand)]" : ""}`}
                        aria-hidden
                      />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      ) : (
        <main className="min-h-[calc(100vh-4rem)]">{safeChildren}</main>
      )}
    </div>
    </DashboardTenantProvider>
  );
}
