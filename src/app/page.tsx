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
      solutions: "Neler var",
      guide: "Nasıl çalışır",
      businesses: "İşletmeler",
      contact: "İletişim",
      login: "Giriş",
    },
    hero: {
      eyebrow: "WhatsApp → panel → net gün",
      title: "İşletmenin temposunu\ntek ekranda tut.",
      desc:
        "Mesajlar, randevular ve müşteri notları dağılmasın. Ahi AI, WhatsApp talebini takvime ve ekip işine bağlar.",
      primary: "Panele gir",
      secondary: "Nasıl çalışır?",
      tertiary: "Canlı işletmeler",
    },
    stats: [
      { value: "1", label: "panel" },
      { value: "7", label: "ana akış" },
      { value: "24/7", label: "mesaj kapısı" },
    ],
    preview: {
      title: "Bugün",
      open: "3 açık",
      rows: [
        { time: "10:00", name: "Ayşe Y.", service: "Kesim", status: "Onaylı" },
        { time: "11:30", name: "Mehmet K.", service: "Bakım", status: "Bekliyor" },
        { time: "14:00", name: "Zeynep A.", service: "Paket", status: "Onaylı" },
      ],
    },
    solutionsTitle: "Günün içinde ne işe yarar",
    solutions: [
      {
        title: "Randevu",
        text: "Uygun saat, iptal, gelmeme — takvim net kalsın.",
        wide: true,
      },
      {
        title: "Müşteri defteri",
        text: "Not ve geçmiş bir sonraki ziyarette hazır.",
        wide: false,
      },
      {
        title: "Kampanya",
        text: "Uzaklaşanı kısa mesajla geri çağır.",
        wide: false,
      },
      {
        title: "Kontrol",
        text: "Gecikme ve kritik işler öncelik sırasıyla.",
        wide: true,
      },
    ],
    flowTitle: "Akış kısa",
    flow: [
      { step: "01", title: "Yazar", text: "WhatsApp / link / QR" },
      { step: "02", title: "Kurallar", text: "Saat, hizmet, doluluk" },
      { step: "03", title: "Kayıt", text: "Randevu + not" },
      { step: "04", title: "Panel", text: "Ekip ne yapacağını görür" },
    ],
    cta: {
      title: "Dağınık araçları bırak.",
      text: "Kurulumla birlikte başlarız. Abartısız anlatırız.",
      primary: "İletişime geç",
      secondary: "Detaylı anlatım",
    },
    footer: "Ahi AI — işletme operasyon yazılımı",
  },
  en: {
    nav: {
      solutions: "What's inside",
      guide: "How it works",
      businesses: "Businesses",
      contact: "Contact",
      login: "Sign in",
    },
    hero: {
      eyebrow: "WhatsApp → panel → clear day",
      title: "Keep the shop’s tempo\non one screen.",
      desc:
        "Chats, bookings, and customer notes shouldn’t scatter. Ahi AI ties WhatsApp demand to your calendar and team work.",
      primary: "Open panel",
      secondary: "How it works",
      tertiary: "Live businesses",
    },
    stats: [
      { value: "1", label: "panel" },
      { value: "7", label: "core flows" },
      { value: "24/7", label: "message door" },
    ],
    preview: {
      title: "Today",
      open: "3 open",
      rows: [
        { time: "10:00", name: "Ayse Y.", service: "Cut", status: "Confirmed" },
        { time: "11:30", name: "Mehmet K.", service: "Care", status: "Pending" },
        { time: "14:00", name: "Zeynep A.", service: "Package", status: "Confirmed" },
      ],
    },
    solutionsTitle: "What it helps with today",
    solutions: [
      {
        title: "Booking",
        text: "Slots, cancels, no-shows — keep the calendar honest.",
        wide: true,
      },
      {
        title: "Customer book",
        text: "Notes and history ready for the next visit.",
        wide: false,
      },
      {
        title: "Campaigns",
        text: "Bring quiet customers back with short messages.",
        wide: false,
      },
      {
        title: "Control",
        text: "Delays and critical work, ordered by priority.",
        wide: true,
      },
    ],
    flowTitle: "Short flow",
    flow: [
      { step: "01", title: "Message", text: "WhatsApp / link / QR" },
      { step: "02", title: "Rules", text: "Hours, service, capacity" },
      { step: "03", title: "Record", text: "Booking + notes" },
      { step: "04", title: "Panel", text: "Team sees next steps" },
    ],
    cta: {
      title: "Leave the scattered tools.",
      text: "We start with setup. We explain without hype.",
      primary: "Contact us",
      secondary: "Full guide",
    },
    footer: "Ahi AI — business operations software",
  },
} as const;

