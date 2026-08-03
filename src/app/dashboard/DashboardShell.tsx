"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  Package,
  KanbanSquare,
  Users,
  UserRound,
  Settings,
  MessageCircle,
  Inbox,
  QrCode,
  LogOut,
  MoreHorizontal,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { loginEmailToUsernameDisplay } from "@/lib/username-auth";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui/ThemeLocaleSwitch";
import { DashboardTenantProvider, useDashboardTenant } from "./DashboardTenantContext";
import { applyModuleOrder } from "./nav-order";

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
  | "inbox"
  | "pricing"
  | "packages"
  | "campaigns"
  | "workflow"
  | "crm"
  | "knowledge"
  | "staff"
  | "settings";

const COPY = {
  tr: {
    panel: "İşletme Paneli",
    loading: "Yükleniyor…",
    nav: {
      overview: "Özet",
      inbox: "Gelen Kutusu",
      pricing: "Fiyat Listesi",
      packages: "Paket & Seans",
      campaigns: "Kampanyalar",
      workflow: "Gün Takibi",
      crm: "Müşteri Defteri",
      knowledge: "Bilgi Bankası",
      staff: "Personel",
      settings: "Ayarlar",
    },
    whatsappLink: "WhatsApp Bağlantısı",
    qrCode: "QR Kod",
    logout: "Çıkış Yap",
    section: "Panel",
    quick: "Hızlı Erişim",
    more: "Diğer",
  },
  en: {
    panel: "Business Panel",
    loading: "Loading...",
    nav: {
      overview: "Overview",
      inbox: "Inbox",
      pricing: "Pricing",
      packages: "Packages",
      campaigns: "Campaigns",
      workflow: "Day Board",
      crm: "Customer Book",
      knowledge: "Knowledge Base",
      staff: "Staff",
      settings: "Settings",
    },
    whatsappLink: "WhatsApp Link",
    qrCode: "QR Code",
    logout: "Sign Out",
    section: "Operations",
    quick: "Quick Access",
    more: "More",
  },
} as const;

const MOBILE_PRIMARY_KEYS: NavKey[] = ["overview", "inbox", "crm", "workflow"];

const MOBILE_SHORT_LABELS: Record<"tr" | "en", Partial<Record<NavKey, string>>> = {
  tr: {
    overview: "Özet",
    inbox: "Gelen",
    crm: "Müşteri",
    workflow: "Takip",
    settings: "Ayarlar",
  },
  en: {
    overview: "Home",
    inbox: "Inbox",
    crm: "CRM",
    workflow: "Board",
    settings: "Settings",
  },
};

type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  icon: LucideIcon;
};

type MobileTabItem =
  | ({ type: "link" } & NavItem & { shortLabel: string })
  | { type: "more"; key: "more"; label: string; shortLabel: string; icon: LucideIcon };

