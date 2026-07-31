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
      eyebrow: "Açık anlatım",
      title: "Ahi AI ne yapar, nasıl çalışır?",
      lead:
        "Kısaca: Müşteri WhatsApp’tan yazınca işiniz aksamadan yürüsün diye yapılan bir işletme paneli. Aşağıda abartısız, günlük dille anlattık.",
    },
    what: {
      title: "Ne işe yarar?",
      body: [
        "Telefon çalıyor, mesaj yağıyor, defter karışıyor, “şu saatte yer var mı?” sorusu gün boyu geliyor. Ahi AI bu dağınıklığı toparlar.",
        "Müşteri sizi WhatsApp’tan bulur, randevu ister veya soru sorar. Sistem işletmenizin saatlerine, hizmetlerine ve doluluğuna göre yanıtlar; siz panelden günü, müşteriyi ve aksayan işleri görürsünüz.",
        "Amaç “süslü bir yapay zeka demosu” değil. Amaç: sabah açıp akşam kapatırken işin net durması.",
      ],
    },
    how: {
      title: "Nasıl çalışır?",
      steps: [
        {
          title: "1) Müşteri size ulaşır",
          text: "WhatsApp numaranız, kısa bağlantı veya QR ile gelir. Yeni bir uygulama indirmek zorunda kalmaz.",
        },
        {
          title: "2) İşletme kurallarınız devreye girer",
          text: "Çalışma saatleri, hizmet süreleri, fiyat listesi, personel tercihi gibi sizin tanımladığınız kurallar uygulanır.",
        },
        {
          title: "3) Randevu ve kayıt oluşur",
          text: "Uygunsa randevu takvime düşer. Müşteri notu ve geçmişi defterde kalır. Hatırlatmalar planlanabilir.",
        },
        {
          title: "4) Siz panelden yönetirsiniz",
          text: "Bugünkü randevular, bekleyen yanıtlar, iptaller ve kampanya işleri tek ekranda.",
        },
      ],
    },
    includes: {
      title: "İçinde neler var?",
      items: [
        { title: "Randevu paneli", text: "Takvim, onay / iptal / gelmedi, kapasite." },
        { title: "WhatsApp bağlantısı ve QR", text: "Direkt sohbet ve vitrin kodu." },
        { title: "Müşteri defteri", text: "Kim geldi, ne yaptırdı, ne not bırakıldı." },
        { title: "Fiyat listesi ve paketler", text: "Sohbet ve panel aynı bilgiyi kullansın." },
        { title: "Kampanya ve hatırlatma", text: "Dönüş mesajı ve randevu hatırlatması." },
        { title: "İş akışı ve uyarılar", text: "Gecikme ve kritik konular öncelikli." },
      ],
    },
    forWhom: {
      title: "Kimler için mantıklı?",
      text: "Randevu ile çalışan, WhatsApp’tan yoğun yazışan işletmeler: kuaför, güzellik, klinik, tamir / servis, danışmanlık… Excel + üç kişiye sorup cevap düzeninden çıkmak isteyenler için.",
    },
    faqTitle: "Aklınıza takılanlar",
    faqs: [
      {
        q: "WhatsApp hesabımı değiştirmek zorunda mıyım?",
        a: "Hayır. Amaç mevcut müşteri alışkanlığını bozmamak. İşletmenize tanımlı WhatsApp hattı üzerinden devam edilir.",
      },
      {
        q: "Her mesajı yapay zeka mı cevaplıyor?",
        a: "Sistem kurallarınıza göre yardımcı olur; randevu ve sık sorularda hız kazandırır. Özel durumlarda siz panelden görür ve müdahale edersiniz.",
      },
      {
        q: "Yanlış saat veya yanlış bilgi vermez mi?",
        a: "Cevaplar sizin girdiğiniz çalışma saatleri, hizmetler ve doluluk üzerinden üretilir. Ayarlar boşsa önce onu düzeltmek gerekir. Sihirli değnek değil, düzenli kurulan bir sistem.",
      },
      {
        q: "Personelim bilgisayardan anlamıyor, kullanabilir mi?",
        a: "Panel sade tutulur: bugün kim gelecek, durum ne, ne yapılacak. Kısa bir alıştırmayla ekip genelde rahat geçer.",
      },
      {
        q: "Eski defterim / Excel’im ne olacak?",
        a: "Kurulumda aktarım veya temiz başlangıç konuşulur. Zorunlu “tek tıkta her şeyi taşı” vaadi vermiyoruz; önemli olan yeni düzenin ilk günden tutarlı işlemesi.",
      },
      {
        q: "İnternet kesilirse ne olur?",
        a: "Panel ve WhatsApp bulut üzerinden çalışır; bağlantı yokken canlı yönetim durur. Bağlantı gelince kaldığı yerden devam eder.",
      },
      {
        q: "Kurulum ve ücret nasıl ilerler?",
        a: "İletişim kurunca işletmenize uygun kurulum konuşulur: WhatsApp bağlantısı, saatler, hizmetler, panel erişimi. Fiyat ve kapsam netleştirilir.",
      },
      {
        q: "Müşteri verilerim güvende mi?",
        a: "Her işletme kendi alanında çalışır. Giriş kullanıcı adı / şifre ile yapılır, gerektiğinde ek doğrulama açılır.",
      },
    ],
    cta: {
      title: "Uygun olup olmadığını birlikte bakalım.",
      text: "İşletmenizin temposunu anlatın; neyin işe yarayıp neyin gereksiz olduğunu net söyleyelim.",
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
      title: "What Ahi AI does, and how it works",
      lead:
        "In short: an operations panel so WhatsApp demand doesn’t break your day. Below is the honest version, without hype.",
    },
    what: {
      title: "What is it for?",
      body: [
        "Phones ring, chats pile up, notebooks get messy, and “do you have a slot?” never stops. Ahi AI is built to tidy that chaos.",
        "Customers reach you on WhatsApp to book or ask questions. The system answers using your hours, services, and capacity, while you see the day in one panel.",
        "The goal isn’t a flashy AI demo. It’s a day that stays clear from open to close.",
      ],
    },
    how: {
      title: "How does it work?",
      steps: [
        {
          title: "1) The customer reaches you",
          text: "Via your WhatsApp number, a short link, or QR. They don’t install a new app.",
        },
        {
          title: "2) Your business rules apply",
          text: "Hours, service durations, pricing, staff preference: your rules.",
        },
        {
          title: "3) Booking and records update",
          text: "If available, the appointment lands on the calendar. Notes stay in the customer book.",
        },
        {
          title: "4) You run the day from the panel",
          text: "Today’s bookings, pending replies, cancellations, and campaigns in one place.",
        },
      ],
    },
    includes: {
      title: "What’s included?",
      items: [
        { title: "Booking panel", text: "Calendar, confirm / cancel / no show, capacity." },
        { title: "WhatsApp link and QR", text: "Direct chat and storefront code." },
        { title: "Customer book", text: "Who came, what they booked, what was noted." },
        { title: "Pricing and packages", text: "Chat and panel share the same truth." },
        { title: "Campaigns and reminders", text: "Win back and appointment nudges." },
        { title: "Workflow and alerts", text: "Delays and critical items first." },
      ],
    },
    forWhom: {
      title: "Who is it for?",
      text: "Appointment based teams that live on WhatsApp: salons, clinics, repair shops, consultancies. Teams tired of Excel plus asking three people.",
    },
    faqTitle: "Questions people actually ask",
    faqs: [
      {
        q: "Do I have to change my WhatsApp number?",
        a: "No. Messaging continues on the WhatsApp line configured for your business.",
      },
      {
        q: "Does AI answer every message?",
        a: "It helps within your rules, especially bookings and common questions. For special cases you see it in the panel and step in.",
      },
      {
        q: "Won’t it give a wrong time or wrong info?",
        a: "Answers come from the hours, services, and availability you set. Empty settings need fixing first. It’s a system you configure, not magic.",
      },
      {
        q: "Can staff who aren’t “computer people” use it?",
        a: "The panel stays plain: who’s coming today, what’s the status, what to do next. Most teams settle in after a short walkthrough.",
      },
      {
        q: "What about my old notebook / Excel?",
        a: "During setup we talk through import versus a clean start. We don’t promise a one click miracle migration.",
      },
      {
        q: "What if the internet drops?",
        a: "The panel and WhatsApp run in the cloud, so live management pauses offline and continues when you’re back.",
      },
      {
        q: "How do setup and pricing work?",
        a: "You contact us, we scope WhatsApp connection, hours, services, and panel access. Price and scope are made clear for your business.",
      },
      {
        q: "Is my customer data safe?",
        a: "Each business works in its own space. Sign in uses username/password, with extra verification when needed.",
      },
    ],
    cta: {
      title: "Let’s see if it fits.",
      text: "Tell us how your day runs. We’ll say clearly what’s useful, and what you don’t need.",
      primary: "Contact us",
      secondary: "Business sign in",
    },
  },
} as const;

