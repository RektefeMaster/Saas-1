"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";

type RevealVariant = "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale";

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefersReducedMotion;
}

const variants: Record<
  RevealVariant,
  { initial: Record<string, number>; visible: Record<string, number | string> }
> = {
  fadeUp: {
    initial: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideLeft: {
    initial: { opacity: 0, x: 32 },
    visible: { opacity: 1, x: 0 },
  },
  slideRight: {
    initial: { opacity: 0, x: -32 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1 },
  },
};

// Sabit transition objesi - her render'da yeni obje oluşturulmasını önler
const defaultEase = [0.25, 0.46, 0.45, 0.94] as const;

interface ScrollRevealProps {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  amount?: number | "some" | "all";
  className?: string;
  as?: "div" | "section" | "article";
  reduceMotion?: boolean;
}

const MotionComponents = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
};

export function ScrollReveal({
  children,
  variant = "fadeUp",
  delay = 0,
  duration = 0.5,
  once = true,
  amount = 0.15,
  className,
  as = "div",
  reduceMotion,
}: ScrollRevealProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const skipMotion = reduceMotion ?? prefersReducedMotion;

  if (skipMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  const v = variants[variant];
  const Component = MotionComponents[as];

  // Transition objesini memoize et - delay ve duration değişmediği sürece aynı referans
  const transition = useMemo(
    () => ({
      duration,
      delay,
      ease: defaultEase,
    }),
    [duration, delay]
  );

  return (
    <Component
      initial={v.initial}
      whileInView={v.visible}
      viewport={{ once, amount }}
      transition={transition}
      className={className}
    >
      {children}
    </Component>
  );
}
