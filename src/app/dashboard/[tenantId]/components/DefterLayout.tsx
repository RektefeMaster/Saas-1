"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";

interface DefterLayoutProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** Ek kapak bilgisi (örn. "X kayıt") */
  coverExtra?: ReactNode;
  children: ReactNode;
  /** "randevu" | "musteri" — farklı kapak stilleri */
  variant?: "randevu" | "musteri";
  /** Body'de çizgili kağıt arka planı */
  ruled?: boolean;
}

const SPIRAL_RINGS = 14;

export function DefterLayout({
  title,
  subtitle,
  backHref,
  backLabel,
  coverExtra,
  children,
  variant = "randevu",
  ruled = true,
}: DefterLayoutProps) {
  return (
    <div className={`defter ${variant === "musteri" ? "defter-musteri" : ""}`}>
      {/* Spiral cilt */}
      <div className="defter-spiral" aria-hidden="true">
        {Array.from({ length: SPIRAL_RINGS }).map((_, i) => (
          <div key={i} className="defter-ring" />
        ))}
      </div>

      {/* Kapak / başlık */}
      <div className="defter-cover">
        <div className="flex flex-wrap items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="defter-cover-back"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
          )}
          <BookOpen className="h-5 w-5 text-amber-900/50 dark:text-amber-200/50" />
          <div>
            <h1 className="font-serif text-lg font-semibold text-amber-900/70 dark:text-amber-200/70">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 font-serif text-xs italic text-amber-800/45 dark:text-amber-300/45">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {coverExtra && (
          <div className="flex items-center gap-3">{coverExtra}</div>
        )}
      </div>

      {/* Defter gövdesi */}
      <div className="defter-body">
        {ruled && <div className="defter-page-lines" aria-hidden="true" />}
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
