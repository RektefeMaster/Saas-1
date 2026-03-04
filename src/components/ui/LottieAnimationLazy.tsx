"use client";

import dynamic from "next/dynamic";

export const LottieAnimationLazy = dynamic(
  () => import("./LottieAnimation").then((m) => ({ default: m.LottieAnimation })),
  {
    ssr: false,
    loading: () => (
      <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
    ),
  }
);
