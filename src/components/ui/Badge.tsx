"use client";

import type { HTMLAttributes } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "outline";

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
  error:
    "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400",
  outline:
    "border border-slate-200 bg-transparent text-slate-700 dark:border-slate-700 dark:text-slate-300",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        variantStyles[variant] +
        " " +
        className
      }
      {...props}
    >
      {children}
    </span>
  );
}
