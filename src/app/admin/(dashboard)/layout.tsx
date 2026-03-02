"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Megaphone,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { AdminLogout } from "../admin-logout";
import { ThemeToggle } from "../theme-toggle";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Genel Bakış",
    description: "Yönetim metrikleri",
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
    description: "Kategori ve akış",
    icon: Building2,
  },
  {
    href: "/admin/campaigns",
    label: "Kampanya Mesajları",
    description: "Toplu/tekli mesaj gönder",
    icon: Megaphone,
  },
  {
    href: "/admin/security",
    label: "Güvenlik",
    description: "2FA ve oturumlar",
    icon: ShieldCheck,
  },
];

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const currentSection = useMemo(
    () => navItems.find((item) => isItemActive(pathname, item.href))?.label || "Yönetim",
    [pathname]
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-600/10" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-700/10" />
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
        <div className="flex h-[4.75rem] items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-800">
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
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Admin Panel</p>
            </div>
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(100%-4.75rem)] flex-col gap-4 p-4">
          <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4 dark:border-cyan-900/50 dark:from-cyan-950/30 dark:via-slate-900 dark:to-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Hızlı İşlem
            </p>
            <Link
              href="/admin/tenants/new"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              Yeni İşletme
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
                    <span
                      className={`mt-0.5 block truncate text-xs ${
                        active ? "text-white/80 dark:text-slate-900/80" : "text-slate-500 dark:text-slate-500"
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tema</span>
              <ThemeToggle />
            </div>
            <AdminLogout />
          </div>
        </div>
      </aside>

      <div className="relative lg:pl-[18rem]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/75">
          <div className="mx-auto flex h-[4.75rem] w-full max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Menüyü aç"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Yönetim
                </p>
                <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {currentSection}
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/admin/tenants/new"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Hızlı Ekle
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
