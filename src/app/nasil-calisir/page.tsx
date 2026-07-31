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
      home: "Ana sayfa",
      guide: "Nasıl çalışır",
      businesses: "İşletmeler",
      contact: "İletişim",
      login: "Giriş",
    },
    hero: {
      eyebrow: "Dürüst anlatım",
      title: "Ne yapar?\nNasıl yürür?",
      lead:
        "Kısaca: Müşteri WhatsApp’tan yazınca işiniz aksamadan ilerlesin diye kurulan bir işletme paneli. Aşağıda abartmadan, günlük dille anlattık.",
    },
    what: {
      title: "Ne işe yarar?",
      body: [
        "Telefon, mesaj, defter, “şu saatte yer var mı?” — gün boyu aynı dağınıklık. Ahi AI bunu toparlar.",
        "Müşteri WhatsApp’tan gelir. Sistem sizin saat, hizmet ve doluluğunuza göre yardımcı olur. Siz panelden günü, müşteriyi ve aksayan işi görürsünüz.",
        "Amaç süslü demo değil: sabah açıp akşam kapatırken işin net durması.",
      ],
    },
    how: {
      title: "Nasıl çalışır?",
      steps: [
        {
          title: "Müşteri size ulaşır",
          text: "WhatsApp, kısa link veya QR. Yeni uygulama indirmez.",
        },
        {
          title: "Kurallarınız işler",
          text: "Çalışma saatleri, hizmet süreleri, fiyat ve personel tercihi sizin tanımladığınız gibidir.",
        },
        {
          title: "Kayıt oluşur",
          text: "Uygunsa randevu takvime düşer. Not ve geçmiş müşteri defterinde kalır.",
        },
        {
          title: "Panelden yönetirsiniz",
          text: "Bugünkü iş, bekleyenler, iptaller ve kampanyalar tek yerde.",
        },
      ],
    },
    includes: {
      title: "İçinde neler var?",
      items: [
        { title: "Randevu paneli", text: "Takvim, onay / iptal / gelmedi, kapasite." },
        { title: "WhatsApp link & QR", text: "Direkt sohbet ve vitrin kodu." },
        { title: "Müşteri defteri", text: "Kim geldi, ne yaptırdı, ne not bırakıldı." },
        { title: "Fiyat & paket", text: "Sohbet ve panel aynı bilgiyi kullansın." },
        { title: "Kampanya / hatırlatma", text: "Dönüş ve randevu hatırlatması." },
        { title: "İş akışı & uyarı", text: "Gecikme ve kritik konular öncelikli." },
      ],
    },
    forWhom: {
      title: "Kimler için?",
      text: "Randevu ile çalışan, WhatsApp’tan yoğun yazışan işletmeler: kuaför, klinik, servis, danışmanlık… Excel + üç kişiye sorup cevap düzeninden çıkmak isteyenler.",
    },
    faqTitle: "Aklınıza takılanlar",
    faqs: [
      {
        q: "WhatsApp hesabımı değiştirmek zorunda mıyım?",
        a: "Hayır. Müşteri alışkanlığını bozmamak için işletmenize tanımlı hat üzerinden devam edilir.",
      },
      {
        q: "Her mesajı yapay zeka mı cevaplıyor?",
        a: "Kurallarınıza göre hız kazandırır; özel durumlarda siz panelden görür ve müdahale edersiniz. Kontrol sizde.",
      },
      {
        q: "Yanlış saat vermez mi?",
        a: "Cevaplar sizin girdiğiniz saat, hizmet ve doluluktan üretilir. Ayarlar boşsa önce onu düzeltmek gerekir — sihir değil, düzenli kurulan sistem.",
      },
      {
        q: "Personelim bilgisayardan anlamıyor?",
        a: "Günlük kullanım sade: kim gelecek, durum ne, ne yapılacak. Kısa alıştırmayla genelde oturur.",
      },
      {
        q: "Eski defter / Excel ne olacak?",
        a: "Kurulumda aktarım veya temiz başlangıç konuşulur. Tek tık mucize vaat etmiyoruz; yeni düzenin tutarlı işlemesi önemli.",
      },
      {
        q: "İnternet kesilirse?",
        a: "Panel ve WhatsApp bulutta çalışır; bağlantı yokken canlı yönetim durur, gelince devam eder. Offline kasa değildir.",
      },
      {
        q: "Kurulum ve ücret?",
        a: "İletişim sonrası işletmenize göre WhatsApp, saatler, hizmetler ve panel erişimi planlanır. Kapsam netleştirilir.",
      },
      {
        q: "Verilerim güvende mi?",
        a: "Her işletme kendi alanında çalışır. Giriş kullanıcı adı/şifre ile; gerektiğinde ek doğrulama açılır.",
      },
    ],
    cta: {
      title: "Uygun mu, birlikte bakalım.",
      text: "Temponuzu anlatın; neyin işe yarayıp neyin gereksiz olduğunu net söyleyelim.",
      primary: "İletişime geç",
      secondary: "İşletme girişi",
    },
  },
  en: {
    nav: {
      home: "Home",
      guide: "How it works",
      businesses: "Businesses",
      contact: "Contact",
      login: "Sign in",
    },
    hero: {
      eyebrow: "Plain-spoken guide",
      title: "What it does.\nHow it runs.",
      lead:
        "In short: an operations panel so WhatsApp demand doesn’t break your day. Honest answers below — no hype.",
    },
    what: {
      title: "What is it for?",
      body: [
        "Phones, chats, notebooks, “got a slot?” — the same scatter all day. Ahi AI tidies that.",
        "Customers reach you on WhatsApp. The system helps using your hours, services, and capacity. You see the day, customers, and blockers in one panel.",
        "Not a flashy demo — a day that stays clear from open to close.",
      ],
    },
    how: {
      title: "How does it work?",
      steps: [
        {
          title: "Customer reaches you",
          text: "WhatsApp, short link, or QR. No new app for them.",
        },
        {
          title: "Your rules apply",
          text: "Hours, durations, pricing, staff preference — as you defined.",
        },
        {
          title: "Records update",
          text: "If available, bookings land on the calendar. Notes stay in the book.",
        },
        {
          title: "You run the panel",
          text: "Today’s work, pending items, cancels, and campaigns in one place.",
        },
      ],
    },
    includes: {
      title: "What’s included?",
      items: [
        { title: "Booking panel", text: "Calendar, confirm / cancel / no-show, capacity." },
        { title: "WhatsApp link & QR", text: "Direct chat and storefront code." },
        { title: "Customer book", text: "Who came, what they booked, what was noted." },
        { title: "Pricing & packages", text: "Chat and panel share the same truth." },
        { title: "Campaigns / reminders", text: "Win-back and appointment nudges." },
        { title: "Workflow & alerts", text: "Delays and critical items first." },
      ],
    },
    forWhom: {
      title: "Who is it for?",
      text: "Appointment businesses living on WhatsApp: salons, clinics, service shops, consultancies — teams tired of Excel plus asking three people.",
    },
    faqTitle: "Real questions",
    faqs: [
      {
        q: "Do I have to change my WhatsApp number?",
        a: "No. Messaging continues on the line configured for your business.",
      },
      {
        q: "Does AI answer every message?",
        a: "It speeds common work within your rules. Special cases stay visible so you can step in. Control stays with you.",
      },
      {
        q: "Won’t it give a wrong time?",
        a: "Answers come from hours, services, and availability you set. Empty settings need fixing first — it’s a configured system, not magic.",
      },
      {
        q: "Can non-tech staff use it?",
        a: "Daily use stays plain: who’s coming, what’s the status, what to do. Most teams settle after a short walkthrough.",
      },
      {
        q: "What about my old notebook / Excel?",
        a: "We discuss import vs clean start during setup. No one-click miracle promise — consistency from day one matters more.",
      },
      {
        q: "If the internet drops?",
        a: "Cloud tools pause offline and resume when you’re back. Not a local offline till.",
      },
      {
        q: "Setup and pricing?",
        a: "After contact we plan WhatsApp, hours, services, and panel access for your business. Scope is made clear.",
      },
      {
        q: "Is my data safe?",
        a: "Each business works in its own space. Username/password sign-in, with extra verification when needed.",
      },
    ],
    cta: {
      title: "Let’s see if it fits.",
      text: "Tell us your tempo. We’ll say what’s useful — and what you don’t need.",
      primary: "Contact us",
      secondary: "Business sign-in",
    },
  },
} as const;

