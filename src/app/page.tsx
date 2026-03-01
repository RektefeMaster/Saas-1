import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-4xl font-bold tracking-tight text-green-600">
          AHİ AI
        </h1>
        <p className="mt-2 text-base text-slate-500">
          WhatsApp ile randevu alan yapay zeka asistan
        </p>
        <div className="mt-10 flex w-64 flex-col gap-3">
          <Link
            href="/dashboard/login"
            className="rounded-xl bg-green-600 py-3 font-semibold text-white shadow-md transition-colors hover:bg-green-700"
          >
            Müşteri Paneli
          </Link>
          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white py-3 font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Admin Paneli
          </Link>
        </div>
      </main>
      <footer className="mt-auto py-6 text-xs text-slate-400">
        © 2025 AHİ AI
      </footer>
    </div>
  );
}
