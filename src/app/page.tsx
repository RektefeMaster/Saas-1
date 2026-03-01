import Link from "next/link";
import Image from "next/image";
import { Calendar, MessageCircle, Shield, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Image
        src="/arkaplan.png"
        alt="Ahi AI arkaplan"
        fill
        priority
        className="pointer-events-none object-cover opacity-[0.11] blur-[1.5px]"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-900/0 to-blue-500/15" />

      <header className="relative z-10 border-b border-slate-200/90 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            <Image src="/appicon.png" alt="Ahi AI logo" width={34} height={34} className="rounded-md bg-white p-0.5 shadow-sm" />
            Ahi AI
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/isletmeler"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              İşletmeler
            </Link>
            <Link
              href="/dashboard/login"
              className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              Giriş Yap
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            <Sparkles className="h-3.5 w-3.5" />
            Randevu Yönetim Platformu
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            WhatsApp ile çalışan
            <span className="bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent"> akıllı işletme paneli</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Ahi AI ile işletmelerin takvim, fiyat listesi, CRM ve iş akışını tek yerden yönetin.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-700 sm:w-auto"
            >
              İşletme Paneli
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <ul className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Calendar,
                title: "Takvim ve müsaitlik",
                text: "Randevular, izin günleri ve slotlar tek ekranda",
              },
              {
                icon: MessageCircle,
                title: "WhatsApp entegrasyonu",
                text: "QR, link ve bot mesajlarıyla hızlı randevu",
              },
              {
                icon: Shield,
                title: "Güvenli erişim",
                text: "Admin ve işletme girişinde çok katmanlı kontrol",
              },
            ].map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-left shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-200/90 py-6 dark:border-slate-800/80">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Ahi AI. Tüm hakları saklıdır.
        </p>
      </footer>
    </div>
  );
}
