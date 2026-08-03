"use client";

/**
 * Vitrinin imza görseli: solda telefon içindeki WhatsApp yazışması,
 * sağda günün defteri. Alt etiket adımlarla birlikte değişir.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocale } from "@/lib/locale-context";
import { MarkArrow } from "./GuildMarks";

const MOBILE_MQ = "(max-width: 1023px)";

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function getMobileServerSnapshot() {
  return false;
}

function useIsMobileLayout() {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
}

type Speaker = "customer" | "shop";

interface ThreadMessage {
  from: Speaker;
  text: string;
  time: string;
}

interface BoardRow {
  time: string;
  name: string;
  service: string;
  staff: string;
  status: "done" | "confirmed" | "new";
}

const COPY = {
  tr: {
    contact: "Selin Arı",
    channel: "WhatsApp",
    online: "çevrimiçi",
    typing: "yazıyor…",
    composer: "Mesaj",
    boardTitle: "Bugün",
    boardStaff: "Salon Mira · Elif, Can",
    countLabel: "randevu",
    fill: "%78 doluluk",
    railSteps: [
      "mesaj geldi",
      "istek anlaşılıyor",
      "uygun saatler bulundu",
      "fiyat soruldu",
      "liste kontrol ediliyor",
      "isim alınıyor",
      "takvime yazılıyor",
      "deftere işlendi",
    ],
    boardFooter: "17:00 sonrası boş · 2 uygun saat",
    status: { done: "bitti", confirmed: "onaylı", new: "yeni" },
    messages: [
      { from: "customer", text: "Bugün saç kesimi için yer var mı?", time: "13:42" },
      {
        from: "shop",
        text: "Bugün 10:00, 11:30 ve 14:00 boş. Hangisi uygun?",
        time: "13:42",
      },
      { from: "customer", text: "14 olsun. Fiyatı ne kadar?", time: "13:43" },
      {
        from: "shop",
        text: "Saç kesimi 450 TL. Randevuyu kimin adına yazayım?",
        time: "13:43",
      },
      { from: "customer", text: "Selin", time: "13:44" },
      {
        from: "shop",
        text: "Tamam! Bugün saat 14:00'te seni bekliyoruz.",
        time: "13:44",
      },
    ] satisfies ThreadMessage[],
    rows: [
      { time: "09:30", name: "Ayşe Yılmaz", service: "Saç kesimi", staff: "Elif", status: "done" },
      { time: "11:00", name: "Mehmet Kara", service: "Sakal tıraşı", staff: "Can", status: "confirmed" },
      { time: "15:30", name: "Deniz Öztürk", service: "Dip boya", staff: "Elif", status: "confirmed" },
    ] satisfies BoardRow[],
    newRow: {
      time: "14:00",
      name: "Selin Arı",
      service: "Saç kesimi",
      staff: "Elif",
      status: "new",
    } satisfies BoardRow,
  },
  en: {
    contact: "Selin Arı",
    channel: "WhatsApp",
    online: "online",
    typing: "typing…",
    composer: "Message",
    boardTitle: "Today",
    boardStaff: "Salon Mira · Elif, Can",
    countLabel: "bookings",
    fill: "78% booked",
    railSteps: [
      "message arrived",
      "request understood",
      "open slots found",
      "price asked",
      "checking the list",
      "asking for a name",
      "writing to calendar",
      "written to the ledger",
    ],
    boardFooter: "Free after 5pm · 2 open slots",
    status: { done: "done", confirmed: "booked", new: "new" },
    messages: [
      { from: "customer", text: "Any haircut slots today?", time: "13:42" },
      {
        from: "shop",
        text: "Today 10:00, 11:30 and 14:00 are free. Which works?",
        time: "13:42",
      },
      { from: "customer", text: "14:00. How much is it?", time: "13:43" },
      {
        from: "shop",
        text: "Haircut is 450 TL. Whose name should I book under?",
        time: "13:43",
      },
      { from: "customer", text: "Selin", time: "13:44" },
      {
        from: "shop",
        text: "Done! See you today at 14:00.",
        time: "13:44",
      },
    ] satisfies ThreadMessage[],
    rows: [
      { time: "09:30", name: "Ayşe Yılmaz", service: "Haircut", staff: "Elif", status: "done" },
      { time: "11:00", name: "Mehmet Kara", service: "Beard trim", staff: "Can", status: "confirmed" },
      { time: "15:30", name: "Deniz Öztürk", service: "Root colour", staff: "Elif", status: "confirmed" },
    ] satisfies BoardRow[],
    newRow: {
      time: "14:00",
      name: "Selin Arı",
      service: "Haircut",
      staff: "Elif",
      status: "new",
    } satisfies BoardRow,
  },
} as const;

const STEP_MS = [1000, 1100, 1400, 1300, 1100, 1400, 1200, 3800];
const LAST_STEP = STEP_MS.length - 1;

/** Adım → görünen mesaj sayısı. 1, 4 ve 6'da typing (mesaj sayısı sabit kalır). */
function visibleCount(step: number) {
  if (step >= 7) return 6;
  if (step >= 6) return 5;
  if (step >= 5) return 4;
  if (step >= 3) return 3;
  if (step >= 2) return 2;
  return 1;
}

