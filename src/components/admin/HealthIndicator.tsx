"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Activity, AlertTriangle, CheckCircle, Pause } from "lucide-react";
import { cn } from "@/lib/cn";

type HealthStatus = "ok" | "warning" | "degraded" | "paused" | "unknown";

async function fetcher(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Health fetch failed");
  return res.json() as Promise<{ status?: HealthStatus; sentryCount?: number }>;
}

export function HealthIndicator() {
  const [hover, setHover] = useState(false);
  const { data, isLoading } = useSWR("/api/admin/tools/health", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });

  const status = data?.status ?? "unknown";
  const sentryCount = data?.sentryCount ?? 0;

  const config = {
    ok: {
      color: "bg-emerald-500",
      icon: CheckCircle,
      label: "Sistem sağlıklı",
    },
    warning: {
      color: "bg-amber-500",
      icon: AlertTriangle,
      label: `${sentryCount} Sentry hatası (24 saat)`,
    },
    degraded: {
      color: "bg-amber-600",
      icon: AlertTriangle,
      label: `${sentryCount} Sentry hatası — dikkat`,
    },
    paused: {
      color: "bg-slate-500",
      icon: Pause,
      label: "Sistem donduruldu (Kill Switch)",
    },
    unknown: {
      color: "bg-slate-400",
      icon: Activity,
      label: "Durum bilinmiyor",
    },
  };

  const cfg = config[status];
  const Icon = cfg.icon;

  if (isLoading) return null;

  return (
    <div
      className="fixed bottom-20 left-4 z-30 lg:bottom-4"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        href="/admin/tools"
        title={cfg.label}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg ring-1 ring-slate-900/5 transition-all duration-200 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-700",
          hover ? "scale-[1.02] shadow-xl" : "hover:shadow-xl"
        )}
      >
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900",
            cfg.color
          )}
        />
        {(hover || status !== "ok") && (
          <span className="max-w-[160px] truncate text-xs font-medium text-slate-700 dark:text-slate-200">
            {cfg.label}
          </span>
        )}
        {!hover && status === "ok" && (
          <Icon className="h-4 w-4 text-slate-400" aria-hidden />
        )}
      </Link>
    </div>
  );
}
