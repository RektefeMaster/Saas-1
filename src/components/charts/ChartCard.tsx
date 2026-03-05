"use client";

import React from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Normalize modunda bilgi notu (örn. Langfuse grafiği) */
  footnote?: string;
}

export function ChartCard({ title, subtitle, children, className = "", footnote }: ChartCardProps) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-slate-950/30 ${className}`}
    >
      <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5 dark:border-slate-800 dark:from-slate-900/50 dark:to-slate-900">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      <div className="p-6">
        {children}
        {footnote && (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{footnote}</p>
        )}
      </div>
    </section>
  );
}
