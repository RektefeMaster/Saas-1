"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SESSION_KEY = "ahi-intro-seen";
const MIN_MS = 900;
const MAX_MS = 2200;
const EXIT_MS = 550;

type Visual = "pending" | "boot" | "react";
type Phase = "show" | "exit" | "done";

function unlockScroll() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

/**
 * Ana sayfa ilk yüklemesinde sade marka girişi.
 * Hard refresh’te `#ahi-boot-intro` boyanır; soft navigasyonda React overlay.
 */
export function SiteIntro() {
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

    const minWait = skipLong ? 240 : MIN_MS;
    const maxWait = skipLong ? 500 : MAX_MS;

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
      aria-label="Ahi AI"
    >
      <div className="site-intro__mark">
        <Image
          src="/appicon.png"
          alt=""
          width={28}
          height={28}
          sizes="28px"
          priority
          className="site-intro__icon"
        />
        <p className="site-intro__brand">Ahi AI</p>
      </div>
    </div>
  );
}
