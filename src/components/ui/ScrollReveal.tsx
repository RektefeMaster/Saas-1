"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

type RevealVariant = "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale";

const VARIANT_CLASS: Record<RevealVariant, string> = {
  fadeUp: "reveal-fade-up",
  fadeIn: "reveal-fade-in",
  slideLeft: "reveal-slide-left",
  slideRight: "reveal-slide-right",
  scale: "reveal-scale",
};

interface ScrollRevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  amount?: number | "some" | "all";
  className?: string;
  as?: "div" | "section" | "article";
  id?: string;
  reduceMotion?: boolean;
}

export function ScrollReveal({
  children,
  variant = "fadeUp",
  delay = 0,
  className,
  as = "div",
  id,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("reveal-in");
      return;
    }

    // Already visible (e.g. soft navigation) — reveal immediately.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      el.classList.add("reveal-in");
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("reveal-in");
        io.disconnect();
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as ElementType;
  return (
    <Tag
      ref={ref}
      id={id}
      className={["reveal", VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
      style={{ "--reveal-delay": `${Math.max(0, delay)}s` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
