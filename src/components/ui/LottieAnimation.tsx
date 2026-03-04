"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";

const LOTTIE_PRESETS = {
  loading: "/animations/loading.json",
  empty: "/animations/empty.json",
  success: "/animations/success.json",
} as const;

interface LottieAnimationProps {
  /** URL veya path: "loading" | "empty" preset veya "/animations/xxx.json" */
  src?: string | keyof typeof LOTTIE_PRESETS;
  /** Doğrudan JSON objesi (import edilmiş) */
  animationData?: object;
  width?: number;
  height?: number;
  loop?: boolean;
  className?: string;
}

export function LottieAnimation({
  src,
  animationData,
  width = 120,
  height = 120,
  loop = true,
  className = "",
}: LottieAnimationProps) {
  const [data, setData] = useState<object | null>(animationData ?? null);
  const [error, setError] = useState(false);

  const url = typeof src === "string" && src in LOTTIE_PRESETS ? LOTTIE_PRESETS[src as keyof typeof LOTTIE_PRESETS] : src;

  useEffect(() => {
    if (animationData) {
      setData(animationData);
      return;
    }
    if (!url || typeof url !== "string") return;
    setError(false);
    fetch(url)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setError(true));
  }, [url, animationData]);

  if (error || !data) {
    return (
      <div
        className={`animate-pulse rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
        style={{ width, height }}
      />
    );
  }

  return (
    <Lottie
      animationData={data}
      loop={loop}
      style={{ width, height }}
      className={className}
    />
  );
}
