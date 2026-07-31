"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  Globe,
  MessageCircle,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  Workflow,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const ContactModal = dynamic(
  () => import("@/components/ui/ContactModal").then((m) => ({ default: m.ContactModal })),
  { ssr: false, loading: () => null }
);

const COPY = {
  tr: {
    nav: {
      solutions: "Neler Sunuyor",
      flow: "Nasıl Çalışır",
      impact: "Sonuçlar",
      businesses: "İşletmeler",
      contact: "İletişim",
      login: "Giriş",
    },
    hero: {
      badge: "Ahi AI · Yeni Nesil İşletme Merkezi",
      titleA: "İşletmenizi büyüten dijital vitrin.",
      titleB: "Randevu, iletişim ve takip tek panelde.",
      desc:
        "Müşteri mesajından randevuya, hatırlatmadan değerlendirmeye kadar tüm süreci tek yerden yönetirsiniz. Ekip daha az yorulur, müşteri daha hızlı yanıt alır, gününüz daha planlı akar.",
      primary: "Paneli İncele",
      secondary: "İşletmeleri Gör",
      points: [
        "Randevu, müşteri notu ve hatırlatma aynı ekranda",
        "İşletmeye özel güvenli altyapı ve yetki kontrolü",
        "Telefonda da masaüstünde de hızlı kullanım",
      ],
    },
    metrics: [
      { label: "Günlük Yanıt Hızı", value: "Dakikalar içinde" },
      { label: "Tek Panelde Yönetim", value: "7 ana akış" },
      { label: "Uygun Sektör Yapısı", value: "5 farklı alan" },
    ],
    solutionsTitle: "İşletmenizi Baştan Sona Güçlendiren Yapı",
    solutions: [
      {
        title: "Randevu ve Kapasite Yönetimi",
        text: "Takvim, uygun saat, iptal ve gelmeme durumlarını tek ekranda yönetin.",
        icon: CalendarDays,
      },
      {
        title: "Müşteri Hafızası ve Akıllı Gruplama",
        text: "Müşteri notlarını, etiketleri ve geçmiş davranışları hızlı aksiyona dönüştürün.",
        icon: BrainCircuit,
      },
      {
        title: "Kampanya ve Geri Kazanım",
        text: "Doğru kitleye doğru mesajı planlayın, uzaklaşan müşteriyi yeniden kazanın.",
        icon: MessageSquareText,
      },
      {
        title: "Günlük Yönetim Merkezi",
        text: "Gecikme, iptal ve kritik bildirimleri tek bakışta görün, ekibe net görev verin.",
        icon: CircleGauge,
      },
      {
        title: "Yapay Zeka Destekli Asistan",
        text: "İşletme tipinize göre çalışan asistanla daha doğru ve tutarlı yanıtlar verin.",
        icon: Bot,
      },
      {
        title: "Güvenli ve Büyüyebilir Altyapı",
        text: "İki adımlı doğrulama, işlem kayıtları ve güvenli erişimle işletmenizi rahatça büyütün.",
        icon: ShieldCheck,
      },
    ],
    flowTitle: "Müşteri Yolculuğu Baştan Sona Tek Akışta",
    flow: [
      {
        step: "01",
        title: "Müşteri size ulaşır",
        text: "Mesaj veya bağlantı üzerinden gelen talep anında yakalanır.",
      },
      {
        step: "02",
        title: "Sistem talebi yorumlar",
        text: "İşletme kuralları, uygun saatler ve geçmiş veriler birlikte değerlendirilir.",
      },
      {
        step: "03",
        title: "Süreç otomatik ilerler",
        text: "Randevu, hatırlatma ve müşteri notları anında güncellenir.",
      },
      {
        step: "04",
        title: "Yönetici net tabloyu görür",
        text: "Performans göstergeleri, riskler ve fırsatlar tek ekranda net şekilde görünür.",
      },
    ],
    cta: {
      title: "İşinizi büyütürken yönetimi sadeleştirin.",
      text: "Dağınık araçlardan kurtulup tek, anlaşılır ve ölçülebilir bir düzene geçin.",
      primary: "İşletme Girişi",
      secondary: "İşletmeleri İncele",
    },
    footer: "Ahi AI · İşletmeler için yapay zeka destekli yönetim platformu",
    copyright: "© 2026 Ahi AI. Tüm hakları saklıdır.",
  },
  en: {
    nav: {
      solutions: "Solutions",
      flow: "Flow",
      impact: "Impact",
      businesses: "Businesses",
      contact: "Contact",
      login: "Login",
    },
    hero: {
      badge: "Ahi AI · Business Operating System",
      titleA: "Smart infrastructure for your business.",
      titleB: "The AI platform that runs your operations.",
      desc:
        "Ahi AI brings operations, booking, CRM, campaigns, and team productivity together in a single intelligent flow. Customer experience improves, your team works with less friction, and revenue becomes more predictable.",
      primary: "Explore the Panel",
      secondary: "Live Businesses",
      points: [
        "Booking + CRM + Automation in a single panel",
        "Multi-tenant architecture and role-based security",
        "Mobile-first, fast, and minimal operations",
      ],
    },
    metrics: [
      { label: "Intelligent Flow Modules", value: "12+" },
      { label: "Panel Response Time", value: "<120ms" },
      { label: "Supported Business Models", value: "5 sectors" },
    ],
    solutionsTitle: "What the Platform Brings Together",
    solutions: [
      {
        title: "Booking and Capacity Management",
        text: "Manage calendar, availability, cancellation, no-show and rebooking flows from one place.",
        icon: CalendarDays,
      },
      {
        title: "Customer Memory and Segmentation",
        text: "Turn customer notes, tags, reminders and behavior history into action.",
        icon: BrainCircuit,
      },
      {
        title: "Campaigns and Win-Back",
        text: "Plan the right message for the right audience and win back lost customers.",
        icon: MessageSquareText,
      },
      {
        title: "Operations Command Center",
        text: "See delays, cancellations and critical alerts at a glance and assign clear ownership in the team.",
        icon: CircleGauge,
      },
      {
        title: "AI Assistants",
        text: "Use business-type specific assistant profiles for more accurate answers.",
        icon: Bot,
      },
      {
        title: "Security and Scale",
        text: "Grow with 2FA, audit logs, tenant isolation and secure API access.",
        icon: ShieldCheck,
      },
    ],
    flowTitle: "Customer Journey and Internal Operations in One Chain",
    flow: [
      {
        step: "01",
        title: "Customer initiates contact",
        text: "Intent is captured through message, link, or form.",
      },
      {
        step: "02",
        title: "AI processes context",
        text: "Business rules, availability and historical data are evaluated together.",
      },
      {
        step: "03",
        title: "Action becomes automatic",
        text: "Booking, reminders, customer notes and alerts are updated in sync.",
      },
      {
        step: "04",
        title: "Clear visibility in the dashboard",
        text: "KPIs, risks, opportunities and tasks are presented for decision-making.",
      },
    ],
    cta: {
      title: "Simplify operations while growing the business.",
      text: "Move from scattered tools to a single intelligent and measurable system with Ahi AI.",
      primary: "Business Login",
      secondary: "Live Businesses",
    },
    footer: "Ahi AI · AI-powered software platform for businesses",
    copyright: "© 2026 Ahi AI. All rights reserved.",
  },
} as const;

