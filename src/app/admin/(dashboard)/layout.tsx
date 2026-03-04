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
  Users,
  X,
} from "lucide-react";
import { AdminLogout } from "../admin-logout";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "İşletmeler", icon: Users },
  { href: "/admin/business-types", label: "İşletme Tipleri", icon: Building2 },
  { href: "/admin/campaigns", label: "Kampanyalar", icon: Megaphone },
  { href: "/admin/security", label: "Güvenlik", icon: ShieldCheck },
];

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const currentSection = useMemo(
    () => NAV_ITEMS.find((item) => isItemActive(pathname, item.href))?.label ?? "Admin",
    [pathname]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/appicon.png" alt="Ahi AI" width={28} height={28} className="rounded-lg" />
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
              className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" />
              Yeni İşletme
            </Link>
            {NAV_ITEMS.map((item) => {
              const active = isItemActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
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
            <Link
              href="/admin/tenants/new"
              className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Yeni İşletme
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="p-4 pb-20 sm:p-6 lg:pb-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-[10px] font-medium ${
                  active ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
