"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";

const COPY = {
  tr: {
    line: "WhatsApp’tan gelen talebi randevuya ve müşteri kaydına bağlayan işletme paneli.",
    columns: [
      {
        title: "Ürün",
        links: [
          { label: "Ne yapar", href: "/#ne-yapar" },
          { label: "Nasıl çalışır", href: "/nasil-calisir" },
          { label: "Paneli incele", href: "/panel-incele" },
        ],
      },
      {
        title: "İşletmeler",
        links: [
          { label: "İşletme rehberi", href: "/isletmeler" },
          { label: "İşletme girişi", href: "/dashboard/login" },
        ],
      },
      {
        title: "Kurumsal",
        links: [
          { label: "Gizlilik", href: "/gizlilik" },
          { label: "Veri silme", href: "/veri-silme" },
        ],
      },
    ],
    contact: "İletişime geç",
    copyright: "© 2026 Ahi AI",
  },
  en: {
    line: "A business panel that turns WhatsApp requests into bookings and customer records.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "What it does", href: "/#ne-yapar" },
          { label: "How it works", href: "/nasil-calisir" },
          { label: "Explore the panel", href: "/panel-incele" },
        ],
      },
      {
        title: "Businesses",
        links: [
          { label: "Business directory", href: "/isletmeler" },
          { label: "Business login", href: "/dashboard/login" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "Privacy", href: "/gizlilik" },
          { label: "Data deletion", href: "/veri-silme" },
        ],
      },
    ],
    contact: "Get in touch",
    copyright: "© 2026 Ahi AI",
  },
} as const;

export function SiteFooter({ onContact }: { onContact: () => void }) {
  const { locale } = useLocale();
  const t = COPY[locale];

  return (
    <footer style={{ background: "var(--ahi-ink)" }}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_2fr]">
          <div>
            <p className="site-display text-xl" style={{ color: "var(--ahi-on-ink)" }}>
              Ahi AI
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: "var(--ahi-on-ink-2)" }}>
              {t.line}
            </p>
            <button
              type="button"
              onClick={onContact}
              className="mt-5 text-sm font-semibold transition-colors"
              style={{ color: "var(--ahi-brand-lift)" }}
            >
              {t.contact}
            </button>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {t.columns.map((column) => (
              <div key={column.title}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ahi-on-ink-2)" }}>
                  {column.title}
                </p>
                <ul className="mt-3 grid gap-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm transition-colors hover:opacity-80"
                        style={{ color: "var(--ahi-on-ink)" }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t pt-5" style={{ borderColor: "var(--ahi-on-ink-line)" }}>
          <p className="site-meta text-xs" style={{ color: "var(--ahi-on-ink-2)" }}>
            {t.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
