"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

export type AtmosphereSrc =
  | "/site/hero-whatsapp-desk.jpg"
  | "/site/ops-calendar-day.jpg"
  | "/site/chat-in-shop.jpg"
  | "/site/storefront-qr.jpg"
  | "/site/trust-secure.jpg";

type AtmosphereStrength = "whisper" | "soft" | "veil";
type MobileMode = "on" | "off";

interface SiteAtmosphereProps {
  src: AtmosphereSrc;
  alt?: string;
  strength?: AtmosphereStrength;
  blurPx?: number;
  priority?: boolean;
  position?: string;
  className?: string;
  /** Varsayılan off — mobilde görsel hiç yüklenmez. */
  mobile?: MobileMode;
}

const LAYER: Record<
  AtmosphereStrength,
  { image: number; wash: number; topWash: number; bottomWash: number }
> = {
  whisper: { image: 0.48, wash: 58, topWash: 70, bottomWash: 74 },
  soft: { image: 0.38, wash: 66, topWash: 78, bottomWash: 80 },
  veil: { image: 0.28, wash: 74, topWash: 84, bottomWash: 86 },
};

const MD_MQ = "(min-width: 768px)";

function toMobileSrc(src: AtmosphereSrc): string {
  return src.replace(/\.jpg$/, "-m.jpg");
}

/**
 * Atmosfer arka planı.
 * - mobile="on": küçük JPEG (blur yok) + md+ masaüstü
 * - mobile="off": yalnızca md+; mobilde null (decode yok)
 * Mount sonrası media sorulur — hydration ağacı sabit kalır.
 */
export function SiteAtmosphere({
  src,
  alt = "",
  strength = "soft",
  blurPx = 5,
  priority = false,
  position = "center",
  className = "",
  mobile = "off",
}: SiteAtmosphereProps) {
  const layer = LAYER[strength];
  const [isMd, setIsMd] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MD_MQ);
    const apply = () => setIsMd(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // mobile=off: mobilde hiç mount etme (SSR + ilk paint boş — kasıtlı)
  if (mobile === "off" && isMd === false) return null;
  if (mobile === "off" && isMd === null) return null;

  const showMobileImage = mobile === "on" && isMd !== true;
  const showDesktopImage = isMd === true;

  const blurStyle = {
    opacity: layer.image,
    "--site-atm-blur": `${blurPx}px`,
  } as CSSProperties;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ background: "var(--ahi-paper)" }}
    >
      {showMobileImage ? (
        <div className="absolute inset-0" style={{ opacity: layer.image * 0.9 }}>
          <Image
            src={toMobileSrc(src)}
            alt={alt}
            fill
            priority={priority}
            sizes="100vw"
            quality={58}
            className="object-cover"
            style={{ objectPosition: position }}
          />
        </div>
      ) : null}

      {showDesktopImage ? (
        <div className="site-atm-blur absolute inset-[-16px]" style={blurStyle}>
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes="100vw"
            quality={72}
            className="object-cover"
            style={{ objectPosition: position }}
          />
        </div>
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            180deg,
            color-mix(in oklab, var(--ahi-paper) ${layer.topWash}%, transparent) 0%,
            color-mix(in oklab, var(--ahi-paper) ${layer.wash}%, transparent) 40%,
            color-mix(in oklab, var(--ahi-paper) ${layer.wash}%, transparent) 65%,
            color-mix(in oklab, var(--ahi-paper) ${layer.bottomWash}%, transparent) 100%
          )`,
        }}
      />

      {showDesktopImage ? (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              90deg,
              color-mix(in oklab, var(--ahi-paper) 55%, transparent) 0%,
              color-mix(in oklab, var(--ahi-paper) 18%, transparent) 42%,
              transparent 72%
            )`,
          }}
        />
      ) : null}
    </div>
  );
}
