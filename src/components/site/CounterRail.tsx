"use client";

/**
 * Vitrinin imza görseli: soldaki WhatsApp yazışması, sağdaki günün defteri.
 * Alt etiket adımlarla birlikte değişir; sıra bitince yeni randevu satırı düşer.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { MarkArrow } from "./GuildMarks";

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
    typing: "yanıt hazırlanıyor",
    boardTitle: "Bugün",
    boardStaff: "Salon Mira · Elif, Can",
    countLabel: "randevu",
    fill: "%78 doluluk",
    railSteps: [
      "mesaj geldi",
      "istek anlaşılıyor",
      "uygun saat bulundu",
      "müşteri onayladı",
      "takvime yazılıyor",
      "deftere işlendi",
    ],
    boardFooter: "17:00 sonrası boş · 2 uygun saat",
    status: { done: "bitti", confirmed: "onaylı", new: "yeni" },
    messages: [
      { from: "customer", text: "Merhaba, bugün 14:00'te saç kesimi için yer var mı?", time: "13:42" },
      { from: "shop", text: "Bugün 14:00 uygun. Elif ile ayırayım mı?", time: "13:42" },
      { from: "customer", text: "Olur, ayırın lütfen.", time: "13:43" },
      {
        from: "shop",
        text: "Randevunuz alındı: bugün 14:00, Elif. Bir saat önce hatırlatırım.",
        time: "13:43",
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
    typing: "drafting a reply",
    boardTitle: "Today",
    boardStaff: "Salon Mira · Elif, Can",
    countLabel: "bookings",
    fill: "78% booked",
    railSteps: [
      "message arrived",
      "request understood",
      "open slot found",
      "customer confirmed",
      "writing to calendar",
      "written to the ledger",
    ],
    boardFooter: "Free after 5pm · 2 open slots",
    status: { done: "done", confirmed: "booked", new: "new" },
    messages: [
      { from: "customer", text: "Hi, is there a haircut slot today at 2pm?", time: "13:42" },
      { from: "shop", text: "2pm today is open. Shall I book it with Elif?", time: "13:42" },
      { from: "customer", text: "Yes please.", time: "13:43" },
      {
        from: "shop",
        text: "Booked: today at 2pm with Elif. I'll remind you an hour before.",
        time: "13:43",
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

/** Adım süreleri (ms) — son adımda bir süre durup baştan başlar. */
const STEP_MS = [1100, 1300, 1100, 1250, 1000, 3600];
const LAST_STEP = STEP_MS.length - 1;

function visibleCount(step: number) {
  if (step >= 4) return 4;
  if (step >= 3) return 3;
  if (step >= 2) return 2;
  return 1;
}

