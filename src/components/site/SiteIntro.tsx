"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const SESSION_KEY = "ahi-intro-seen";
const MIN_MS = 1400;
const MAX_MS = 2800;
const EXIT_MS = 480;

const COPY = {
  tr: { status: "Hazırlanıyor" },
  en: { status: "Getting ready" },
} as const;

type Visual = "pending" | "boot" | "react";
type Phase = "show" | "exit" | "done";

function unlockScroll() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

/**
 * Ana sayfa ilk yüklemesinde markalı intro.
 * Hard refresh’te `#ahi-boot-intro` (layout) anında boyanır;
 * soft navigasyonda React overlay kullanılır.
 */
export function SiteIntro() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [visual, setVisual] = useState<Visual>("pending");
  const [phase, setPhase] = useState<Phase>("show");

  useEffect(() => {
    let cancelled = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    const boot = document.getElementById("ahi-boot-intro");

    setVisual(boot ? "boot" : "react");
    if (boot) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      const statusEl = boot.querySelector(".ahi-boot-status");
      if (statusEl) {
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("ahi-ai-locale")
            : null;
        statusEl.textContent =
          stored === "en" ? COPY.en.status : COPY.tr.status;
      }
    }

    const finish = () => {
      if (cancelled) return;
      setPhase("exit");
      boot?.classList.add("ahi-boot-exit");
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        /* private mode */
      }
      exitTimer = setTimeout(() => {
        if (cancelled) return;
        setPhase("done");
        boot?.remove();
        unlockScroll();
      }, EXIT_MS);
    };

    const ready = () =>
      new Promise<void>((resolve) => {
        if (document.readyState === "complete") {
          resolve();
          return;
        }
        window.addEventListener("load", () => resolve(), { once: true });
      });

    let skipLong = false;
    try {
      skipLong = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      skipLong = false;
    }

    const minWait = skipLong ? 320 : MIN_MS;
    const maxWait = skipLong ? 700 : MAX_MS;

    const run = async () => {
      await Promise.race([
        (async () => {
          await ready();
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          const elapsed = performance.now() - started;
          const rest = Math.max(0, minWait - elapsed);
          if (rest > 0) await new Promise((r) => setTimeout(r, rest));
        })(),
        new Promise<void>((r) => setTimeout(r, maxWait)),
      ]);
      finish();
    };

    void run();

    if (!boot) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      cancelled = true;
      clearTimeout(exitTimer);
      boot?.remove();
      unlockScroll();
    };
  }, []);

  if (phase === "done" || visual === "pending" || visual === "boot") {
    return null;
  }

  return (
    <div
      className={`site-intro${phase === "exit" ? " site-intro--exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={phase === "show"}
      aria-label={t.status}
    >
      <div className="site-intro__glow" aria-hidden />
      <div className="site-intro__mark">
        <span className="site-intro__ring" aria-hidden />
        <Image
          src="/appicon.png"
          alt=""
          width={56}
          height={56}
          sizes="56px"
          priority
          className="site-intro__icon"
        />
      </div>
      <p className="site-intro__brand site-display">Ahi AI</p>
      <p className="site-intro__status">{t.status}</p>
      <div className="site-intro__track" aria-hidden>
        <div className="site-intro__bar" />
      </div>
    </div>
  );
}
