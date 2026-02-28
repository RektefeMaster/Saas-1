import Link from "next/link";
import { AdminLogout } from "../admin-logout";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        <aside className="fixed left-0 top-0 z-10 h-screen w-56 border-r border-slate-200 bg-white">
          <div className="flex h-16 items-center border-b border-slate-200 px-5">
            <Link href="/" className="text-lg font-bold text-slate-900">
              SaaSRandevu
            </Link>
          </div>
          <nav className="flex h-[calc(100vh-4rem)] flex-col p-3">
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/business-types/new"
              className="mt-1 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              İşletme tipi ekle
            </Link>
            <Link
              href="/admin/tenants/new"
              className="mt-1 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Kiracı ekle
            </Link>
            <div className="mt-auto border-t border-slate-200 pt-3">
              <AdminLogout />
            </div>
          </nav>
        </aside>
        <main className="ml-56 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
