"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MessageCircle,
  Phone,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const quickHighlights = ["Kurulum 10 dakikada", "Türkçe ve sade kullanım", "Mobil uyumlu panel"];

const featureCards = [
  {
    icon: Calendar,
    title: "Randevu düzeni",
    text: "Boş saatleri gösterir, çakışmaları azaltır ve günü daha planlı yürütmenizi sağlar.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp'tan hızlı cevap",
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
];

const workflowSteps = [
  "İşletme hesabınız açılır ve çalışma saatleriniz tanımlanır.",
  "WhatsApp linkiniz veya QR kodunuz müşterilerle paylaşılır.",
  "Müşteri yazdığında sistem doğru işletmeye bağlanır ve randevu sürecini yönetir.",
];

export function AnimatedHomePage() {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const flowRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const progress = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 28,
    mass: 0.2,
  });

  const { scrollYProgress: heroProgress } = useScroll({
    container: containerRef,
    target: heroRef,
    offset: ["start end", "end start"],
  });

  const { scrollYProgress: featuresProgress } = useScroll({
    container: containerRef,
    target: featuresRef,
    offset: ["start end", "end start"],
  });

  const { scrollYProgress: flowProgress } = useScroll({
    container: containerRef,
    target: flowRef,
    offset: ["start end", "end start"],
  });

  const heroY = useTransform(
    heroProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [0, 0, 0] : [54, 0, -54]
  );
  const heroScale = useTransform(
    heroProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [1, 1, 1] : [0.94, 1, 0.96]
  );
  const heroCardRotate = useTransform(
    heroProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [-2.6, 2.6]
  );

  const featuresY = useTransform(
    featuresProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [0, 0, 0] : [72, 0, -42]
  );
  const featuresOpacity = useTransform(featuresProgress, [0, 0.2, 0.85, 1], [0.35, 1, 1, 0.55]);

  const flowY = useTransform(
    flowProgress,
    [0, 0.5, 1],
    shouldReduceMotion ? [0, 0, 0] : [64, 0, -64]
  );
  const flowOpacity = useTransform(flowProgress, [0, 0.2, 0.85, 1], [0.3, 1, 1, 0.5]);

  const glowLeftY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -210]
  );
  const glowRightY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, 210]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-screen snap-y snap-mandatory overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950"
    >
      <motion.div
        className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"
        style={{ scaleX: progress }}
      />

      <div className="pointer-events-none fixed inset-0 z-0">
        <Image
          src="/arkaplan.png"
          alt="Ahi AI arkaplan"
          fill
          priority
          className="object-cover opacity-[0.11] blur-[1.5px]"
        />
        <motion.div
          style={{ y: glowLeftY }}
          className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl"
        />
        <motion.div
          style={{ y: glowRightY }}
          className="absolute -right-32 top-[28rem] h-96 w-96 rounded-full bg-blue-500/15 blur-3xl"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-slate-900/0 to-blue-500/15" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/80 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/75">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
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

      <main className="relative z-10">
        <motion.section
          ref={heroRef}
          style={{ y: heroY, scale: heroScale }}
          className="snap-start"
        >
          <div className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr,0.85fr] lg:px-8">
            <div className="text-center lg:text-left">
              <ScrollReveal variant="fadeUp" amount={0.35} duration={0.55}>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  İşletmeler İçin Akıllı Randevu Asistanı
                </span>
              </ScrollReveal>

              <ScrollReveal variant="fadeUp" delay={0.05} amount={0.2} duration={0.65}>
                <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
                  Müşteriniz WhatsApp&apos;tan yazar,
                  <span className="bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent">
                    {" "}
                    Ahi AI randevuyu düzenli şekilde alır.
                  </span>
                </h1>
              </ScrollReveal>

              <ScrollReveal variant="fadeUp" delay={0.1} amount={0.2}>
                <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
                  Teknik terimlerle uğraşmadan takviminizi, fiyat bilgilerinizi ve müşteri notlarınızı
                  tek panelde kolayca yönetirsiniz. Mobilde, tablette ve masaüstünde sorunsuz çalışır.
                </p>
              </ScrollReveal>

              <ScrollReveal variant="fadeUp" delay={0.16}>
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
              </ScrollReveal>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600 lg:justify-start">
                {quickHighlights.map((item, index) => (
                  <ScrollReveal key={item} variant="fadeUp" delay={0.22 + index * 0.06}>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 dark:border-slate-800 dark:bg-slate-900/80">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {item}
                    </span>
                  </ScrollReveal>
                ))}
              </div>
            </div>

            <motion.aside
              style={{ rotate: heroCardRotate }}
              className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none"
            >
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
            </motion.aside>

            <motion.div
              animate={shouldReduceMotion ? undefined : { y: [0, 8, 0] }}
              transition={{
                duration: 1.8,
                repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
              className="col-span-full mt-2 flex items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Scroll ile devam et
              <ChevronDown className="ml-1.5 h-4 w-4" />
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          ref={featuresRef}
          style={{ y: featuresY, opacity: featuresOpacity }}
          className="snap-start"
        >
          <div className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-center px-4 py-14 sm:px-6 lg:px-8">
            <ScrollReveal as="div" variant="fadeUp" amount={0.2}>
              <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                İşletmenizde neyi kolaylaştırır?
              </h2>
              <p className="mt-3 text-center text-slate-600 dark:text-slate-400">
                Scroll ettikçe kartlar kademe kademe açılır, her bölüm bağımsız geçiş alır.
              </p>
            </ScrollReveal>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, text }, index) => (
                <ScrollReveal
                  key={title}
                  as="li"
                  variant="fadeUp"
                  delay={index * 0.06}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
                </ScrollReveal>
              ))}
            </ul>
          </div>
        </motion.section>

        <motion.section ref={flowRef} style={{ y: flowY, opacity: flowOpacity }} className="snap-start">
          <div className="mx-auto flex min-h-[88svh] w-full max-w-6xl flex-col justify-center px-4 pb-16 sm:px-6 lg:px-8">
            <ScrollReveal
              as="section"
              variant="scale"
              amount={0.2}
              className="rounded-2xl border border-slate-200 bg-white/85 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85 sm:p-8"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
                Nasıl çalışır?
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {workflowSteps.map((text, index) => (
                  <ScrollReveal
                    key={text}
                    delay={index * 0.09}
                    variant="slideRight"
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                      Adım {index + 1}
                    </p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{text}</p>
                  </ScrollReveal>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </motion.section>
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
