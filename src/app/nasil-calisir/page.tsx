"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { SiteShell, useSiteContact } from "@/components/site/SiteShell";
import { SiteAtmosphere } from "@/components/site/SiteAtmosphere";
import { MarkArrow } from "@/components/site/GuildMarks";

const COPY = {
  tr: {
    hero: {
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
          title: "Müşteri size ulaşır",
          text: "WhatsApp numaranız, kısa bağlantı veya QR ile gelir. Yeni bir uygulama indirmek zorunda kalmaz.",
        },
        {
          title: "İşletme kurallarınız devreye girer",
          text: "Çalışma saatleri, hizmet süreleri, fiyat listesi, personel tercihi gibi sizin tanımladığınız kurallar uygulanır.",
        },
        {
          title: "Randevu ve kayıt oluşur",
          text: "Uygunsa randevu takvime düşer. Müşteri notu ve geçmişi defterde kalır. Hatırlatmalar planlanabilir.",
        },
        {
          title: "Siz panelden yönetirsiniz",
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
      secondary: "Paneli incele",
    },
  },
  en: {
    hero: {
      title: "What Ahi AI does, and how it works",
      lead:
        "In short: a business panel built so the day keeps moving when customers write on WhatsApp. Below is the unvarnished version.",
    },
    what: {
      title: "What is it for?",
      body: [
        "The phone rings, messages pile up, the book gets messy, and “do you have a slot?” lands all day. Ahi AI pulls that scatter together.",
        "Customers find you on WhatsApp, ask for a booking or a question. The system answers against your hours, services and availability; you see the day, the customer and the broken bits from the panel.",
        "The point isn’t a flashy AI demo. The point is that the work looks clear from open to close.",
      ],
    },
    how: {
      title: "How does it work?",
      steps: [
        {
          title: "The customer reaches you",
          text: "Via your WhatsApp number, a short link or a QR code. No new app to install.",
        },
        {
          title: "Your shop rules take over",
          text: "Opening hours, service durations, price list, staff preference — the rules you defined.",
        },
        {
          title: "Booking and record appear",
          text: "If there’s a slot, it lands on the calendar. Notes and history stay in the ledger. Reminders can be queued.",
        },
        {
          title: "You run it from the panel",
          text: "Today’s bookings, waiting replies, cancellations and campaign work on one screen.",
        },
      ],
    },
    includes: {
      title: "What’s inside?",
      items: [
        { title: "Booking panel", text: "Calendar, confirm / cancel / no-show, capacity." },
        { title: "WhatsApp link and QR", text: "Direct chat and a window-ready code." },
        { title: "Customer ledger", text: "Who came, what they had, what was noted." },
        { title: "Price list and packages", text: "Chat and panel share the same facts." },
        { title: "Campaigns and reminders", text: "Win-back messages and booking nudges." },
        { title: "Workflow and alerts", text: "Delays and critical items rise first." },
      ],
    },
    forWhom: {
      title: "Who is it for?",
      text: "Appointment-led businesses that live in WhatsApp: salons, beauty, clinics, repair / service, consulting — anyone ready to leave the Excel-plus-three-people-relay behind.",
    },
    faqTitle: "Questions that come up",
    faqs: [
      {
        q: "Do I have to change my WhatsApp account?",
        a: "No. The point is not to break the habit customers already have. You keep the WhatsApp line tied to your business.",
      },
      {
        q: "Does AI answer every message?",
        a: "It helps within your rules and speeds up bookings and common questions. In special cases you see it in the panel and step in.",
      },
      {
        q: "Won’t it give the wrong time or wrong info?",
        a: "Answers are produced from the hours, services and availability you entered. If settings are empty, fix those first. Not a magic wand — a system that needs to be set up properly.",
      },
      {
        q: "My staff aren’t computer people. Can they use it?",
        a: "The panel stays plain: who’s coming today, what’s the status, what to do next. A short walkthrough is usually enough.",
      },
      {
        q: "What about my old book / Excel?",
        a: "At setup we talk through import or a clean start. We don’t promise a one-click migrate-everything miracle; what matters is the new order holding from day one.",
      },
      {
        q: "What if the internet drops?",
        a: "Panel and WhatsApp run in the cloud; live management pauses without a connection. When it returns, you continue where you left off.",
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
      primary: "Get in touch",
      secondary: "Explore the panel",
    },
  },
} as const;

function HowItWorksContent() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const openContact = useSiteContact();

  return (
    <main>
      <section className="relative overflow-hidden">
        <SiteAtmosphere
          src="/site/chat-in-shop.jpg"
          strength="soft"
          priority
          mobile="on"
          position="center 28%"
        />
        <div className="relative z-[1] mx-auto w-full max-w-3xl px-4 pb-10 pt-12 sm:px-6 sm:pb-12 sm:pt-14">
          <h1
            className="site-display text-[clamp(1.9rem,4.5vw,2.75rem)]"
            style={{ color: "var(--ahi-text)" }}
          >
            {t.hero.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-8" style={{ color: "var(--ahi-text-2)" }}>
            {t.hero.lead}
          </p>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
        <div
          className="rounded-2xl border px-6 py-7 sm:px-8 sm:py-8"
          style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: "var(--ahi-text)" }}>
            {t.what.title}
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-7" style={{ color: "var(--ahi-text-2)" }}>
            {t.what.body.map((p) => (
              <p key={p.slice(0, 28)}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <SiteAtmosphere
          src="/site/ops-calendar-day.jpg"
          strength="veil"
          mobile="off"
          position="center 40%"
        />
        <div className="relative z-[1] mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
          <h2
            className="site-display text-[clamp(1.5rem,3.5vw,2.1rem)]"
            style={{ color: "var(--ahi-text)" }}
          >
            {t.how.title}
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2">
            {t.how.steps.map((step, index) => (
              <li key={step.title}>
                <p className="site-meta text-xs font-semibold" style={{ color: "var(--ahi-brand)" }}>
                  {index + 1}
                </p>
                <h3 className="mt-2 text-[15px] font-semibold" style={{ color: "var(--ahi-text)" }}>
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
        <h2
          className="site-display text-[clamp(1.5rem,3.5vw,2.1rem)]"
          style={{ color: "var(--ahi-text)" }}
        >
          {t.includes.title}
        </h2>
        <div
          className="mt-6 grid gap-px border sm:grid-cols-2"
          style={{ background: "var(--ahi-line)", borderColor: "var(--ahi-line)" }}
        >
          {t.includes.items.map((item) => (
            <article key={item.title} className="h-full px-5 py-5" style={{ background: "var(--ahi-paper)" }}>
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--ahi-text)" }}>
                {item.title}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ahi-text-2)" }}>
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ background: "var(--ahi-ink)" }}>
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="text-lg font-semibold" style={{ color: "var(--ahi-on-ink)" }}>
            {t.forWhom.title}
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7" style={{ color: "var(--ahi-on-ink-2)" }}>
            {t.forWhom.text}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
        <h2
          className="site-display text-[clamp(1.5rem,3.5vw,2.1rem)]"
          style={{ color: "var(--ahi-text)" }}
        >
          {t.faqTitle}
        </h2>
        <div
          className="mt-6 divide-y divide-[var(--ahi-line)] overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper)" }}
        >
          {t.faqs.map((item) => (
            <details key={item.q} className="group px-5 py-4" style={{ borderColor: "var(--ahi-line)" }}>
              <summary
                className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden"
                style={{ color: "var(--ahi-text)" }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>{item.q}</span>
                  <span
                    className="site-meta shrink-0 text-lg leading-none transition group-open:rotate-45"
                    style={{ color: "var(--ahi-brand)" }}
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-7" style={{ color: "var(--ahi-text-2)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="rounded-2xl px-6 py-10 sm:px-10 sm:py-12" style={{ background: "var(--ahi-ink)" }}>
          <h2
            className="site-display max-w-xl text-[clamp(1.5rem,3.5vw,2.1rem)]"
            style={{ color: "var(--ahi-on-ink)" }}
          >
            {t.cta.title}
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-7" style={{ color: "var(--ahi-on-ink-2)" }}>
            {t.cta.text}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
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
      </section>
    </main>
  );
}

export default function HowItWorksPage() {
  return (
    <SiteShell>
      <HowItWorksContent />
    </SiteShell>
  );
}
