"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SiteShell, useSiteContact } from "@/components/site/SiteShell";
import { CounterRail } from "@/components/site/CounterRail";
import { LedgerCard } from "@/components/site/LedgerCard";
import {
  MarkArrow,
  MarkBolt,
  MarkCalendar,
  MarkLedger,
  MarkMirror,
  MarkPulse,
  MarkScissors,
  MarkShield,
  MarkSpeech,
} from "@/components/site/GuildMarks";

const SECTOR_MARKS = [MarkScissors, MarkMirror, MarkPulse, MarkBolt, MarkSpeech];
const LEDGER_MARKS = [MarkLedger, MarkSpeech, MarkCalendar];
const SECOND_MARKS = [MarkCalendar, MarkShield, MarkPulse];

const COPY = {
  tr: {
    hero: {
      brand: "Ahi AI",
      title: "WhatsApp’tan gelen mesaj, randevuya dönüşsün.",
      lead:
        "Çalışma saatlerinize, hizmet sürelerinize ve o günkü doluluğunuza göre yanıtlar. Randevu takvime, müşteri deftere düşer.",
      primary: "Paneli incele",
      secondary: "Nasıl çalışır",
      reassure: ["WhatsApp numaranız değişmez", "Kurulum işletmenize göre yapılır"],
    },
    sectors: {
      title: "Günü randevuyla geçen işler için",
      items: [
        { name: "Kuaför & berber", note: "Yoğun gün, kısa randevu, sürekli mesaj" },
        { name: "Güzellik & bakım", note: "Seanslı işler, paket takibi, hatırlatma" },
        { name: "Klinik & sağlık", note: "Doktor takvimi, kontrol randevusu" },
        { name: "Servis & tamir", note: "İş kabulü, teslim sözü, durum sorusu" },
        { name: "Danışmanlık", note: "Görüşme planı, dönüş takibi" },
      ],
    },
    what: {
      title: "Dağınık defteri tek düzene alır",
      lead:
        "Randevu bir yerde, müşteri notu başka yerde, kampanya listesi telefonun galerisinde durmasın. Hepsi aynı kayıtta birleşir.",
      primary: [
        {
          title: "Müşteri hafızası",
          text: "Kim geldi, ne yaptırdı, ne kadar ödedi, ne not bırakıldı. Ekip aynı kaydı görür.",
        },
        {
          title: "Kampanya ve geri kazanım",
          text: "Uzaklaşan müşteriyi etiketine ve geliş sıklığına göre ayırın, dönüş mesajını planlayın.",
        },
        {
          title: "Günlük komuta",
          text: "Bekleyen yanıt, gecikme, iptal ve gelmeme tek ekranda. Gerekirse sohbeti siz devralırsınız.",
        },
      ],
      secondary: [
        {
          title: "Randevu ve kapasite",
          text: "Takvim, uygun saat, personel tercihi, iptal ve gelmeme akışları.",
        },
        {
          title: "Yetki ve güvenlik",
          text: "Her işletme kendi alanında. Rol bazlı erişim, iki adımlı doğrulama, işlem kaydı.",
        },
        {
          title: "Sektöre göre asistan",
          text: "Kuaförün diliyle kliniğin dili bir değil. Asistan işinize göre ayarlanır.",
        },
      ],
    },
    flow: {
      title: "Müşteri yazar, sistem işler, siz günü yönetirsiniz",
      steps: [
        {
          title: "Müşteri yazar",
          text: "WhatsApp numaranıza, kısa bağlantıya veya vitrindeki QR’a. Yeni uygulama indirmesi gerekmez.",
        },
        {
          title: "Kurallarınız işler",
          text: "Çalışma saatleri, hizmet süreleri, fiyat listesi, personel tercihi ve o anki doluluk birlikte değerlendirilir.",
        },
        {
          title: "Randevu ve kayıt oluşur",
          text: "Uygun saat takvime düşer, müşteri deftere işlenir, hatırlatma sıraya girer.",
        },
        {
          title: "Siz günü yönetirsiniz",
          text: "Panelde bugünün tablosu, bekleyen işler ve riskli randevular görünür.",
        },
      ],
      cta: "Sık sorulanlar ve detaylı anlatım",
    },
    cta: {
      title: "İşinize uyup uymadığına birlikte bakalım",
      text:
        "İşletmenizin temposunu anlatın; neyin işe yarayacağını, neyin gereksiz olduğunu net söyleyelim.",
      primary: "İletişime geç",
      secondary: "Paneli incele",
    },
  },
  en: {
    hero: {
      brand: "Ahi AI",
      title: "Turn WhatsApp messages into bookings.",
      lead:
        "Answers against your opening hours, service durations and the day’s availability. The booking goes on the calendar, the customer goes in the ledger.",
      primary: "Explore the panel",
      secondary: "How it works",
      reassure: ["Your WhatsApp number stays the same", "Setup is shaped around your business"],
    },
    sectors: {
      title: "For trades that run on appointments",
      items: [
        { name: "Salons & barbers", note: "Busy days, short slots, constant messages" },
        { name: "Beauty & care", note: "Multi-session work, packages, reminders" },
        { name: "Clinics & health", note: "Practitioner calendars, follow-up visits" },
        { name: "Repair & service", note: "Intake, promised delivery, status questions" },
        { name: "Consulting", note: "Meeting scheduling, follow-up tracking" },
      ],
    },
    what: {
      title: "Puts a scattered ledger in order",
      lead:
        "Bookings in one place, customer notes in another, the campaign list in someone’s phone gallery. All of it lands in one record instead.",
      primary: [
        {
          title: "Customer memory",
          text: "Who came, what they had, what they paid, what was noted. The whole team sees one record.",
        },
        {
          title: "Campaigns and win-back",
          text: "Sort lapsing customers by tag and visit frequency, then plan the message that brings them back.",
        },
        {
          title: "Daily command",
          text: "Waiting replies, delays, cancellations and no-shows on one screen. Take over the chat when you need to.",
        },
      ],
      secondary: [
        {
          title: "Booking and capacity",
          text: "Calendar, open slots, staff preference, cancellation and no-show flows.",
        },
        {
          title: "Access and security",
          text: "Each business in its own space. Role-based access, two-factor login, audit trail.",
        },
        {
          title: "Assistant per sector",
          text: "A salon doesn’t speak like a clinic. The assistant is tuned to your trade.",
        },
      ],
    },
    flow: {
      title: "They write, the system works, you run the day",
      steps: [
        {
          title: "The customer writes",
          text: "To your WhatsApp number, a short link, or the QR code in your window. No app to install.",
        },
        {
          title: "Your rules run",
          text: "Opening hours, service durations, price list, staff preference and current availability are weighed together.",
        },
        {
          title: "Booking and record appear",
          text: "The open slot goes on the calendar, the customer goes in the ledger, the reminder is queued.",
        },
        {
          title: "You run the day",
          text: "The panel shows today’s picture, pending work and bookings at risk.",
        },
      ],
      cta: "FAQs and the full walkthrough",
    },
    cta: {
      title: "Let’s see whether it fits",
      text:
        "Tell us how your business runs and we’ll say plainly what will help and what won’t.",
      primary: "Get in touch",
      secondary: "Explore the panel",
    },
  },
} as const;

