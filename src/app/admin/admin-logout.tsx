"use client";

export function AdminLogout() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/auth/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
      className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
    >
      Çıkış yap
    </button>
  );
}