export default function HowItWorksPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="site-signal min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0c0e12]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-3xl items-center justify-between px-4 sm:max-w-6xl sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="inline-flex h-10 w-10 overflow-hidden rounded-xl ring-1 ring-[var(--brand)]/40">
              <Image src="/appicon.png" alt="" width={40} height={40} priority />
            </span>
            <span className="font-display text-xl font-semibold">Ahi AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--muted-foreground)] md:flex">
            <Link href="/" className="hover:text-[var(--foreground)]">
              {t.nav.home}
            </Link>
            <span className="text-[var(--brand)]">{t.nav.guide}</span>
            <Link href="/isletmeler" className="hover:text-[var(--foreground)]">
              {t.nav.businesses}
            </Link>
            <button type="button" onClick={() => setShowContact(true)} className="hover:text-[var(--foreground)]">
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-full bg-[var(--primary)] px-4 py-2 font-semibold text-[var(--primary-foreground)]"
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
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="grid gap-1 border-t border-white/8 bg-[var(--card)] px-4 py-3 md:hidden">
            <Link href="/" className="rounded-lg px-3 py-2.5 text-sm" onClick={() => setMobileOpen(false)}>
              {t.nav.home}
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
              className="rounded-full bg-[var(--primary)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--primary-foreground)]"
              onClick={() => setMobileOpen(false)}
            >
              {t.nav.login}
            </Link>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand)]">{t.hero.eyebrow}</p>
        <h1 className="font-display mt-4 whitespace-pre-line text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          {t.hero.title}
        </h1>
        <p className="mt-5 text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">{t.hero.lead}</p>

        <section className="mt-12 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[var(--card)] p-6 shadow-[var(--shadow-md)] sm:p-8">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t.what.title}</h2>
          <div className="mt-4 space-y-4 text-[0.98rem] leading-7 text-[var(--muted-foreground)]">
            {t.what.body.map((p) => (
              <p key={p.slice(0, 28)}>{p}</p>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t.how.title}</h2>
          <ol className="mt-6 grid gap-3">
            {t.how.steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-[3rem_1fr]"
              >
                <span className="font-display text-2xl font-semibold text-[var(--brand)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t.includes.title}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {t.includes.items.map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-[var(--card)] p-5">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[1.75rem] border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">{t.forWhom.title}</h2>
          <p className="mt-3 text-[0.98rem] leading-7 text-[var(--foreground)]/90">{t.forWhom.text}</p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{t.faqTitle}</h2>
          <div className="mt-6 divide-y divide-white/8 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[var(--card)]">
            {t.faqs.map((item) => (
              <details key={item.q} className="group px-5 py-4 open:bg-white/[0.03]">
                <summary className="cursor-pointer list-none font-display text-[0.98rem] font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="text-[var(--brand)] transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-[1.75rem] border border-white/10 bg-[var(--card)] p-7 sm:p-9">
          <h2 className="font-display text-3xl font-semibold tracking-tight">{t.cta.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">{t.cta.text}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)]"
            >
              {t.cta.primary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <Link
              href="/dashboard/login"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold"
            >
              {t.cta.secondary}
            </Link>
          </div>
        </section>
      </main>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
    </div>
  );
}
