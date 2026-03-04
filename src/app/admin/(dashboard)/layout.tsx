"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronRight,
  LayoutDashboard,
  Megaphone,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui";
import { AdminLogout } from "../admin-logout";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

const COPY = {
  tr: {
    quickCreate: "Yeni İşletme",
    quickAdd: "Hızlı Ekle",
    management: "Yönetim",
    panelName: "Admin Panel",
    nav: [
      {
        href: "/admin",
        label: "Genel Bakış",
        description: "Metrik ve özet",
        icon: LayoutDashboard,
      },
      {
        href: "/admin/tenants",
        label: "İşletmeler",
        description: "İşletme yönetimi",
        icon: Users,
      },
      {
        href: "/admin/business-types",
        label: "İşletme Tipleri",
        description: "Kategori ve akışlar",
        icon: Building2,
      },
      {
        href: "/admin/campaigns",
        label: "Kampanyalar",
        description: "Mesaj planlama",
        icon: Megaphone,
      },
      {
        href: "/admin/security",
        label: "Güvenlik",
        description: "2FA ve oturum",
        icon: ShieldCheck,
      },
    ] as NavItem[],
  },
  en: {
    quickCreate: "New Business",
    quickAdd: "Quick Add",
    management: "Management",
    panelName: "Admin Panel",
    nav: [
      {
        href: "/admin",
        label: "Overview",
        description: "Metrics and snapshot",
        icon: LayoutDashboard,
      },
      {
        href: "/admin/tenants",
        label: "Businesses",
        description: "Business management",
        icon: Users,
      },
      {
        href: "/admin/business-types",
        label: "Business Types",
        description: "Categories and flows",
        icon: Building2,
      },
      {
        href: "/admin/campaigns",
        label: "Campaigns",
        description: "Message planning",
        icon: Megaphone,
      },
      {
        href: "/admin/security",
        label: "Security",
        description: "2FA and sessions",
        icon: ShieldCheck,
      },
    ] as NavItem[],
  },
} as const;

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = COPY[locale];
  const navItems = t.nav;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const currentSection = useMemo(
    () => navItems.find((item) => isItemActive(pathname, item.href))?.label || t.management,
    [navItems, pathname, t.management]
  );
  const mobileNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-600/10" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-700/10" />
      </div>

      <div
        className={`fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[18rem] border-r border-slate-200/80 bg-white/95 shadow-xl backdrop-blur transition-transform dark:border-slate-800 dark:bg-slate-900/95 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[4.8rem] items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-800">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={30}
              height={30}
              className="rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Ahi AI
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.panelName}</p>
            </div>
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(100%-4.8rem)] flex-col gap-4 p-4">
          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4 dark:border-cyan-900/50 dark:from-cyan-950/30 dark:via-slate-900 dark:to-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {locale === "tr" ? "Hızlı İşlem" : "Quick Action"}
            </p>
            <Link
              href="/admin/tenants/new"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              {t.quickCreate}
            </Link>
          </div>

          <nav className="scrollbar-thin -mr-2 flex-1 space-y-1 overflow-y-auto pr-2">
            {navItems.map((item) => {
              const active = isItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-start gap-3 rounded-xl px-3 py-3 transition ${
                    active
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/15 dark:bg-emerald-500 dark:text-slate-950 dark:shadow-emerald-900/25"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? "" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className={`mt-0.5 block truncate text-xs ${active ? "text-white/80 dark:text-slate-900/80" : "text-slate-500 dark:text-slate-500"}`}>
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <ThemeLocaleSwitch />
            <AdminLogout />
          </div>
        </div>
      </aside>

      <div className="relative lg:pl-[18rem]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex h-[4.8rem] w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t.management}
                </p>
                <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{currentSection}</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/admin/tenants/new"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Sparkles className="h-4 w-4" />
                {t.quickAdd}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>

        {mobileNavItems.length > 0 && (
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/98 px-2 pb-[calc(0.4rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
              {mobileNavItems.map((item) => {
                const active = isItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-2 text-[10px] font-semibold transition ${
                      active
                        ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className={`mb-1 h-4 w-4 ${active ? "text-slate-700 dark:text-slate-100" : ""}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
