"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 font-medium text-green-700"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {initial}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Çıkış Yap
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardHeader({
  tenantId,
  tenantName,
  user,
}: {
  tenantId: string | null;
  tenantName: string | null;
  user: User | null;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <Link
        href="/dashboard"
        className="text-lg font-bold text-green-600 hover:text-green-700"
      >
        AHİ AI
      </Link>
      <div className="font-medium text-slate-700">
        {tenantName ?? (tenantId ? "Yükleniyor..." : "")}
      </div>
      <UserMenu user={user} />
    </header>
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
      .then((data) => setTenantName(data?.name ?? null))
      .catch(() => setTenantName(null));
  }, [pathname, isLogin]);

  useEffect(() => {
    if (isLogin) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null));
  }, [isLogin]);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <DashboardHeader
        tenantId={tenantId}
        tenantName={tenantName}
        user={user}
      />
      {children}
    </>
  );
}