function HomeContent() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const openContact = useSiteContact();

  return (
    <main>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 85% 10%, color-mix(in oklab, var(--ahi-brand) 10%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in oklab, var(--ahi-brand) 4%, transparent) 0%, transparent 42%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-14">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
            <div className="animate-hero-in opacity-0">
              <p className="site-display text-[clamp(2rem,5vw,2.75rem)]" style={{ color: "var(--ahi-text)" }}>
                {t.hero.brand}
              </p>

              <h1
                className="mt-5 max-w-lg text-[clamp(1.65rem,4.2vw,2.35rem)] font-semibold leading-[1.2] tracking-[-0.02em]"
                style={{ color: "var(--ahi-text)", fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif" }}
              >
                {t.hero.title}
              </h1>

              <p
                className="mt-5 max-w-md text-[15px] leading-7"
                style={{ color: "var(--ahi-text-2)" }}
              >
                {t.hero.lead}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/panel-incele" className="site-btn site-btn-primary">
                  {t.hero.primary}
                  <MarkArrow className="h-4 w-4" />
                </Link>
                <Link
                  href="/nasil-calisir"
                  className="site-link inline-flex min-h-11 items-center text-sm font-semibold"
                  style={{ color: "var(--ahi-text)" }}
                >
                  {t.hero.secondary}
                </Link>
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
                {t.hero.reassure.map((item) => (
                  <li
                    key={item}
                    className="text-[13px]"
                    style={{ color: "var(--ahi-text-3)" }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-hero-in opacity-0" style={{ animationDelay: "100ms" }}>
              <CounterRail />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y" style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper-2)" }}>
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <ScrollReveal variant="fadeUp">
            <h2
              className="text-lg font-semibold tracking-[-0.015em] sm:text-xl"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.sectors.title}
            </h2>
          </ScrollReveal>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {t.sectors.items.map((item, index) => {
              const Mark = SECTOR_MARKS[index];
              return (
                <ScrollReveal key={item.name} delay={0.04 + index * 0.04} variant="fadeUp">
                  <div>
                    <span style={{ color: "var(--ahi-brand)" }}>
                      <Mark className="h-8 w-8" />
                    </span>
                    <p className="mt-3 text-sm font-semibold" style={{ color: "var(--ahi-text)" }}>
                      {item.name}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ahi-text-3)" }}>
                      {item.note}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section id="ne-yapar" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <ScrollReveal variant="fadeUp">
            <div className="max-w-2xl">
              <h2
                className="site-display text-[clamp(1.7rem,3.8vw,2.4rem)]"
                style={{ color: "var(--ahi-text)" }}
              >
                {t.what.title}
              </h2>
              <p className="mt-4 text-[15px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
                {t.what.lead}
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-14">
            <ScrollReveal variant="fadeUp" delay={0.04}>
              <LedgerCard />
            </ScrollReveal>

            <ScrollReveal variant="fadeUp" delay={0.08}>
              <ul className="grid">
                {t.what.primary.map((item, index) => {
                  const Mark = LEDGER_MARKS[index];
                  return (
                    <li
                      key={item.title}
                      className="flex gap-4 py-5 first:pt-0"
                      style={{ borderTop: index === 0 ? "none" : "1px solid var(--ahi-line)" }}
                    >
                      <span
                        className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: "var(--ahi-line)",
                          color: "var(--ahi-brand)",
                          background: "var(--ahi-brass-soft)",
                        }}
                      >
                        <Mark className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold" style={{ color: "var(--ahi-text)" }}>
                          {item.title}
                        </h3>
                        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
                          {item.text}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollReveal>
          </div>

          <div
            className="mt-14 grid gap-px border-y sm:grid-cols-3"
            style={{ background: "var(--ahi-line)", borderColor: "var(--ahi-line)" }}
          >
            {t.what.secondary.map((item, index) => {
              const Mark = SECOND_MARKS[index];
              return (
                <ScrollReveal key={item.title} delay={0.03 + index * 0.04} variant="fadeUp" className="h-full">
                  <div className="h-full px-0 py-7 sm:px-6" style={{ background: "var(--ahi-paper)" }}>
                    <span style={{ color: "var(--ahi-brand)" }}>
                      <Mark className="h-7 w-7" />
                    </span>
                    <h3 className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ahi-text)" }}>
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
                      {item.text}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ background: "var(--ahi-paper-2)" }}>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <ScrollReveal variant="fadeUp">
            <h2
              className="site-display max-w-2xl text-[clamp(1.7rem,3.8vw,2.4rem)]"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.flow.title}
            </h2>
          </ScrollReveal>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.flow.steps.map((step, index) => (
              <li key={step.title}>
                <ScrollReveal delay={0.04 + index * 0.05} variant="fadeUp">
                  <p className="site-meta text-xs font-semibold" style={{ color: "var(--ahi-brand)" }}>
                    {index + 1}
                  </p>
                  <h3 className="mt-2 text-[15px] font-semibold" style={{ color: "var(--ahi-text)" }}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
                    {step.text}
                  </p>
                </ScrollReveal>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link
              href="/nasil-calisir"
              className="site-link inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.flow.cta}
              <MarkArrow className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <ScrollReveal variant="fadeUp">
          <div
            className="rounded-2xl px-6 py-10 sm:px-10 sm:py-12"
            style={{ background: "var(--ahi-ink)" }}
          >
            <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-end">
              <div>
                <h2
                  className="site-display max-w-xl text-[clamp(1.6rem,3.6vw,2.25rem)]"
                  style={{ color: "var(--ahi-on-ink)" }}
                >
                  {t.cta.title}
                </h2>
                <p className="mt-4 max-w-lg text-[15px] leading-7" style={{ color: "var(--ahi-on-ink-2)" }}>
                  {t.cta.text}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <button type="button" onClick={openContact} className="site-btn site-btn-primary">
                  {t.cta.primary}
                  <MarkArrow className="h-4 w-4" />
                </button>
                <Link
                  href="/panel-incele"
                  className="site-btn"
                  style={{ border: "1px solid var(--ahi-on-ink-line)", color: "var(--ahi-on-ink)" }}
                >
                  {t.cta.secondary}
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </main>
  );
}

export default function Home() {
  return (
    <SiteShell solutionsHref="#ne-yapar">
      <HomeContent />
    </SiteShell>
  );
}
