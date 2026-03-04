"use client";

import dynamic from "next/dynamic";

export const BarChartLazy = dynamic(
  () => import("@tremor/react").then((m) => ({ default: m.BarChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    ),
  }
);
