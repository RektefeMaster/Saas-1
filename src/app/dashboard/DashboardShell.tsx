"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageCircle,
  QrCode,
  ChevronDown,
  LogOut,
  Calendar,
  ListChecks,
  KanbanSquare,
  Users,
  Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

const baseUrl =
  typeof window !== "undefined" ? window.location.origin : "";

function UserMenu({ user }: { user: User | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/api/dashboard/auth/otp/clear", { method: "POST" }).catch(() => {});
    setOpen(false);
    router.push("/dashboard/login");
    router.refresh();
  };

  const initial = user?.email?.slice(0, 1).toUpperCase() ?? "?";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
          {initial}
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {user?.email ?? "Hesap"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-800">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {user?.email}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                İşletme paneli
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Çıkış Yap
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/dashboard/login";

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [moduleVisibility, setModuleVisibility] = useState<Record<string, boolean> | null>(null);
  const [moduleOrder, setModuleOrder] = useState<string[] | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (isLogin) return;
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[1] && parts[0] === "dashboard" ? parts[1] : null;
    setTenantId(id);
    if (!id) {
      setTenantName(null);
      return;
    }
    fetch(`${baseUrl}/api/tenant/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTenantName(data?.name ?? null);
        const uiPrefs =
          (data?.ui_preferences as Record<string, unknown> | undefined) ||
          (data?.config_override?.ui_preferences as Record<string, unknown> | undefined) ||
          {};
        setModuleVisibility((uiPrefs.moduleVisibility as Record<string, boolean>) || null);
        setModuleOrder(
          Array.isArray(uiPrefs.moduleOrder) ? (uiPrefs.moduleOrder as string[]) : null
        );
      })
      .catch(() => {
        setTenantName(null);
        setModuleVisibility(null);
        setModuleOrder(null);
      });
  }, [pathname, isLogin]);

  useEffect(() => {
    if (isLogin) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
  }, [isLogin]);

  if (isLogin) {
    return <>{children}</>;
  }

  const isTenantPage = !!tenantId;
  const navItems = (() => {
    if (!tenantId) return [];
    const baseItems = [
      { key: "overview", href: `/dashboard/${tenantId}`, label: "Özet & Takvim", icon: LayoutDashboard },
      { key: "pricing", href: `/dashboard/${tenantId}/pricing`, label: "Fiyat Listesi", icon: ListChecks },
      { key: "workflow", href: `/dashboard/${tenantId}/workflow`, label: "İş Akışı", icon: KanbanSquare },
      { key: "crm", href: `/dashboard/${tenantId}/crm`, label: "CRM Defteri", icon: Users },
      { key: "settings", href: `/dashboard/${tenantId}/settings`, label: "Ayarlar", icon: Settings },
    ];

    let visible = baseItems;
    if (moduleVisibility) {
      visible = baseItems.filter((item) => moduleVisibility[item.key] !== false);
    }

    if (!moduleOrder || moduleOrder.length === 0) return visible;
    const rank = new Map(moduleOrder.map((key, index) => [key, index]));
    return [...visible].sort((a, b) => {
      const aRank = rank.get(a.key) ?? 999;
      const bRank = rank.get(b.key) ?? 999;
      return aRank - bRank;
    });
  })();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Üst bar - tüm sayfalar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg transition hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
              <Calendar className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Ahi AI
            </span>
          </Link>
          {tenantName && (
            <span className="hidden border-l border-slate-200 pl-4 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400 sm:block">
              {tenantName}
            </span>
          )}
          {tenantId && !tenantName && (
            <span className="hidden text-sm text-slate-400 sm:block">
              Yükleniyor...
            </span>
          )}
        </div>
        <UserMenu user={user} />
      </header>

      {/* Tenant sayfasında: sidebar + içerik */}
      {isTenantPage ? (
        <div className="flex">
          <aside className="fixed left-0 top-16 z-20 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
            <nav className="flex flex-1 flex-col gap-1 p-4">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-cyan-100/70 text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500"}`} />
                    {label}
                  </Link>
                );
              })}
              <a
                href={`${baseUrl}/api/tenant/${tenantId}/link`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
              >
                <MessageCircle className="h-5 w-5 shrink-0 text-slate-500" />
                WhatsApp Linki
              </a>
              <a
                href={`${baseUrl}/api/tenant/${tenantId}/qr?format=png`}
                download
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <QrCode className="h-5 w-5 shrink-0 text-slate-500" />
                QR Kod İndir
              </a>
            </nav>
          </aside>

          <main className="min-h-[calc(100vh-4rem)] flex-1 lg:pl-64">
            {children}
          </main>
        </div>
      ) : (
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      )}
    </div>
  );
}
