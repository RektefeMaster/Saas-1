"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useLocale } from "@/lib/locale-context";
import { SiteShell, useSiteContact } from "@/components/site/SiteShell";
import { SiteAtmosphere } from "@/components/site/SiteAtmosphere";
import dynamic from "next/dynamic";

const CounterRail = dynamic(
  () => import("@/components/site/CounterRail").then((m) => ({ default: m.CounterRail })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[22rem] animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/50"
        aria-hidden
      />
    ),
  }
);
import { LedgerCard } from "@/components/site/LedgerCard";
import {
  MarkArrow,
  MarkCare,
  MarkClinic,
  MarkConsult,
  MarkScissors,
  MarkWrench,
} from "@/components/site/GuildMarks";

type SectorId = "salon" | "care" | "clinic" | "repair" | "consult";

const SECTOR_ICONS: Record<SectorId, ComponentType<{ className?: string }>> = {
  salon: MarkScissors,
  care: MarkCare,
  clinic: MarkClinic,
  repair: MarkWrench,
  consult: MarkConsult,
};

const COPY = {
  tr: {
    hero: {
      brand: "Ahi AI",
      title: "WhatsApp taleplerini randevuya ve müşteri kaydına dönüştürün.",
      lead:
        "Mevcut WhatsApp hattınız aynı kalır. Gelen talepler, tanımladığınız çalışma saatleri ve kapasiteye göre karşılanır; randevu takvime işlenir, müşteri kaydı panelde birikir.",
      primary: "Paneli incele",
      secondary: "Nasıl çalışır",
      reassure: [
        "Numara değişikliği gerekmez",
        "Kurulum işletmenize özel yapılır",
        "İstediğiniz anda sohbeti siz yönetirsiniz",
      ],
    },
    sectors: {
      title: "Günü randevuyla geçen işler için",
      lead: "Mesaj temposu yüksek, defteri elden düşmeyen işletmeler. Sektörünüz farklı olsa da sorun aynı: yer soruluyor, yanıt gecikiyor, kayıt dağılabiliyor.",
      items: [
        {
          id: "salon" as const,
          name: "Kuaför & berber",
          note: "Kısa aralıklı randevular, personel tercihi ve gün boyu gelen WhatsApp mesajları tek takvimde toplanır.",
        },
        {
          id: "care" as const,
          name: "Güzellik & bakım",
          note: "Seanslı işlemler, paket hakları ve hatırlatmalar kaybolmadan ilerler; müşteri bir sonraki randevuyu kolayca alır.",
        },
        {
          id: "clinic" as const,
          name: "Klinik & sağlık",
          note: "Doktor veya uzman takvimine göre uygun saat önerilir; kontrol ve takip randevuları düzenli kalır.",
        },
        {
          id: "repair" as const,
          name: "Servis & tamir",
          note: "İş kabulü, tahmini teslim ve durum soruları yanıtlanır; müşteri ne zaman hazır olacağını bilir.",
        },
        {
          id: "consult" as const,
          name: "Danışmanlık",
          note: "Görüşme saatleri planlanır, kaçırılan dönüşler izlenir; takip randevusu unutulmaz.",
        },
      ],
    },
    promise: {
      title: "Sizde ne değişir?",
      lead: "Amaç süslü bir asistan demosu değil. Sabah açıp akşam kapatırken işin net durması.",
      items: [
        {
          title: "Boş saatler yanıt beklemez",
          text: "“Yarın 14 var mı?” sorusu yoğunlukta veya mesai dışında da kurallarınıza göre yanıtlanır. Uygun saat önerilir; müşteri beklerken rakibe kaymaz.",
        },
        {
          title: "Takvim ve defter aynı yerde",
          text: "Kim gelecek, kim yazdı, ne yaptırdı, kim gelmedi. Ekip aynı kaydı görür; kimin deftere ne yazdığına kalmaz.",
        },
        {
          title: "Kontrol sizde kalır",
          text: "Asistan sizin saat, hizmet ve fiyat listenize bağlı çalışır. Hassas bir konu varsa paneli açıp konuşmayı siz sürdürürsünüz.",
        },
      ],
    },
    what: {
      title: "Randevu, müşteri ve gün tek panelde",
      lead:
        "Randevu bir yerde, müşteri notu başka yerde, kampanya listesi galeride kalmasın. Sohbetten gelen iş kayda düşer; siz sonucu yönetirsiniz.",
      primary: [
        {
          title: "Müşteri kaydı",
          text: "Kim geldi, hangi hizmeti aldı, ne ödedi, ne not düşüldü. Yeni personel de geçmişi aynı yerden okur.",
        },
        {
          title: "Geri dönüş ve hatırlatma",
          text: "Uzaklaşan müşteriyi geliş sıklığına göre ayırın. Randevu hatırlatması ve dönüş mesajı planlanabilir; unutulan arama azalır.",
        },
        {
          title: "Günün komuta ekranı",
          text: "Bekleyen yanıt, geciken iş, iptal ve gelmeme tek bakışta. Gerekirse sohbeti siz devralır, asistan geri çekilir.",
        },
      ],
      secondary: [
        {
          title: "Randevu ve kapasite",
          text: "Takvim, uygun saat, personel tercihi, iptal ve gelmeme akışları sizin sürelerinize göre işler.",
        },
        {
          title: "Yetki ve güvenlik",
          text: "Her işletme kendi alanında. Rol bazlı erişim, iki adımlı giriş, işlem kaydı.",
        },
        {
          title: "İşinize göre dil",
          text: "Kuaförle kliniğin cümlesi bir değildir. Asistan sektörünüze ve verdiğiniz kurallara göre ayarlanır.",
        },
      ],
    },
    flow: {
      title: "Nasıl çalışır?",
      lead: "Kurulumdan sonra günlük iş sade kalır. Müşteri alışkanlığı değişmez; siz panelden sonucu görürsünüz.",
      steps: [
        {
          title: "Müşteri size yazar",
          text: "WhatsApp numaranıza, kısa bağlantıya veya vitrindeki QR’a. Yeni uygulama indirmez; bildiği yerden sorar.",
        },
        {
          title: "Sizin kurallarınız cevaplar",
          text: "Çalışma saatleri, hizmet süreleri, fiyat listesi, personel tercihi ve o anki doluluk birlikte okunur. Uydurma saat verilmez.",
        },
        {
          title: "Randevu ve kayıt oluşur",
          text: "Uygun saat takvime düşer, müşteri deftere işlenir. İsterseniz hatırlatma sıraya girer.",
        },
        {
          title: "Siz günü yönetirsiniz",
          text: "Panelde bugünün tablosu, bekleyen işler ve riskli randevular durur. Müdahale etmek istediğinizde sohbet sizdedir.",
        },
      ],
      after:
        "Sizin yapmanız gereken: saatleri, hizmetleri ve fiyatları doğru tutmak; panelden günü izlemek. Gerisi sohbet akışında yürür.",
      cta: "Sık sorulanlar ve detaylı anlatım",
    },
    cta: {
      title: "Önce paneli görün, sonra konuşalım",
      text:
        "İşletmenizin temposunu anlatın. Uyan yerleri ve uymayan yerleri açıkça söyleyelim — abartılı vaat yok, net kurulum konuşması var.",
      primary: "İletişime geç",
      secondary: "Paneli incele",
    },
  },
  en: {
    hero: {
      brand: "Ahi AI",
      title: "Turn WhatsApp requests into bookings and customer records.",
      lead:
        "Your WhatsApp number stays the same. Incoming requests are handled against the hours and capacity you define; bookings hit the calendar, and customer records gather in the panel.",
      primary: "Explore the panel",
      secondary: "How it works",
      reassure: [
        "No number change required",
        "Setup tailored to your business",
        "Take over any chat whenever you choose",
      ],
    },
    sectors: {
      title: "For trades that run on appointments",
      lead: "Busy message traffic, a book that never sits still. The trade may differ; the snag is the same: people ask for slots, replies lag, records scatter.",
      items: [
        {
          id: "salon" as const,
          name: "Salons & barbers",
          note: "Short slots, staff preference and all-day WhatsApp messages land in one calendar.",
        },
        {
          id: "care" as const,
          name: "Beauty & care",
          note: "Multi-session work, package balance and reminders stay on track so the next visit is easy to book.",
        },
        {
          id: "clinic" as const,
          name: "Clinics & health",
          note: "Open times follow each practitioner’s calendar; check-ups and follow-ups stay orderly.",
        },
        {
          id: "repair" as const,
          name: "Repair & service",
          note: "Intake, promised delivery and status questions get answered so customers know when it’s ready.",
        },
        {
          id: "consult" as const,
          name: "Consulting",
          note: "Meeting times are planned, missed follow-ups are visible, and the next session isn’t forgotten.",
        },
      ],
    },
    promise: {
      title: "What changes for you?",
      lead: "This isn’t a flashy assistant demo. It’s so the work stays clear from open to close.",
      items: [
        {
          title: "Open slots don’t wait on a reply",
          text: "“Anything tomorrow at 2?” still gets answered against your rules when you’re busy or after hours. A fit is offered before the customer drifts elsewhere.",
        },
        {
          title: "Calendar and ledger in one place",
          text: "Who’s coming, who wrote in, what they had, who no-showed. The team reads one record — not three notebooks.",
        },
        {
          title: "You keep the wheel",
          text: "The assistant sticks to your hours, services and price list. On a sensitive thread, open the panel and continue the chat yourself.",
        },
      ],
    },
    what: {
      title: "Bookings, customers and the day in one panel",
      lead:
        "Bookings in one place, notes in another, the campaign list in a photo gallery — stop that. Work from the chat lands in the record; you manage the result.",
      primary: [
        {
          title: "Customer record",
          text: "Who came, which service, what they paid, what was noted. New staff can read the history from the same place.",
        },
        {
          title: "Win-back and reminders",
          text: "Sort lapsing customers by visit rhythm. Queue booking reminders and follow-ups so fewer calls get forgotten.",
        },
        {
          title: "Day command screen",
          text: "Waiting replies, delays, cancellations and no-shows at a glance. Take over the chat when you need to; the assistant steps back.",
        },
      ],
      secondary: [
        {
          title: "Booking and capacity",
          text: "Calendar, open slots, staff preference, cancellation and no-show flows — keyed to your durations.",
        },
        {
          title: "Access and security",
          text: "Each business in its own space. Role-based access, two-factor login, audit trail.",
        },
        {
          title: "Language that fits the trade",
          text: "A salon doesn’t speak like a clinic. The assistant is tuned to your sector and the rules you set.",
        },
      ],
    },
    flow: {
      title: "How it works",
      lead: "After setup, the daily loop stays simple. Customers keep their habit; you see the outcome in the panel.",
      steps: [
        {
          title: "The customer writes to you",
          text: "Your WhatsApp number, a short link, or the QR in the window. No new app — they ask where they already ask.",
        },
        {
          title: "Your rules answer",
          text: "Hours, service lengths, price list, staff preference and live availability are read together. No invented slots.",
        },
        {
          title: "Booking and record appear",
          text: "The open slot hits the calendar; the customer goes in the ledger. Reminders can queue if you want them.",
        },
        {
          title: "You run the day",
          text: "Today’s board, pending work and at-risk bookings sit in the panel. When you want the thread, it’s yours.",
        },
      ],
      after:
        "Your job: keep hours, services and prices accurate, and watch the day in the panel. The rest runs in the chat flow.",
      cta: "FAQs and the full walkthrough",
    },
    cta: {
      title: "See the panel first, then talk",
      text:
        "Tell us how your shop runs. We’ll say plainly what fits and what doesn’t — no inflated promises, a clear setup conversation.",
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
        <SiteAtmosphere
          src="/site/hero-whatsapp-desk.jpg"
          strength="whisper"
          priority
          mobile="on"
          position="70% center"
        />

        <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pb-20 lg:pt-14">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
            <div className="animate-hero-in opacity-0">
              <p className="site-display text-[clamp(2rem,5vw,2.75rem)]" style={{ color: "var(--ahi-text)" }}>
                {t.hero.brand}
              </p>

              <h1
                className="mt-5 max-w-lg text-[clamp(1.75rem,4.4vw,2.45rem)] font-semibold leading-[1.22] tracking-[-0.02em]"
                style={{ color: "var(--ahi-text)", fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif" }}
              >
                {t.hero.title}
              </h1>

              <p
                className="mt-5 max-w-md text-[16px] leading-8"
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
                    className="text-[14px]"
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

      <section
        className="site-section relative overflow-hidden border-y"
        style={{ borderColor: "var(--ahi-line)" }}
      >
        <SiteAtmosphere
          src="/site/storefront-qr.jpg"
          strength="soft"
          mobile="off"
          position="center 40%"
        />
        <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="max-w-2xl">
            <h2
              className="text-[clamp(1.25rem,2.6vw,1.5rem)] font-semibold tracking-[-0.015em]"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.sectors.title}
            </h2>
            <p className="mt-3 text-[15px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
              {t.sectors.lead}
            </p>
          </div>

          <ul className="mt-9 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {t.sectors.items.map((item) => {
              const Icon = SECTOR_ICONS[item.id];
              return (
                <li key={item.id} className="flex gap-3.5 sm:flex-col sm:gap-3">
                  <span className="shrink-0" style={{ color: "var(--ahi-brand)" }}>
                    <Icon className="h-9 w-9 sm:h-10 sm:w-10" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--ahi-text)" }}>
                      {item.name}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
                      {item.note}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="site-section relative overflow-hidden border-b" style={{ borderColor: "var(--ahi-line)" }}>
        <SiteAtmosphere
          src="/site/ops-calendar-day.jpg"
          strength="soft"
          mobile="off"
          position="center 35%"
        />
        <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2
              className="site-display text-[clamp(1.8rem,3.8vw,2.45rem)]"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.promise.title}
            </h2>
            <p className="mt-4 text-[16px] leading-8" style={{ color: "var(--ahi-text-2)" }}>
              {t.promise.lead}
            </p>
          </div>

          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {t.promise.items.map((item, index) => (
              <li key={item.title}>
                <p className="site-meta text-xs font-semibold" style={{ color: "var(--ahi-brand)" }}>
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-base font-semibold" style={{ color: "var(--ahi-text)" }}>
                  {item.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
                  {item.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ne-yapar" className="relative scroll-mt-24 overflow-hidden">
        <SiteAtmosphere
          src="/site/ops-calendar-day.jpg"
          strength="veil"
          mobile="off"
          position="70% center"
        />
        <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2
              className="site-display text-[clamp(1.8rem,3.8vw,2.45rem)]"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.what.title}
            </h2>
            <p className="mt-4 text-[16px] leading-8" style={{ color: "var(--ahi-text-2)" }}>
              {t.what.lead}
            </p>
          </div>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-start lg:gap-14">
            <LedgerCard />
            <ul className="grid">
              {t.what.primary.map((item, index) => (
                <li
                  key={item.title}
                  className="py-5 first:pt-0"
                  style={{ borderTop: index === 0 ? "none" : "1px solid var(--ahi-line)" }}
                >
                  <h3 className="text-[17px] font-semibold" style={{ color: "var(--ahi-text)" }}>
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 grid gap-8 border-t pt-10 sm:grid-cols-3" style={{ borderColor: "var(--ahi-line)" }}>
            {t.what.secondary.map((item) => (
              <div key={item.title}>
                <h3 className="text-base font-semibold" style={{ color: "var(--ahi-text)" }}>
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[14.5px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section relative overflow-hidden">
        <SiteAtmosphere
          src="/site/chat-in-shop.jpg"
          strength="soft"
          mobile="off"
          position="center 30%"
        />
        <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2
              className="site-display text-[clamp(1.8rem,3.8vw,2.45rem)]"
              style={{ color: "var(--ahi-text)" }}
            >
              {t.flow.title}
            </h2>
            <p className="mt-4 text-[16px] leading-8" style={{ color: "var(--ahi-text-2)" }}>
              {t.flow.lead}
            </p>
          </div>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.flow.steps.map((step, index) => (
              <li key={step.title}>
                <p className="site-meta text-xs font-semibold" style={{ color: "var(--ahi-brand)" }}>
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-base font-semibold" style={{ color: "var(--ahi-text)" }}>
                  {step.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
                  {step.text}
                </p>
              </li>
            ))}
          </ol>

          <p
            className="mt-10 max-w-2xl border-t pt-6 text-[15px] leading-7"
            style={{ borderColor: "var(--ahi-line)", color: "var(--ahi-text-2)" }}
          >
            {t.flow.after}
          </p>

          <div className="mt-6">
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