export default function Home() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_15%_0%,rgba(5,150,105,0.12),transparent_70%)]" />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={34}
              height={34}
              sizes="34px"
              className="rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
              priority
            />
            <span className="text-lg font-semibold tracking-tight">Ahi AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <a href="#solutions" className="transition-colors duration-150 hover:text-slate-900 dark:hover:text-white">
              {t.nav.solutions}
            </a>
            <a href="#flow" className="transition-colors duration-150 hover:text-slate-900 dark:hover:text-white">
              {t.nav.flow}
            </a>
            <Link href="/isletmeler" className="transition-colors duration-150 hover:text-slate-900 dark:hover:text-white">
              {t.nav.businesses}
            </Link>
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="transition-colors duration-150 hover:text-slate-900 dark:hover:text-white"
            >
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-white transition-colors duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              {t.nav.login}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeLocaleSwitch compact />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label={locale === "tr" ? "Menüyü aç veya kapat" : "Toggle menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="mobile-card-stack">
              <a
                href="#solutions"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t.nav.solutions}
              </a>
              <a
                href="#flow"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t.nav.flow}
              </a>
              <Link
                href="/isletmeler"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t.nav.businesses}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowContactModal(true);
                  setMobileMenuOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t.nav.contact}
              </button>
              <Link
                href="/dashboard/login"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white dark:bg-emerald-500 dark:text-slate-950"
              >
                {t.nav.login}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
          <div className="animate-hero-in mx-auto max-w-3xl text-center opacity-0">
            <p className="text-sm font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
              Ahi AI
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {t.hero.titleA}{" "}
              <span className="text-emerald-700 dark:text-emerald-400">{t.hero.titleB}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              {t.hero.desc}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
              >
                {t.hero.primary}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/isletmeler"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Globe className="h-4 w-4" aria-hidden />
                {t.hero.secondary}
              </Link>
            </div>
            <ul className="mx-auto mt-8 grid max-w-xl gap-2 text-left">
              {t.hero.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="solutions" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <ScrollReveal variant="fadeUp">
            <div className="mb-8 flex items-center gap-3">
              <Workflow className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.solutionsTitle}</h2>
            </div>
          </ScrollReveal>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {t.solutions.map((item, index) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} delay={0.04 + index * 0.06} variant="fadeUp">
                  <article className="h-full rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.text}
                    </p>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        <section id="flow" className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
          <ScrollReveal variant="fadeUp">
            <div className="mb-6 flex items-center gap-3">
              <Rocket className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.flowTitle}</h2>
            </div>
          </ScrollReveal>
          <div className="grid gap-3 md:grid-cols-2">
            {t.flow.map((item, index) => (
              <ScrollReveal key={item.step} delay={0.05 + index * 0.05} variant="scale">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <span className="font-mono text-xs font-bold tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                    {item.step}
                  </span>
                  <h3 className="mt-1.5 text-base font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
          <ScrollReveal variant="fadeUp">
            <div className="rounded-2xl border border-emerald-700/20 bg-emerald-700 p-8 text-white dark:border-emerald-500/30 dark:bg-emerald-800 sm:p-10">
              <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{t.cta.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50 sm:text-base">
                {t.cta.text}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/dashboard/login"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-emerald-900 transition-colors duration-150 hover:bg-emerald-50"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  {t.cta.primary}
                </Link>
                <Link
                  href="/isletmeler"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20"
                >
                  <Globe className="h-4 w-4" aria-hidden />
                  {t.cta.secondary}
                </Link>
                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {t.nav.contact}
                </button>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>{t.footer}</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>{t.copyright}</span>
          <span className="hidden sm:inline">·</span>
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {t.nav.contact}
          </button>
        </p>
      </footer>

      <ContactModal isOpen={showContactModal} onClose={() => setShowContactModal(false)} />
    </div>
  );
}
