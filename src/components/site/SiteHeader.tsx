"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ThemeLocaleSwitch } from "@/components/ui/ThemeLocaleSwitch";
import { MarkArrow } from "./GuildMarks";

const COPY = {
  tr: {
    solutions: "Çözüm",
    flow: "Nasıl çalışır",
    businesses: "İşletmeler",
    contact: "İletişim",
    login: "Panele giriş",
    menu: "Menüyü aç veya kapat",
  },
  en: {
    solutions: "Product",
    flow: "How it works",
    businesses: "Businesses",
    contact: "Contact",
    login: "Sign in",
    menu: "Toggle menu",
  },
} as const;

interface SiteHeaderProps {
  onContact: () => void;
  solutionsHref?: string;
}

function isActiveHref(pathname: string, href: string) {
  if (href.startsWith("/#") || href.startsWith("#")) return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ onContact, solutionsHref = "/#ne-yapar" }: SiteHeaderProps) {
  const { locale } = useLocale();
  const pathname = usePathname() || "/";
  const t = COPY[locale];
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.body.classList.add("site-menu-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("site-menu-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const navLinks = [
    { label: t.solutions, href: solutionsHref },
    { label: t.flow, href: "/nasil-calisir" },
    { label: t.businesses, href: "/isletmeler" },
  ];

  return (
    <header className="sticky top-0 z-50">
      <div
        className="site-header-bar transition-[background-color,box-shadow] duration-200 md:transition-[background-color,box-shadow,backdrop-filter]"
        style={{
          background: scrolled
            ? "color-mix(in oklab, var(--ahi-paper) 96%, transparent)"
            : "var(--ahi-paper)",
          backdropFilter: scrolled ? "blur(10px)" : undefined,
          boxShadow: scrolled ? "0 1px 0 var(--ahi-line)" : undefined,
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Ahi AI">
            <Image src="/appicon.png" alt="" width={28} height={28} sizes="28px" priority />
            <span className="site-display text-[1.2rem]" style={{ color: "var(--ahi-text)" }}>
              Ahi AI
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Ana menü">
            {navLinks.map((link) => {
              const active = isActiveHref(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className="text-sm font-medium transition-colors"
                  style={{ color: active ? "var(--ahi-text)" : "var(--ahi-text-2)" }}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={onContact}
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--ahi-text-2)" }}
            >
              {t.contact}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeLocaleSwitch compact />
            </div>
            <Link href="/dashboard/login" className="site-btn site-btn-ink hidden md:inline-flex">
              {t.login}
              <MarkArrow className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={t.menu}
              aria-expanded={open}
              aria-controls="site-mobile-nav"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border md:hidden"
              style={{ borderColor: "var(--ahi-line-strong)", color: "var(--ahi-text)" }}
            >
              <span className="relative block h-3 w-4">
                <span
                  className="absolute left-0 block h-[1.6px] w-4 transition-transform duration-200"
                  style={{
                    background: "currentColor",
                    top: open ? "5.7px" : 0,
                    transform: open ? "rotate(45deg)" : "none",
                  }}
                />
                <span
                  className="absolute left-0 block h-[1.6px] w-4 transition-transform duration-200"
                  style={{
                    background: "currentColor",
                    bottom: open ? "5.7px" : 0,
                    transform: open ? "rotate(-45deg)" : "none",
                  }}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        id="site-mobile-nav"
        className="overflow-hidden transition-[max-height,opacity] duration-200 md:hidden"
        style={{
          maxHeight: open ? "24rem" : 0,
          opacity: open ? 1 : 0,
          background: "var(--ahi-paper)",
          borderBottom: open ? "1px solid var(--ahi-line)" : "none",
        }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-1 px-4 pb-5 pt-2 sm:px-6">
          {navLinks.map((link) => {
            const active = isActiveHref(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className="border-b py-3 text-lg font-semibold"
                style={{
                  borderColor: "var(--ahi-line)",
                  color: active ? "var(--ahi-brand)" : "var(--ahi-text)",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onContact();
              setOpen(false);
            }}
            className="border-b py-3 text-left text-lg font-semibold"
            style={{ borderColor: "var(--ahi-line)", color: "var(--ahi-text)" }}
          >
            {t.contact}
          </button>
          <div className="mt-3 flex items-center justify-between gap-3">
            <ThemeLocaleSwitch compact />
            <Link
              href="/dashboard/login"
              onClick={() => setOpen(false)}
              className="site-btn site-btn-ink"
            >
              {t.login}
              <MarkArrow className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