function ProductStage({
  title,
  open,
  rows,
}: {
  title: string;
  open: string;
  rows: readonly { time: string; name: string; service: string; status: string }[];
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -left-6 top-10 hidden h-40 w-40 rounded-full bg-[var(--brand)]/20 blur-3xl lg:block"
      />
      <div
        aria-hidden
        className="absolute -right-4 bottom-0 hidden h-32 w-32 rounded-full bg-sky-400/10 blur-3xl lg:block"
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[var(--card)] shadow-[var(--shadow-lg)] ring-1 ring-[var(--brand)]/25">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">{title}</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">WhatsApp · panel</p>
          </div>
          <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-bold text-[var(--brand-foreground)]">
            {open}
          </span>
        </div>
        <ul>
          {rows.map((row, i) => (
            <li
              key={`${row.time}-${row.name}`}
              className={`grid grid-cols-[4.75rem_1fr_auto] items-center gap-3 px-5 py-4 ${
                i !== rows.length - 1 ? "border-b border-white/6" : ""
              } ${i === 1 ? "bg-[var(--brand-soft)]" : ""}`}
            >
              <span className="font-display text-base font-semibold tabular-nums">{row.time}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{row.service}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  row.status === "Onaylı" || row.status === "Confirmed"
                    ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                    : "bg-white/8 text-[var(--muted-foreground)]"
                }`}
              >
                {row.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Home() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="site-signal min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0c0e12]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--card)] ring-1 ring-[var(--brand)]/40">
              <Image src="/appicon.png" alt="" width={40} height={40} className="object-cover" priority />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Ahi AI</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--muted-foreground)] md:flex">
            <a href="#solutions" className="hover:text-[var(--foreground)]">
              {t.nav.solutions}
            </a>
            <Link href="/nasil-calisir" className="hover:text-[var(--foreground)]">
              {t.nav.guide}
            </Link>
            <Link href="/isletmeler" className="hover:text-[var(--foreground)]">
              {t.nav.businesses}
            </Link>
            <button type="button" onClick={() => setShowContact(true)} className="hover:text-[var(--foreground)]">
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-full bg-[var(--primary)] px-4 py-2 font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
            >
              {t.nav.login}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeLocaleSwitch compact />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[var(--card)] md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="grid gap-1 border-t border-white/8 bg-[var(--card)] px-4 py-3 md:hidden">
            <a href="#solutions" className="rounded-lg px-3 py-2.5 text-sm" onClick={() => setMobileOpen(false)}>
              {t.nav.solutions}
            </a>
            <Link href="/nasil-calisir" className="rounded-lg px-3 py-2.5 text-sm" onClick={() => setMobileOpen(false)}>
              {t.nav.guide}
            </Link>
            <Link href="/isletmeler" className="rounded-lg px-3 py-2.5 text-sm" onClick={() => setMobileOpen(false)}>
              {t.nav.businesses}
            </Link>
            <button
              type="button"
              className="rounded-lg px-3 py-2.5 text-left text-sm"
              onClick={() => {
                setShowContact(true);
                setMobileOpen(false);
              }}
            >
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="mt-1 rounded-full bg-[var(--primary)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--primary-foreground)]"
              onClick={() => setMobileOpen(false)}
            >
              {t.nav.login}
            </Link>
          </div>
        )}
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-24 lg:pt-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand)]" />
              <span className="text-xs font-semibold tracking-wide text-[var(--brand)]">{t.hero.eyebrow}</span>
            </div>
            <h1 className="font-display mt-6 whitespace-pre-line text-[2.7rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.1rem]">
              {t.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">
              {t.hero.desc}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/dashboard/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)] shadow-[0_0_40px_-8px_rgb(212_245_103_/_0.55)] transition hover:bg-[var(--primary-hover)]"
              >
                {t.hero.primary}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/nasil-calisir"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold backdrop-blur transition hover:bg-white/10"
              >
                {t.hero.secondary}
              </Link>
              <Link
                href="/isletmeler"
                className="inline-flex min-h-12 items-center justify-center px-2 text-sm font-semibold text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
              >
                {t.hero.tertiary}
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
              {t.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center"
                >
                  <p className="font-display text-2xl font-semibold text-[var(--brand)]">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <ProductStage title={t.preview.title} open={t.preview.open} rows={t.preview.rows} />
        </section>

        <section id="solutions" className="border-y border-white/8 bg-black/20">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">
              {t.solutionsTitle}
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {t.solutions.map((item) => (
                <article
                  key={item.title}
                  className={`group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[var(--card)] p-6 shadow-[var(--shadow-md)] transition hover:border-[var(--brand)]/40 ${
                    item.wide ? "md:min-h-[11rem]" : ""
                  }`}
                >
                  <div
                    aria-hidden
                    className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--brand)]/10 transition group-hover:bg-[var(--brand)]/20"
                  />
                  <h3 className="font-display relative text-2xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="relative mt-3 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t.flowTitle}</h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.flow.map((item) => (
              <li
                key={item.step}
                className="rounded-[1.35rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5"
              >
                <span className="font-display text-sm font-bold text-[var(--brand)]">{item.step}</span>
                <h3 className="font-display mt-3 text-xl font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 overflow-hidden rounded-[2rem] border border-[var(--brand)]/25 bg-[var(--card)] p-8 shadow-[var(--shadow-lg)] sm:flex-row sm:items-end sm:justify-between sm:p-10">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">Ahi AI</p>
              <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{t.cta.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">{t.cta.text}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)]"
              >
                {t.cta.primary}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <Link
                href="/nasil-calisir"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold"
              >
                {t.cta.secondary}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 px-4 py-8 text-sm text-[var(--muted-foreground)] sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>{t.footer}</p>
          <div className="flex gap-4">
            <Link href="/nasil-calisir" className="hover:text-[var(--foreground)]">
              {t.nav.guide}
            </Link>
            <button type="button" onClick={() => setShowContact(true)} className="hover:text-[var(--foreground)]">
              {t.nav.contact}
            </button>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
    </div>
  );
}