function isNavActive(pathname: string, href: string, tenantId: string | null): boolean {
  const isRoot = href === `/dashboard/${tenantId}`;
  return isRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function buildMobileBottomNav(navItems: NavItem[], locale: "tr" | "en", moreLabel: string): MobileTabItem[] {
  const byKey = new Map(navItems.map((item) => [item.key, item]));
  const shortLabels = MOBILE_SHORT_LABELS[locale];

  const toLinkTab = (item: NavItem): MobileTabItem => ({
    type: "link",
    ...item,
    shortLabel: shortLabels[item.key] ?? item.label,
  });

  const primaryTabs = MOBILE_PRIMARY_KEYS.map((key) => byKey.get(key)).filter(
    (item): item is NavItem => !!item
  );
  const shownKeys = new Set(primaryTabs.map((item) => item.key));
  const overflow = navItems.filter((item) => !shownKeys.has(item.key));

  if (overflow.length === 0) {
    return primaryTabs.map(toLinkTab);
  }
  if (overflow.length === 1 && overflow[0].key === "settings") {
    return [...primaryTabs.map(toLinkTab), toLinkTab(overflow[0])].slice(0, 5);
  }

  const moreTab: MobileTabItem = {
    type: "more",
    key: "more",
    label: moreLabel,
    shortLabel: moreLabel,
    icon: MoreHorizontal,
  };

  return [...primaryTabs.map(toLinkTab), moreTab].slice(0, 5);
}

const UserMenu = React.memo(function UserMenu({
  user,
  logoutLabel,
  pathname,
}: {
  user: User | null;
  logoutLabel: string;
  pathname: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const accountLabel = loginEmailToUsernameDisplay(user?.email);
  const initial = accountLabel.slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-1.5 text-sm transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 sm:rounded-xl sm:px-3"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {accountLabel}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-full z-[60] mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
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
  const [user, setUser] = useState<User | null>(null);

  const parts = pathname.split("/").filter(Boolean);
  const extractedTenantId = parts[1] && parts[0] === "dashboard" ? parts[1] : null;

  useEffect(() => {
    if (isLogin) return;
    const supabase = createClient();
    supabase.auth.getUser().then((res: { data: { user: User | null } }) => setUser(res.data.user ?? null));
  }, [isLogin]);

  const safeChildren = children ?? null;
  if (isLogin) return <>{safeChildren}</>;

  return (
    <DashboardTenantProvider tenantId={extractedTenantId}>
      <DashboardShellChrome
        pathname={pathname}
        locale={locale}
        t={t}
        user={user}
        extractedTenantId={extractedTenantId}
      >
        {safeChildren}
      </DashboardShellChrome>
    </DashboardTenantProvider>
  );
}

function DashboardShellChrome({
  children,
  pathname,
  locale,
  t,
  user,
  extractedTenantId,
}: {
  children: React.ReactNode;
  pathname: string;
  locale: "tr" | "en";
  t: (typeof COPY)[keyof typeof COPY];
  user: User | null;
  extractedTenantId: string | null;
}) {
  const tenantId = extractedTenantId;
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const closeQRModal = useCallback(() => setShowQRModal(false), []);
  const closeLinkModal = useCallback(() => setShowLinkModal(false), []);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.classList.add("dashboard-drawer-open");
    return () => {
      document.body.classList.remove("dashboard-drawer-open");
    };
  }, [mobileOpen]);

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

  const baseNav = useMemo(
    () =>
      (tenantId
        ? [
            { key: "overview" as NavKey, href: `/dashboard/${tenantId}`, label: t.nav.overview, icon: LayoutDashboard },
            { key: "inbox" as NavKey, href: `/dashboard/${tenantId}/inbox`, label: t.nav.inbox, icon: Inbox },
            { key: "pricing" as NavKey, href: `/dashboard/${tenantId}/pricing`, label: t.nav.pricing, icon: ListChecks },
            { key: "packages" as NavKey, href: `/dashboard/${tenantId}/packages`, label: t.nav.packages, icon: Package },
            { key: "workflow" as NavKey, href: `/dashboard/${tenantId}/workflow`, label: t.nav.workflow, icon: KanbanSquare },
            { key: "crm" as NavKey, href: `/dashboard/${tenantId}/crm`, label: t.nav.crm, icon: Users },
            { key: "knowledge" as NavKey, href: `/dashboard/${tenantId}/knowledge`, label: t.nav.knowledge, icon: BookOpen },
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
    return applyModuleOrder(visible, moduleOrder);
  }, [baseNav, featureFlags, moduleOrder, moduleVisibility]);

  const mobileBottomNav = useMemo(
    () => buildMobileBottomNav(navItems, locale, t.more),
    [navItems, locale, t.more]
  );

  const mobileOverflowKeys = useMemo(() => {
    const tabKeys = new Set(
      mobileBottomNav.flatMap((item) => (item.type === "link" ? [item.key] : []))
    );
    return new Set(navItems.filter((item) => !tabKeys.has(item.key)).map((item) => item.key));
  }, [mobileBottomNav, navItems]);

  const isMoreTabActive = useMemo(
    () =>
      mobileBottomNav.some((item) => item.type === "more") &&
      navItems.some(
        (item) => mobileOverflowKeys.has(item.key) && isNavActive(pathname, item.href, tenantId)
      ),
    [mobileBottomNav, mobileOverflowKeys, navItems, pathname, tenantId]
  );

  const isTenantPage = !!tenantId;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="dashboard-shell-header sticky top-0 z-40 border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 md:bg-white/95 md:backdrop-blur-sm dark:md:bg-slate-900/95">
        <div className="mx-auto flex h-[var(--dashboard-header-height)] w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href={extractedTenantId ? `/dashboard/${extractedTenantId}` : "/dashboard"}
              className="inline-flex shrink-0 items-center gap-2.5"
              aria-label={extractedTenantId ? t.nav.overview : "Ahi AI"}
            >
              <Image
                src="/appicon.png"
                alt=""
                width={32}
                height={32}
                sizes="32px"
                priority
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-700"
              />
              <span className="hidden text-sm font-semibold tracking-tight sm:inline">Ahi AI</span>
            </Link>
            <div className="min-w-0 border-l border-slate-200 pl-3 dark:border-slate-700">
              <p className="hidden truncate text-[11px] font-medium text-slate-500 sm:block dark:text-slate-400">
                {t.section}
              </p>
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {tenantName || (tenantId ? t.loading : t.panel)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden md:block">
              <ThemeLocaleSwitch compact />
            </div>
            <UserMenu user={user} logoutLabel={t.logout} pathname={pathname} />
          </div>
        </div>
      </header>

      {isTenantPage ? (
        <div className="relative">
          <div
            className={`fixed inset-0 z-[45] bg-slate-950/45 transition-opacity duration-200 lg:hidden ${
              mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />

          <aside
            className={`fixed left-0 top-[var(--dashboard-header-height)] z-50 flex h-[calc(100dvh-var(--dashboard-header-height))] w-[min(20rem,88vw)] flex-col border-r border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 lg:z-40 lg:w-64 lg:translate-x-0 lg:p-3 lg:pb-3 ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-4 flex shrink-0 items-center justify-between lg:hidden">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.quick}</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {tenantName || t.panel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors duration-150 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label={locale === "tr" ? "Menüyü kapat" : "Close menu"}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain" aria-label={t.section}>
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isNavActive(pathname, href, tenantId);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "" : "text-slate-400"}`} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 shrink-0 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t.whatsappLink}
              </button>
              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <QrCode className="h-4 w-4" aria-hidden />
                {t.qrCode}
              </button>
              <div className="pt-1 lg:hidden">
                <ThemeLocaleSwitch compact />
              </div>
            </div>
          </aside>

          <main className="min-h-[calc(100dvh-var(--dashboard-header-height))] pb-[calc(var(--dashboard-mobile-tab-height)+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
            {children}
          </main>

          {tenantId && showQRModal && (
            <QRCodeModal
              tenantId={tenantId}
              tenantCode={tenantCode ?? undefined}
              isOpen
              onClose={closeQRModal}
            />
          )}
          {tenantId && showLinkModal && (
            <WhatsAppLinkModal
              tenantId={tenantId}
              tenantCode={tenantCode ?? undefined}
              isOpen
              onClose={closeLinkModal}
            />
          )}

          {mobileBottomNav.length > 0 && (
            <nav
              className="dashboard-tabbar fixed inset-x-0 bottom-0 z-40 bg-white pb-[env(safe-area-inset-bottom)] dark:bg-slate-950 lg:hidden"
              aria-label={t.section}
            >
              <div
                className="mx-auto grid h-[var(--dashboard-mobile-tab-height)] max-w-lg items-stretch px-1"
                style={{
                  gridTemplateColumns: `repeat(${mobileBottomNav.length}, minmax(0, 1fr))`,
                }}
              >
                {mobileBottomNav.map((item) => {
                  if (item.type === "more") {
                    const active = isMoreTabActive || mobileOpen;
                    const Icon = item.icon;
                    return (
                      <button
                        key="more"
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        aria-label={item.label}
                        aria-expanded={mobileOpen}
                        className={`dashboard-tab flex flex-col items-center justify-center gap-0.5 px-1 ${
                          active ? "text-[var(--brand)]" : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        <span
                          className={`inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-150 ${
                            active ? "bg-[var(--brand-soft)]" : ""
                          }`}
                        >
                          <Icon
                            className="h-[22px] w-[22px]"
                            strokeWidth={active ? 2.25 : 1.75}
                            aria-hidden
                          />
                        </span>
                        <span className={`text-[10px] leading-none tracking-wide ${active ? "font-semibold" : "font-medium"}`}>
                          {item.shortLabel}
                        </span>
                      </button>
                    );
                  }

                  const { href, shortLabel, icon: Icon } = item;
                  const active = isNavActive(pathname, href, tenantId);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`dashboard-tab flex flex-col items-center justify-center gap-0.5 px-1 ${
                        active ? "text-[var(--brand)]" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      <span
                        className={`inline-flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-150 ${
                          active ? "bg-[var(--brand-soft)]" : ""
                        }`}
                      >
                        <Icon
                          className="h-[22px] w-[22px]"
                          strokeWidth={active ? 2.25 : 1.75}
                          aria-hidden
                        />
                      </span>
                      <span className={`text-[10px] leading-none tracking-wide ${active ? "font-semibold" : "font-medium"}`}>
                        {shortLabel}
                      </span>
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
