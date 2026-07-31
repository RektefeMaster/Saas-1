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
          text: "Çalışma saatleri, hizmet süreleri, fiyat listesi, personel tercihi gibi sizin tanımladığınız kurallar uygulanır. Rastgele saat vermez.",
        },
        {
          title: "3) Randevu ve kayıt oluşur",
          text: "Uygunsa randevu takvime düşer. Müşteri notu, telefonu ve geçmişi müşteri defterinde kalır. Hatırlatmalar planlanabilir.",
        },
        {
          title: "4) Siz panelden yönetirsiniz",
          text: "Bugünkü randevular, bekleyen yanıtlar, iptaller, gecikmeler ve kampanya işleri tek ekranda. Ekip “kim ne yapacak?” diye kaybolmaz.",
        },
      ],
    },
    includes: {
      title: "İçinde neler var?",
      items: [
        {
          title: "Randevu paneli",
          text: "Günlük ve haftalık takvim, onay / iptal / gelmedi durumları, kapasiteye göre yer açma.",
        },
        {
          title: "WhatsApp bağlantısı ve QR",
          text: "Müşteriyi doğrudan sohbete alan link ve mağaza / vitrin için QR.",
        },
        {
          title: "Müşteri defteri",
          text: "Kim geldi, ne yaptırdı, ne not bırakıldı — bir sonraki ziyarette hazır olun.",
        },
        {
          title: "Fiyat listesi ve paketler",
          text: "Hizmetleri ve seans / paket yapılarını net tutun; sohbet ve panel aynı bilgiyi kullansın.",
        },
        {
          title: "Kampanya ve hatırlatma",
          text: "Uzaklaşan müşteriye dönüş mesajı, randevu hatırlatması gibi işleri planlı yürütün.",
        },
        {
          title: "İş akışı ve uyarılar",
          text: "Geciken iş, iptal riski, takip edilmesi gereken konular — öncelikle görünür olsun.",
        },
      ],
    },
    forWhom: {
      title: "Kimler için mantıklı?",
      text: "Randevu ile çalışan, WhatsApp’tan yoğun yazışan işletmeler: kuaför, güzellik, klinik, tamir / servis, danışmanlık ve benzeri küçük–orta ekipler. “Excel + üç kişiye sorup cevap” düzeninden çıkmak isteyenler için.",
    },
    faqTitle: "Aklınıza takılanlar",
    faqs: [
      {
        q: "WhatsApp hesabımı değiştirmek zorunda mıyım?",
        a: "Hayır. Amaç mevcut müşteri alışkanlığını bozmamak. İşletmenize tanımlı WhatsApp hattı üzerinden devam edilir; müşteri yine bildiği yerden yazar.",
      },
      {
        q: "Her mesajı yapay zeka mı cevaplıyor?",
        a: "Sistem işletme kurallarınıza göre yardımcı olur; randevu ve sık sorular gibi net işlerde hız kazandırır. Kritik veya özel durumlarda siz panelden görür ve müdahale edersiniz. “Kontrol sizde” prensibiyle kurulur.",
      },
      {
        q: "Yanlış saat veya yanlış bilgi vermez mi?",
        a: "Cevaplar sizin girdiğiniz çalışma saatleri, hizmetler ve doluluk üzerinden üretilir. Bu yüzden paneldeki ayarlar önemlidir. Boş bırakılmış veya çelişkili ayar varsa önce onu düzeltmek gerekir — sihirli değnek değil, düzenli kurulan bir sistem.",
      },
      {
        q: "Personelim bilgisayardan anlamıyor, kullanabilir mi?",
        a: "Panel sade tutulur: bugün kim gelecek, durum ne, ne yapılacak. Günlük kullanım için karmaşık menü labirenti yoktur. Kısa bir alıştırmayla ekip genelde rahat geçer.",
      },
      {
        q: "Eski defterim / Excel’im ne olacak?",
        a: "Kurulumda işletmenize göre aktarım veya temiz başlangıç konuşulur. Zorunlu “her şeyi tek tıkta taşı” vaadi vermiyoruz; önemli olan yeni düzenin ilk günden tutarlı işlemesi.",
      },
      {
        q: "İnternet kesilirse ne olur?",
        a: "Panel ve WhatsApp bulut üzerinden çalışır; bağlantı yokken canlı yönetim durur. Bağlantı gelince kayıtlar ve mesaj akışı kaldığı yerden devam eder. Offline kasa gibi yerel çalışmaz.",
      },
      {
        q: "Birden fazla şube veya personel olur mu?",
        a: "İşletme tipinize ve paketinize göre personel tercihi, iş akışı ve görünür modüller açılır. Çok şubeli yapı ihtiyaçsa kurulumda ayrıca planlanır — herkese aynı paket dayatılmaz.",
      },
      {
        q: "Kurulum ve ücret nasıl ilerler?",
        a: "Hazır “self-servis market” gibi bırakmıyoruz. İletişim kurunca işletmenize uygun kurulum konuşulur: WhatsApp bağlantısı, saatler, hizmetler, panel erişimi. Fiyat ve kapsam işletmeye göre netleştirilir; sürpriz madde bırakmamaya çalışırız.",
      },
      {
        q: "Müşteri verilerim güvende mi?",
        a: "Her işletme kendi alanında çalışır; başka işletmenin verisini görmezsiniz. Giriş kullanıcı adı / şifre ile yapılır, gerektiğinde ek doğrulama açılır. Veriyi “herkese açık vitrin” gibi kullanmayız.",
      },
    ],
    cta: {
      title: "Uygun olup olmadığını birlikte bakalım.",
      text: "İşletmenizin temposunu anlatın; neyin işe yarayıp neyin gereksiz olduğunu net söyleyelim.",
      primary: "İletişime geç",
      secondary: "İşletme girişi",
      tertiary: "Canlı işletmelere bak",
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
      title: "What Ahi AI does — and how it works",
      lead:
        "In short: an operations panel so WhatsApp demand doesn’t break your day. Below is the honest version, without hype.",
    },
    what: {
      title: "What is it for?",
      body: [
        "Phones ring, chats pile up, notebooks get messy, and “do you have a slot?” never stops. Ahi AI is built to tidy that chaos.",
        "Customers reach you on WhatsApp to book or ask questions. The system answers using your hours, services, and capacity — while you see the day, customers, and blockers in one panel.",
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
          text: "Hours, service durations, pricing, staff preference — your rules. It doesn’t invent random slots.",
        },
        {
          title: "3) Booking and records update",
          text: "If available, the appointment lands on the calendar. Notes and history stay in the customer book. Reminders can be planned.",
        },
        {
          title: "4) You run the day from the panel",
          text: "Today’s bookings, pending replies, cancellations, delays, and campaigns in one place. The team isn’t guessing.",
        },
      ],
    },
    includes: {
      title: "What’s included?",
      items: [
        {
          title: "Booking panel",
          text: "Day/week calendar, confirm / cancel / no-show states, capacity-aware scheduling.",
        },
        {
          title: "WhatsApp link & QR",
          text: "A direct chat link and a QR for the shop counter or storefront.",
        },
        {
          title: "Customer book",
          text: "Who came, what they booked, what was noted — ready for the next visit.",
        },
        {
          title: "Pricing & packages",
          text: "Keep services and session packages clear so chat and panel share the same truth.",
        },
        {
          title: "Campaigns & reminders",
          text: "Win-back messages and appointment reminders, run with intent.",
        },
        {
          title: "Workflow & alerts",
          text: "Delays, cancellation risk, and follow-ups — visible by priority.",
        },
      ],
    },
    forWhom: {
      title: "Who is it for?",
      text: "Appointment-based teams that live on WhatsApp: salons, clinics, repair/service shops, consultancies, and similar small–mid teams tired of “Excel + ask three people”.",
    },
    faqTitle: "Questions people actually ask",
    faqs: [
      {
        q: "Do I have to change my WhatsApp number?",
        a: "No. We don’t want to break how customers already reach you. Messaging continues on the WhatsApp line configured for your business.",
      },
      {
        q: "Does AI answer every message?",
        a: "It helps within your rules — especially bookings and common questions. For special cases you see it in the panel and step in. Control stays with you.",
      },
      {
        q: "Won’t it give a wrong time or wrong info?",
        a: "Answers come from the hours, services, and availability you set. Settings matter. If settings are empty or conflicting, fix those first — it’s a system you configure, not magic.",
      },
      {
        q: "Can staff who aren’t “computer people” use it?",
        a: "The panel stays plain: who’s coming today, what’s the status, what to do next. There isn’t a maze of menus for daily work. Most teams settle in after a short walkthrough.",
      },
      {
        q: "What about my old notebook / Excel?",
        a: "During setup we talk through import versus a clean start. We don’t promise a one-click miracle migration — we care that the new routine is consistent from day one.",
      },
      {
        q: "What if the internet drops?",
        a: "The panel and WhatsApp run in the cloud, so live management pauses offline. When you’re back, records and message flow continue. It isn’t a local offline till.",
      },
      {
        q: "Multiple branches or staff?",
        a: "Staff preference, workflow, and modules depend on your business type and package. Multi-branch setups are planned during onboarding — we don’t force one size on everyone.",
      },
      {
        q: "How do setup and pricing work?",
        a: "This isn’t a leave-you-alone app store. You contact us, we scope WhatsApp connection, hours, services, and panel access. Price and scope are made clear for your business.",
      },
      {
        q: "Is my customer data safe?",
        a: "Each business works in its own space — you don’t see another tenant’s data. Sign-in uses username/password, with extra verification when needed. We don’t treat your data like a public showcase.",
      },
    ],
    cta: {
      title: "Let’s see if it fits.",
      text: "Tell us how your day runs. We’ll say clearly what’s useful — and what you don’t need.",
      primary: "Contact us",
      secondary: "Business sign-in",
      tertiary: "Browse live businesses",
    },
  },
} as const;

