import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <main className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          SaaSRandevu
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          WhatsApp ile randevu alan yapay zeka asistanı
        </p>
        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/isletmeler"
            className="rounded-xl border-2 border-slate-300 px-8 py-4 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            İşletme Listesi
          </Link>
          <Link
            href="/admin"
            className="rounded-xl bg-emerald-600 px-8 py-4 font-medium text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700"
          >
            Admin Paneli
          </Link>
        </div>
      </main>
    </div>
  );
}