export function CounterRail() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const reduceMotion = useReducedMotion();
  // SSR ile aynı ağaç: isMobile DOM dallanması hydration çırpınması yapıyordu.
  // Mesajlar her zaman hafif path; defter paneli CSS ile lg altında gizlenir.
  const isMobile = useIsMobileLayout();
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [step, setStep] = useState(reduceMotion ? LAST_STEP : 0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.2),
      { threshold: [0, 0.2, 0.5], rootMargin: "80px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setStep(LAST_STEP);
      return;
    }
    if (!inView) return;
    const delay = isMobile ? STEP_MS[step] * 1.2 : STEP_MS[step];
    const id = window.setTimeout(() => {
      setStep((prev) => {
        if (prev >= LAST_STEP) {
          setCycle((c) => c + 1);
          return 0;
        }
        return prev + 1;
      });
    }, delay);
    return () => window.clearTimeout(id);
  }, [step, reduceMotion, inView, isMobile]);

  const shown = visibleCount(step);
  const isTyping = !reduceMotion && inView && (step === 1 || step === 4 || step === 6);
  const railActive = step >= 6;
  const rowLanded = step >= LAST_STEP;
  const bookingCount = rowLanded ? 6 : 5;
  const clock = t.messages[Math.min(shown - 1, t.messages.length - 1)]?.time ?? "13:42";

  const rows: BoardRow[] = rowLanded
    ? [t.rows[0], t.rows[1], t.newRow, t.rows[2]]
    : [...t.rows];

  return (
    <div ref={rootRef} className="relative">
      <div className="grid items-center gap-0 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1.05fr)]">
        <div className="relative z-10 mx-auto w-full max-w-[260px] sm:max-w-[300px]">
          <PhoneShell ariaLabel={`${t.channel} · ${t.contact}`}>
            <div
              className="flex items-center justify-between px-5 pb-1 pt-2 text-[10px] font-semibold text-white/90"
              style={{ background: "#075E54" }}
            >
              <span className="site-meta">{clock}</span>
              <span className="flex items-center gap-1 opacity-80">
                <SignalBars />
                <span className="site-meta">5G</span>
                <BatteryIcon />
              </span>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: "#075E54" }}>
              <span className="text-lg leading-none text-white/80">‹</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold text-white">
                SA
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">{t.contact}</p>
                <p className="site-meta truncate text-[10px] text-white/75">
                  {isTyping ? t.typing : t.online}
                </p>
              </div>
            </div>

            <div
              className="relative flex h-[300px] flex-col justify-end overflow-hidden px-2.5 pb-3 pt-3 sm:h-[360px] lg:h-[400px]"
              style={{
                background: "linear-gradient(180deg, #e5ddd5 0%, #d9d0c5 100%)",
              }}
            >
              <div className="relative z-[1] flex min-h-0 flex-col justify-end">
                {t.messages.map((message, index) => {
                  if (index >= shown) return null;
                  const fromCustomer = message.from === "customer";
                  return (
                    <div key={index} className="mt-1.5">
                      <div className={`flex ${fromCustomer ? "justify-start" : "justify-end"}`}>
                        <div
                          className="relative max-w-[88%] rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug shadow-sm"
                          style={
                            fromCustomer
                              ? { background: "#fff", color: "#111b21" }
                              : { background: "#d9fdd3", color: "#111b21" }
                          }
                        >
                          <p>{message.text}</p>
                          <p
                            className="site-meta mt-0.5 text-right text-[9px]"
                            style={{ color: "#667781" }}
                          >
                            {message.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isTyping ? (
                  <div className="mt-1.5 flex justify-start">
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-2 shadow-sm"
                      style={{ background: "#fff" }}
                    >
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="site-typing-dot block h-1.5 w-1.5 rounded-full"
                          style={{ background: "#667781" }}
                        />
                      ))}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#f0f2f5] px-2.5 py-2">
              <span className="flex h-8 flex-1 items-center rounded-full bg-white px-3 text-[11px] text-[#667781]">
                {t.composer}
              </span>
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884] text-white"
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </span>
            </div>
          </PhoneShell>
        </div>

        <div className="relative hidden items-center justify-center py-3 lg:flex lg:py-0">
          <div className="relative h-full min-h-[420px] w-full">
            <div
              className="absolute bottom-16 left-1/2 top-16 w-px -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--ahi-line-strong) 18%, var(--ahi-line-strong) 82%, transparent)",
              }}
            />
            <RailSignal active={railActive} cycle={cycle} vertical reduceMotion={!!reduceMotion || !inView} />
          </div>
        </div>

        <section
          className="relative z-10 hidden h-[460px] flex-col overflow-hidden rounded-2xl border lg:flex"
          style={{
            borderColor: "var(--ahi-line)",
            background: "var(--ahi-paper)",
            boxShadow: "0 12px 40px -20px rgba(15, 23, 42, 0.28)",
          }}
          aria-label={t.boardTitle}
        >
          <div
            className="flex shrink-0 items-end justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper-2)" }}
          >
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--ahi-text)" }}>
                {t.boardTitle}
              </p>
              <p className="site-meta mt-0.5 text-[11px]" style={{ color: "var(--ahi-text-3)" }}>
                {t.boardStaff}
              </p>
            </div>
            <div className="text-right">
              <p className="site-meta text-sm font-semibold" style={{ color: "var(--ahi-text)" }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={bookingCount}
                    initial={reduceMotion ? false : { y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="inline-block"
                  >
                    {bookingCount}
                  </motion.span>
                </AnimatePresence>{" "}
                {t.countLabel}
              </p>
              <p className="site-meta text-[11px]" style={{ color: "var(--ahi-text-3)" }}>
                {t.fill}
              </p>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.li
                  key={`${row.time}-${row.name}`}
                  layout={false}
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden border-b last:border-b-0"
                  style={{
                    borderColor: "var(--ahi-line)",
                    background:
                      row.status === "new"
                        ? "color-mix(in oklab, var(--ahi-brand) 10%, transparent)"
                        : undefined,
                  }}
                >
                  <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-2.5 px-4 py-3.5">
                    <span
                      className="site-meta text-sm font-semibold"
                      style={{
                        color: row.status === "done" ? "var(--ahi-text-3)" : "var(--ahi-text)",
                      }}
                    >
                      {row.time}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block truncate text-sm font-semibold"
                        style={{
                          color: row.status === "done" ? "var(--ahi-text-3)" : "var(--ahi-text)",
                        }}
                      >
                        {row.name}
                      </span>
                      <span className="block truncate text-xs" style={{ color: "var(--ahi-text-3)" }}>
                        {row.service} · {row.staff}
                      </span>
                    </span>
                    <span
                      className="site-meta shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold"
                      style={
                        row.status === "new"
                          ? { background: "var(--ahi-brand)", color: "#fff" }
                          : row.status === "confirmed"
                            ? {
                                background: "color-mix(in oklab, var(--ahi-brand) 14%, transparent)",
                                color: "var(--ahi-brand)",
                              }
                            : { background: "var(--ahi-paper-2)", color: "var(--ahi-text-3)" }
                      }
                    >
                      {t.status[row.status]}
                    </span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div
            className="shrink-0 border-t px-4 py-3"
            style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper-2)" }}
          >
            <p className="site-meta text-[11px]" style={{ color: "var(--ahi-text-3)" }}>
              {t.boardFooter}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-3 flex h-5 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${cycle}-${step}`}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{
              color: rowLanded ? "var(--ahi-brand)" : "var(--ahi-text-3)",
            }}
          >
            <MarkArrow className="h-3.5 w-3.5" />
            {t.railSteps[Math.min(step, t.railSteps.length - 1)]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PhoneShell({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) {
  return (
    <div
      className="relative mx-auto w-full"
      style={{
        borderRadius: "2rem",
        padding: "10px",
        background: "linear-gradient(160deg, #2a2f36 0%, #111418 55%, #0a0c0f 100%)",
        boxShadow: "0 16px 32px -18px rgba(15, 23, 42, 0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
      aria-label={ariaLabel}
    >
      <span aria-hidden className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-sm bg-[#3a3f46]" />
      <span aria-hidden className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-sm bg-[#3a3f46]" />
      <span aria-hidden className="absolute -right-[2px] top-32 h-14 w-[3px] rounded-r-sm bg-[#3a3f46]" />

      <div className="relative overflow-hidden bg-black" style={{ borderRadius: "1.5rem" }}>
        <div
          aria-hidden
          className="absolute left-1/2 top-2 z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black"
        />
        {children}
        <div className="flex justify-center bg-[#f0f2f5] pb-2 pt-1">
          <span aria-hidden className="h-1 w-24 rounded-full bg-[#111b21]/25" />
        </div>
      </div>
    </div>
  );
}

function SignalBars() {
  return (
    <span className="inline-flex items-end gap-px" aria-hidden>
      <span className="h-1.5 w-0.5 rounded-sm bg-white/90" />
      <span className="h-2 w-0.5 rounded-sm bg-white/90" />
      <span className="h-2.5 w-0.5 rounded-sm bg-white/90" />
      <span className="h-3 w-0.5 rounded-sm bg-white/50" />
    </span>
  );
}

function BatteryIcon() {
  return (
    <span
      className="relative ml-0.5 inline-block h-2.5 w-4 rounded-[2px] border border-white/80"
      aria-hidden
    >
      <span className="absolute inset-[1px] right-[3px] rounded-[1px] bg-white/90" />
      <span className="absolute -right-[2px] top-[2px] h-1 w-[1.5px] rounded-r-sm bg-white/80" />
    </span>
  );
}

function RailSignal({
  active,
  cycle,
  vertical,
  reduceMotion,
}: {
  active: boolean;
  cycle: number;
  vertical: boolean;
  reduceMotion: boolean;
}) {
  if (reduceMotion) return null;
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          key={`signal-${cycle}`}
          className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
          style={{
            background: "var(--ahi-brand)",
            boxShadow: "0 0 0 4px color-mix(in oklab, var(--ahi-brand) 18%, transparent)",
          }}
          initial={{ top: vertical ? "12%" : "50%", opacity: 0, scale: 0.6 }}
          animate={{ top: "88%", opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
        />
      )}
    </AnimatePresence>
  );
}