export function CounterRail() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(reduceMotion ? LAST_STEP : 0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setStep(LAST_STEP);
      return;
    }
    const id = window.setTimeout(() => {
      setStep((prev) => {
        if (prev >= LAST_STEP) {
          setCycle((c) => c + 1);
          return 0;
        }
        return prev + 1;
      });
    }, STEP_MS[step]);
    return () => window.clearTimeout(id);
  }, [step, reduceMotion]);

  const shown = visibleCount(step);
  const isTyping = !reduceMotion && step === 1;
  const railActive = step >= 4;
  const rowLanded = step >= LAST_STEP;
  const bookingCount = rowLanded ? 6 : 5;

  const rows: BoardRow[] = rowLanded
    ? [t.rows[0], t.rows[1], t.newRow, t.rows[2]]
    : [...t.rows];

  return (
    <div className="relative">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]">
        {/* --- Yazışma --- */}
        <section
          className="relative z-10 flex flex-col overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--ahi-line)",
            background: "var(--ahi-paper)",
            boxShadow: "0 12px 40px -20px rgba(15, 23, 42, 0.28)",
          }}
          aria-label={`${t.channel} · ${t.contact}`}
        >
          <div
            className="flex items-center gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper-2)" }}
          >
            <span
              className="site-meta inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: "var(--ahi-brand)", color: "#fff" }}
            >
              SA
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--ahi-text)" }}>
                {t.contact}
              </p>
              <p className="site-meta text-[11px]" style={{ color: "var(--ahi-text-3)" }}>
                {t.channel}
              </p>
            </div>
          </div>

          {/* Mesajlar hep DOM'da; görünürlük yüksekliğe bağlı. Böylece sıfırlama
              turunda üst üste binen çıkış animasyonu oluşmuyor. */}
          <div className="flex min-h-[19rem] flex-1 flex-col justify-end px-4 py-4 sm:min-h-[20rem]">
            {t.messages.map((message, index) => {
              const visible = index < shown;
              const fromCustomer = message.from === "customer";
              return (
                <motion.div
                  key={index}
                  initial={false}
                  animate={{ height: visible ? "auto" : 0, opacity: visible ? 1 : 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 300, damping: 34 }
                  }
                  className="overflow-hidden"
                >
                  <div
                    className={`flex flex-col pt-2.5 ${fromCustomer ? "items-start" : "items-end"}`}
                  >
                    <div
                      className="max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed sm:text-sm"
                      style={
                        fromCustomer
                          ? {
                              background: "var(--ahi-paper-2)",
                              color: "var(--ahi-text)",
                              border: "1px solid var(--ahi-line)",
                              borderBottomLeftRadius: "0.375rem",
                            }
                          : {
                              background: "var(--ahi-brand)",
                              color: "#f2fbf7",
                              borderBottomRightRadius: "0.375rem",
                            }
                      }
                    >
                      {message.text}
                    </div>
                    <p
                      className="site-meta mt-1 text-[10px]"
                      style={{ color: "var(--ahi-text-3)" }}
                    >
                      {message.time}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            <motion.div
              initial={false}
              animate={{ height: isTyping ? "auto" : 0, opacity: isTyping ? 1 : 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-end gap-2 pt-2.5">
                <span className="site-meta text-[10px]" style={{ color: "var(--ahi-text-3)" }}>
                  {t.typing}
                </span>
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-2"
                  style={{ background: "var(--ahi-paper-2)", border: "1px solid var(--ahi-line)" }}
                >
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="block h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--ahi-brand)" }}
                      animate={isTyping ? { opacity: [0.25, 1, 0.25] } : { opacity: 0.25 }}
                      transition={{ duration: 1, repeat: Infinity, delay: dot * 0.16 }}
                    />
                  ))}
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* --- Ray --- */}
        <div className="relative flex items-center justify-center py-3 lg:py-0">
          {/* Mobil: kartlar üst üste — dikey bağlayıcı */}
          <div className="relative flex h-12 w-full items-center justify-center lg:hidden">
            <div
              className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--ahi-line-strong) 20%, var(--ahi-brand) 50%, var(--ahi-line-strong) 80%, transparent)",
              }}
            />
            <RailSignal active={railActive} cycle={cycle} vertical reduceMotion={!!reduceMotion} />
          </div>
          {/* Masaüstü: yan yana — dikey ray */}
          <div className="relative hidden h-full w-full lg:block">
            <div
              className="absolute left-1/2 top-8 bottom-8 w-px -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(180deg, transparent, var(--ahi-line-strong) 18%, var(--ahi-line-strong) 82%, transparent)",
              }}
            />
            <RailSignal active={railActive} cycle={cycle} vertical reduceMotion={!!reduceMotion} />
          </div>
        </div>

        {/* --- Defter --- */}
        <section
          className="relative z-10 flex flex-col overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--ahi-line)",
            background: "var(--ahi-paper)",
            boxShadow: "0 12px 40px -20px rgba(15, 23, 42, 0.28)",
          }}
          aria-label={t.boardTitle}
        >
          <div
            className="flex items-end justify-between gap-3 border-b px-4 py-3"
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

          <ul className="flex-1">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.li
                  key={`${row.time}-${row.name}`}
                  layout
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 32 }}
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
            className="border-t px-4 py-3"
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