export default function HowItWorksPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_15%_0%,rgba(5,150,105,0.12),transparent_65%)]" />

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="relative mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:max-w-7xl sm:px-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/appicon.png"
              alt="Ahi AI"
              width={34}
              height={34}
              className="rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700"
              priority
            />
            <span className="text-lg font-semibold tracking-tight">Ahi AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white">
              {t.nav.home}
            </Link>
            <span className="text-emerald-700 dark:text-emerald-400">{t.nav.guide}</span>
            <Link href="/isletmeler" className="hover:text-slate-900 dark:hover:text-white">
              {t.nav.businesses}
            </Link>
            <button type="button" onClick={() => setShowContact(true)} className="hover:text-slate-900 dark:hover:text-white">
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-xl bg-emerald-600 px-3.5 py-2 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950"
            >
              {t.nav.login}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeLocaleSwitch compact />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white md:hidden dark:border-slate-700 dark:bg-slate-900"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="grid gap-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
            <Link href="/" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" onClick={() => setMobileOpen(false)}>
              {t.nav.home}
            </Link>
            <Link href="/isletmeler" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" onClick={() => setMobileOpen(false)}>
              {t.nav.businesses}
            </Link>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm"
              onClick={() => {
                setShowContact(true);
                setMobileOpen(false);
              }}
            >
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-xl bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setMobileOpen(false)}
            >
              {t.nav.login}
            </Link>
          </div>
        )}
      </header>

      <main className="relative mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t.hero.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{t.hero.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">{t.hero.lead}</p>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">{t.what.title}</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-[0.98rem]">
            {t.what.body.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.how.title}</h2>
          <ol className="mt-5 space-y-3">
            {t.how.steps.map((step) => (
              <li
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.includes.title}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {t.includes.items.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">{t.forWhom.title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-[0.98rem]">{t.forWhom.text}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.faqTitle}</h2>
          <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
            {t.faqs.map((item) => (
              <details key={item.q} className="group px-5 py-4 open:bg-slate-50 dark:open:bg-slate-800/50">
                <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="text-emerald-600 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-emerald-700 p-7 text-white sm:p-9">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.cta.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50">{t.cta.text}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-emerald-900"
            >
              {t.cta.primary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <Link
              href="/dashboard/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-semibold"
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