export default function HowItWorksPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(50%_60%_at_20%_0%,rgba(15,118,110,0.14),transparent_70%),radial-gradient(40%_50%_at_90%_10%,rgba(11,18,32,0.06),transparent_65%)]" />

      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_90%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:max-w-6xl sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/appicon.png" alt="Ahi AI" width={32} height={32} className="rounded-md" priority />
            <span className="font-display text-[1.05rem] font-semibold tracking-tight">Ahi AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--muted-foreground)] md:flex">
            <Link href="/" className="hover:text-[var(--foreground)]">
              {t.nav.home}
            </Link>
            <span className="text-[var(--foreground)]">{t.nav.guide}</span>
            <Link href="/isletmeler" className="hover:text-[var(--foreground)]">
              {t.nav.businesses}
            </Link>
            <button type="button" onClick={() => setShowContact(true)} className="hover:text-[var(--foreground)]">
              {t.nav.contact}
            </button>
            <Link
              href="/dashboard/login"
              className="rounded-lg bg-[var(--primary)] px-3.5 py-2 text-[var(--primary-foreground)]"
            >
              {t.nav.login}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeLocaleSwitch compact />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="grid gap-1 border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 md:hidden">
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
              className="rounded-lg bg-[var(--primary)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--primary-foreground)]"
              onClick={() => setMobileOpen(false)}
            >
              {t.nav.login}
            </Link>
          </div>
        )}
      </header>

      <main className="relative mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{t.hero.eyebrow}</p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">{t.hero.title}</h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">{t.hero.lead}</p>

        <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t.what.title}</h2>
          <div className="mt-4 space-y-4 text-[0.98rem] leading-7 text-[var(--muted-foreground)]">
            {t.what.body.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.how.title}</h2>
          <ol className="mt-6 space-y-4">
            {t.how.steps.map((step) => (
              <li
                key={step.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-[var(--shadow-sm)]"
              >
                <h3 className="font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.includes.title}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {t.includes.items.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]"
              >
                <h3 className="font-display font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand-soft)] p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t.forWhom.title}</h2>
          <p className="mt-3 text-[0.98rem] leading-7 text-[var(--foreground)]/90">{t.forWhom.text}</p>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.faqTitle}</h2>
          <div className="mt-6 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            {t.faqs.map((item) => (
              <details key={item.q} className="group px-5 py-4 open:bg-[color-mix(in_oklab,var(--muted)_55%,var(--card))]">
                <summary className="cursor-pointer list-none font-display text-[0.98rem] font-semibold tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="mt-0.5 text-[var(--brand)] transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl bg-[var(--primary)] px-6 py-8 text-[var(--primary-foreground)] sm:px-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.cta.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[color-mix(in_oklab,var(--primary-foreground)_75%,transparent)]">
            {t.cta.text}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-foreground)]"
            >
              {t.cta.primary}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <Link
              href="/dashboard/login"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[color-mix(in_oklab,var(--primary-foreground)_28%,transparent)] px-5 text-sm font-semibold"
            >
              {t.cta.secondary}
            </Link>
            <Link
              href="/isletmeler"
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold underline-offset-4 hover:underline"
            >
              {t.cta.tertiary}
            </Link>
          </div>
        </section>
      </main>

      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
    </div>
  );
}
