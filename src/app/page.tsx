import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  MessageCircle,
  Shield,
  ArrowRight,
  Sparkles,
  Users,
  Clock3,
  Phone,
  CheckCircle2,
} from "lucide-react";

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
            <Image
              src="/appicon.png"
              alt="Ahi AI logo"
              width={34}
              height={34}
              className="rounded-md bg-white p-0.5 shadow-sm"
            />
            Ahi AI
          </span>
          <nav className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/isletmeler"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              İşletmeler
            </Link>
            <Link
              href="/dashboard/login"
              className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 sm:px-4 sm:py-2.5"
            >
              Giriş Yap
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-4 py-12 sm:py-16">
        <section className="mx-auto w-full max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
                <Sparkles className="h-3.5 w-3.5" />
                İşletmeler İçin Akıllı Randevu Asistanı
              </span>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
                Müşteriniz WhatsApp&apos;tan yazar,
                <span className="bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent">
                  {" "}
                  Ahi AI randevuyu düzenli şekilde alır.
                </span>
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
                Teknik terimlerle uğraşmadan takviminizi, fiyat bilgilerinizi ve müşteri notlarınızı
                tek panelde kolayca yönetirsiniz. Mobilde, tablette ve masaüstünde sorunsuz çalışır.
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/dashboard/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-700 sm:w-auto"
                >
                  İşletme Paneline Gir
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/isletmeler"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  İşletmeleri Gör
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600 lg:justify-start">
                {["Kurulum 10 dakikada", "Türkçe ve sade kullanım", "Mobil uyumlu panel"].map(
                  (item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 dark:border-slate-800 dark:bg-slate-900/80"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Kayıt ve Kurulum Desteği
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                İşletmenizi hızlıca sisteme eklemek için bize ulaşın. Kurulum ve ilk ayarları birlikte
                tamamlayalım.
              </p>
              <a
                href="tel:05060550239"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700"
              >
                <Phone className="h-4 w-4" />
                0506 055 02 39
              </a>
              <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                Kayıt için iletişime geçebiliriz.
              </p>
            </aside>
          </div>
        </section>

        <section className="mx-auto mt-12 w-full max-w-6xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            İşletmenizde neyi kolaylaştırır?
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Calendar,
                title: "Randevu düzeni",
                text: "Boş saatleri gösterir, çakışmaları azaltır ve günü daha planlı yürütmenizi sağlar.",
              },
              {
                icon: MessageCircle,
                title: "WhatsApp&apos;tan hızlı cevap",
                text: "Müşteri sorularını karşılar, uygun saatleri sunar ve randevu sürecini hızlandırır.",
              },
              {
                icon: Users,
                title: "Müşteri defteri",
                text: "Müşteri notlarını ve geçmişini panelde tutar, sonraki görüşmede hatırlamanızı kolaylaştırır.",
              },
              {
                icon: Clock3,
                title: "Müsaitlik kontrolü",
                text: "Çalışma saatleri ve izin günlerine göre doğru zamanları sunar.",
              },
              {
                icon: Shield,
                title: "Güvenli giriş",
                text: "İşletme paneline girişte hesap güvenliğini koruyan çok adımlı doğrulama sağlar.",
              },
              {
                icon: Sparkles,
                title: "Sade kullanım",
                text: "Teknik bilgi gerektirmez. Ekipçe kısa sürede adapte olabileceğiniz bir yapı sunar.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-12 w-full max-w-6xl rounded-2xl border border-slate-200 bg-white/85 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nasıl çalışır?</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              "İşletme hesabınız açılır ve çalışma saatleriniz tanımlanır.",
              "WhatsApp linkiniz veya QR kodunuz müşterilerle paylaşılır.",
              "Müşteri yazdığında sistem doğru işletmeye bağlanır ve randevu sürecini yönetir.",
            ].map((text, i) => (
              <div
                key={text}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                  Adım {i + 1}
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200/90 py-6 dark:border-slate-800/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-center sm:flex-row sm:px-6 lg:px-8">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} Ahi AI. Tüm hakları saklıdır.
          </p>
          <a
            href="tel:05060550239"
            className="text-sm font-medium text-cyan-700 transition hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            Kayıt için iletişim: 0506 055 02 39
          </a>
        </div>
      </footer>
    </div>
  );
}
