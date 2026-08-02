"use client";

/**
 * Müşteri kaydının panelde nasıl göründüğünü gösteren vitrin kartı.
 */

import { useLocale } from "@/lib/locale-context";

const COPY = {
  tr: {
    heading: "Müşteri kaydı",
    name: "Zeynep Aksoy",
    since: "2024'ten beri müşteri",
    phone: "+90 5•• ••• 41 07",
    tagsLabel: "Etiketler",
    tags: ["düzenli", "dip boya", "hafta içi"],
    visitsLabel: "Son ziyaretler",
    visits: [
      { date: "12 Tem", service: "Dip boya + bakım", staff: "Elif", amount: "1.850 ₺" },
      { date: "14 Haz", service: "Saç kesimi", staff: "Elif", amount: "700 ₺" },
      { date: "03 May", service: "Dip boya", staff: "Elif", amount: "1.600 ₺" },
    ],
    noteLabel: "Ekip notu",
    note: "Boya sonrası bakım paketini konuşacaktık. Elif ile çalışmayı tercih ediyor.",
    footer: "Son 6 ayda 7 randevu · 1 gelmedi · ortalama 42 günde bir geliyor",
  },
  en: {
    heading: "Customer record",
    name: "Zeynep Aksoy",
    since: "Customer since 2024",
    phone: "+90 5•• ••• 41 07",
    tagsLabel: "Tags",
    tags: ["regular", "root colour", "weekdays"],
    visitsLabel: "Recent visits",
    visits: [
      { date: "12 Jul", service: "Root colour + care", staff: "Elif", amount: "₺1,850" },
      { date: "14 Jun", service: "Haircut", staff: "Elif", amount: "₺700" },
      { date: "03 May", service: "Root colour", staff: "Elif", amount: "₺1,600" },
    ],
    noteLabel: "Team note",
    note: "We were going to discuss the after-colour care package. Prefers working with Elif.",
    footer: "7 bookings in 6 months · 1 no-show · returns every 42 days on average",
  },
} as const;

export function LedgerCard() {
  const { locale } = useLocale();
  const t = COPY[locale];

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--ahi-line)",
        background: "var(--ahi-paper)",
        boxShadow: "0 12px 40px -20px rgba(15, 23, 42, 0.28)",
      }}
    >
      <div
        className="flex items-start justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper-2)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="site-meta inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold"
            style={{ background: "var(--ahi-brand)", color: "#fff" }}
          >
            ZA
          </span>
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--ahi-text)" }}>
              {t.name}
            </p>
            <p className="site-meta text-[11px]" style={{ color: "var(--ahi-text-3)" }}>
              {t.since} · {t.phone}
            </p>
          </div>
        </div>
        <span className="hidden text-xs font-medium sm:block" style={{ color: "var(--ahi-text-3)" }}>
          {t.heading}
        </span>
      </div>

      <div className="grid gap-5 px-5 py-5">
        <div>
          <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ahi-text-3)" }}>
            {t.tagsLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {t.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border px-2.5 py-1 text-xs font-medium"
                style={{
                  borderColor: "var(--ahi-line)",
                  color: "var(--ahi-text-2)",
                  background: "var(--ahi-paper-2)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ahi-text-3)" }}>
            {t.visitsLabel}
          </p>
          <ul className="grid">
            {t.visits.map((visit, index) => (
              <li
                key={visit.date}
                className="grid grid-cols-[3.75rem_1fr_auto] items-baseline gap-3 py-2.5"
                style={{
                  borderTop: index === 0 ? "none" : "1px solid var(--ahi-line)",
                }}
              >
                <span className="site-meta text-xs" style={{ color: "var(--ahi-text-3)" }}>
                  {visit.date}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm" style={{ color: "var(--ahi-text)" }}>
                    {visit.service}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--ahi-text-3)" }}>
                    {visit.staff}
                  </span>
                </span>
                <span className="site-meta text-sm font-semibold" style={{ color: "var(--ahi-text-2)" }}>
                  {visit.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold" style={{ color: "var(--ahi-text-3)" }}>
            {t.noteLabel}
          </p>
          <p
            className="border-l-2 py-0.5 pl-3 text-sm leading-relaxed"
            style={{ borderColor: "var(--ahi-brand)", color: "var(--ahi-text-2)" }}
          >
            {t.note}
          </p>
        </div>
      </div>

      <div
        className="border-t px-5 py-3"
        style={{ borderColor: "var(--ahi-line)", background: "var(--ahi-paper-2)" }}
      >
        <p className="site-meta text-[11px]" style={{ color: "var(--ahi-text-3)" }}>
          {t.footer}
        </p>
      </div>
    </div>
  );
}
