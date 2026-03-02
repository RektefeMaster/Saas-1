"use client";

import { motion } from "motion/react";

type RevealVariant = "fadeUp" | "fadeIn" | "slideLeft" | "slideRight" | "scale";

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

interface ScrollRevealProps {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  once?: boolean;
  amount?: number | "some" | "all";
  className?: string;
  as?: "div" | "section" | "article";
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
}: ScrollRevealProps) {
  const v = variants[variant];
  const Component = MotionComponents[as];

  return (
    <Component
      initial={v.initial}
      whileInView={v.visible}
      viewport={{ once, amount }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={className}
    >
      {children}
    </Component>
  );
}
