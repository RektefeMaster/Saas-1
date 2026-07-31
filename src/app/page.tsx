"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui";

const ContactModal = dynamic(
  () => import("@/components/ui/ContactModal").then((m) => ({ default: m.ContactModal })),
  { ssr: false, loading: () => null }
);

const COPY = {
  tr: {
    nav: {
      solutions: "Özellikler",
      flow: "Akış",
      businesses: "İşletmeler",
      contact: "İletişim",
      login: "Giriş",
    },
    hero: {
      eyebrow: "İşletme operasyon paneli",
      title: "Randevu, müşteri ve iletişimi tek yerden yönetin.",
      desc:
        "WhatsApp üzerinden gelen talepleri takvime, kayıtlara ve ekip işine bağlayan sade bir işletme paneli. Daha az dağınıklık, daha net gün.",
      primary: "Panele giriş",
      secondary: "Canlı işletmeler",
    },
    preview: {
      title: "Bugünün programı",
      open: "3 açık",
      rows: [
        { time: "10:00", name: "Ayşe Y.", service: "Kesim", status: "Onaylı" },
        { time: "11:30", name: "Mehmet K.", service: "Bakım", status: "Bekliyor" },
        { time: "14:00", name: "Zeynep A.", service: "Paket", status: "Onaylı" },
      ],
      note: "Sıradaki işlem · WhatsApp yanıtı 2 dk içinde",
    },
    solutionsTitle: "Günlük işin omurgası",
    solutionsLead: "Pazarlama dili değil — işletmenin her sabah kullandığı araçlar.",
    solutions: [
      {
        title: "Randevu ve kapasite",
        text: "Uygun saat, iptal ve gelmeme durumlarını tek takvimde görün.",
      },
      {
        title: "Müşteri defteri",
        text: "Not, etiket ve geçmişi kaydedin; bir sonraki ziyaret için hazır olun.",
      },
      {
        title: "Kampanya ve hatırlatma",
        text: "Doğru kişiye kısa mesaj planlayın, uzaklaşanı geri çağırın.",
      },
      {
        title: "Günlük kontrol",
        text: "Gecikme ve kritik bildirimleri öncelik sırasıyla takip edin.",
      },
    ],
    flowTitle: "Mesajdan iş emrine",
    flow: [
      { step: "1", title: "Talep gelir", text: "WhatsApp veya bağlantı üzerinden." },
      { step: "2", title: "Kurallar uygulanır", text: "Saat, hizmet ve kapasite kontrolü." },
      { step: "3", title: "Kayıt oluşur", text: "Randevu, not ve hatırlatma güncellenir." },
      { step: "4", title: "Panel netleşir", text: "Ekip ne yapacağını hemen görür." },
    ],
    cta: {
      title: "Dağınık araçları bırakın.",
      text: "Tek panel. Net öncelikler. Ölçülebilir gün.",
      primary: "İşletme girişi",
      secondary: "İşletmeleri incele",
    },
    footer: "Ahi AI — işletmeler için operasyon yazılımı",
    copyright: "© 2026 Ahi AI",
  },
  en: {
    nav: {
      solutions: "Features",
      flow: "Flow",
      businesses: "Businesses",
      contact: "Contact",
      login: "Sign in",
    },
    hero: {
      eyebrow: "Business operations panel",
      title: "Run bookings, customers, and messaging from one place.",
      desc:
        "A clear operations panel that connects WhatsApp requests to your calendar, records, and team work. Less clutter, clearer days.",
      primary: "Open panel",
      secondary: "Live businesses",
    },
    preview: {
      title: "Today’s schedule",
      open: "3 open",
      rows: [
        { time: "10:00", name: "Ayse Y.", service: "Cut", status: "Confirmed" },
        { time: "11:30", name: "Mehmet K.", service: "Care", status: "Pending" },
        { time: "14:00", name: "Zeynep A.", service: "Package", status: "Confirmed" },
      ],
      note: "Next action · WhatsApp reply within 2 min",
    },
    solutionsTitle: "The backbone of the workday",
    solutionsLead: "Not marketing fluff — tools teams open every morning.",
    solutions: [
      {
        title: "Booking & capacity",
        text: "See availability, cancellations, and no-shows on one calendar.",
      },
      {
        title: "Customer book",
        text: "Keep notes, tags, and history ready for the next visit.",
      },
      {
        title: "Campaigns & reminders",
        text: "Plan short messages to the right people and win them back.",
      },
      {
        title: "Daily control",
        text: "Track delays and critical alerts by priority.",
      },
    ],
    flowTitle: "From message to work order",
    flow: [
      { step: "1", title: "Request arrives", text: "Via WhatsApp or a share link." },
      { step: "2", title: "Rules apply", text: "Time, service, and capacity checks." },
      { step: "3", title: "Record updates", text: "Booking, notes, and reminders sync." },
      { step: "4", title: "Panel clarifies", text: "The team sees what to do next." },
    ],
    cta: {
      title: "Leave scattered tools behind.",
      text: "One panel. Clear priorities. A measurable day.",
      primary: "Business sign-in",
      secondary: "Browse businesses",
    },
    footer: "Ahi AI — operations software for businesses",
    copyright: "© 2026 Ahi AI",
  },
} as const;

function ProductPreview({
  title,
  open,
  rows,
  note,
}: {
  title: string;
  open: string;
  rows: readonly { time: string; name: string; service: string; status: string }[];
  note: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <div>
          <p className="font-display text-sm font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{note}</p>
        </div>
        <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)]">
          {open}
        </span>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <li key={`${row.time}-${row.name}`} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-5 py-3.5">
            <span className="font-display text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {row.time}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">{row.name}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">{row.service}</p>
            </div>
            <span
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                row.status === "Onaylı" || row.status === "Confirmed"
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}
            >
              {row.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={32}
              height={32}
              sizes="32px"
              className="rounded-md"
              priority
            />
            <span className="font-display text-[1.05rem] font-semibold tracking-tight">Ahi AI</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--muted-foreground)] md:flex">
            <a href="#solutions" className="transition-colors hover:text-[var(--foreground)]">
              {t.nav.solutions}
            </a>
            <a href="#flow" className="transition-colors hover:text-[var(--foreground)]">
              {t.nav.flow}
            </a>
            <Link href="/isletmeler" className="transition-colors hover:text-[var(--foreground)]">
              {t.nav.businesses}
            </Link>
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="transition-colors hover:text-[var(--foreground)]"
            >
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
            >
              {t.nav.login}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeLocaleSwitch compact />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] md:hidden"
              aria-label={locale === "tr" ? "Menüyü aç veya kapat" : "Toggle menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 md:hidden">
            <div className="grid gap-1">
              {[
                { href: "#solutions", label: t.nav.solutions },
                { href: "#flow", label: t.nav.flow },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/isletmeler"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium"
              >
                {t.nav.businesses}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowContactModal(true);
                  setMobileMenuOpen(false);
                }}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium"
              >
                {t.nav.contact}
              </button>
              <Link
                href="/dashboard/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-1 rounded-lg bg-[var(--primary)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--primary-foreground)]"
              >
                {t.nav.login}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-20">
          <div className="max-w-xl border-l-2 border-[var(--brand)] pl-5 sm:pl-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
              {t.hero.eyebrow}
            </p>
            <h1 className="font-display mt-4 text-[2.35rem] font-semibold leading-[1.12] tracking-tight sm:text-5xl">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted-foreground)] sm:text-[1.05rem]">
              {t.hero.desc}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
              >
                {t.hero.primary}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/isletmeler"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
              >
                {t.hero.secondary}
              </Link>
            </div>
          </div>

          <ProductPreview
            title={t.preview.title}
            open={t.preview.open}
            rows={t.preview.rows}
            note={t.preview.note}
          />
        </section>

        <section id="solutions" className="border-y border-[var(--border)] bg-[var(--card)]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {t.solutionsTitle}
              </h2>
              <p className="mt-3 text-base text-[var(--muted-foreground)]">{t.solutionsLead}</p>
            </div>
            <div className="mt-10 grid gap-0 border-t border-[var(--border)] sm:grid-cols-2">
              {t.solutions.map((item, index) => (
                <article
                  key={item.title}
                  className={`border-b border-[var(--border)] py-7 sm:px-6 sm:py-8 ${
                    index % 2 === 0 ? "sm:border-r sm:pl-0" : ""
                  } ${index < 2 ? "" : ""}`}
                >
                  <p className="font-display text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">
                    0{index + 1}
                  </p>
                  <h3 className="font-display mt-3 text-xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="flow" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t.flowTitle}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {t.flow.map((item) => (
              <li key={item.step} className="relative">
                <span className="font-display text-4xl font-semibold text-[color-mix(in_oklab,var(--brand)_35%,transparent)]">
                  {item.step}
                </span>
                <h3 className="font-display mt-2 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--primary)] text-[var(--primary-foreground)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t.cta.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[color-mix(in_oklab,var(--primary-foreground)_72%,transparent)] sm:text-base">
                {t.cta.text}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/login"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-foreground)]"
              >
                {t.cta.primary}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/isletmeler"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--primary-foreground)_25%,transparent)] px-5 text-sm font-semibold"
              >
                {t.cta.secondary}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-4 py-8 text-sm text-[var(--muted-foreground)] sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.footer}</p>
          <div className="flex items-center gap-4">
            <span>{t.copyright}</span>
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
            >
              {t.nav.contact}
            </button>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
}
