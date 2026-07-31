"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Clock, Loader2, Star } from "lucide-react";
import { useDashboardStore } from "@/stores/dashboard-store";
import { groupByDate, getWeekDates, DAY_NAMES } from "./dashboard.types";
import { CommandCenterSection, type CommandCenterAction } from "./CommandCenterSection";

const CHART_HEIGHT_MOBILE = 200;
const CHART_HEIGHT_DESKTOP = 280;

const ChartBar = dynamic(
  () => import("@/components/charts/ChartBar").then((m) => ({ default: m.ChartBar })),
  {
    loading: () => (
      <div className="h-[200px] animate-pulse rounded-xl bg-slate-100 sm:h-[280px] dark:bg-slate-800" />
    ),
  }
);

interface OverviewViewProps {
  onRunAction: (action: CommandCenterAction) => void;
  onResolveAlert: (alertId: string) => void;
}

function OverviewViewInner({ onRunAction, onResolveAlert }: OverviewViewProps) {
  const commandCenter = useDashboardStore((state) => state.commandCenter);
  const commandCenterLoading = useDashboardStore((state) => state.commandCenterLoading);
  const runningActionId = useDashboardStore((state) => state.runningActionId);
  const opsAlerts = useDashboardStore((state) => state.opsAlerts);
  const opsAlertsLoading = useDashboardStore((state) => state.opsAlertsLoading);
  const resolvingAlertId = useDashboardStore((state) => state.resolvingAlertId);
  const reviews = useDashboardStore((state) => state.reviews);
  const appointments = useDashboardStore((state) => state.appointments);

  const grouped = useMemo(() => groupByDate(appointments), [appointments]);
  const [weekDates] = useState(() => getWeekDates(new Date()));
  const chartData = useMemo(
    () =>
      weekDates.slice(0, 7).map((dateStr) => {
        const d = new Date(dateStr + "T12:00:00");
        return {
          gün: DAY_NAMES[d.getDay()],
          Randevu: grouped[dateStr]?.length ?? 0,
        };
      }),
    [weekDates, grouped]
  );

  const hasAppointments = appointments.length > 0;
  const openAlertCount = opsAlerts.length;

  const [chartHeight, setChartHeight] = useState(CHART_HEIGHT_MOBILE);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setChartHeight(mq.matches ? CHART_HEIGHT_DESKTOP : CHART_HEIGHT_MOBILE);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="min-w-0 space-y-5">
      <CommandCenterSection
        commandCenter={commandCenter}
        loading={commandCenterLoading}
        runningActionId={runningActionId}
        onRunAction={onRunAction}
      />

      <section className="panel-surface p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <AlertCircle
                className={`h-5 w-5 ${openAlertCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}
                aria-hidden
              />
              Bildirimler
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {openAlertCount > 0 ? `${openAlertCount} açık bildirim` : "Takip edilmesi gereken konu yok"}
            </p>
          </div>
          {opsAlertsLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Yenileniyor…
            </div>
          )}
        </div>

        {openAlertCount === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Her şey yolunda</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Yeni bir bildirim olduğunda burada listelenir.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {opsAlerts.map((alert) => {
              const edge =
                alert.severity === "high"
                  ? "border-l-red-500"
                  : alert.severity === "medium"
                    ? "border-l-amber-500"
                    : "border-l-slate-400";
              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40 ${edge}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.message}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {new Date(alert.created_at).toLocaleString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {alert.customer_phone && <span>{alert.customer_phone}</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onResolveAlert(alert.id)}
                      disabled={resolvingAlertId === alert.id}
                      className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:px-3 sm:py-1.5 sm:text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {resolvingAlertId === alert.id ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Kapanıyor…
                        </span>
                      ) : (
                        "Kapat"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {hasAppointments && (
        <section className="panel-surface p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Haftalık randevu özeti</h3>
          <p className="mb-4 mt-1 text-sm text-slate-600 dark:text-slate-400">Son 7 günün dağılımı</p>
          <div className="min-w-0 overflow-hidden">
            <ChartBar data={chartData} xKey="gün" bars="Randevu" colors="emerald" height={chartHeight} />
          </div>
        </section>
      )}

      {reviews && (
        <section className="panel-surface p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Star className="h-4 w-4 text-amber-500" aria-hidden />
            Değerlendirmeler
          </h3>
          <p className="mb-3 mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ortalama{" "}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {reviews.avgRating}
            </span>{" "}
            · {reviews.totalCount} yorum
          </p>
          {reviews.reviews.length > 0 && (
            <ul className="max-h-40 space-y-2 overflow-y-auto scrollbar-thin">
              {reviews.reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800/60"
                >
                  <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    {r.rating}
                    <Star className="h-3 w-3 fill-current" aria-hidden />
                  </span>
                  {r.comment && (
                    <span className="ml-2 break-words text-slate-700 dark:text-slate-300">– {r.comment}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export const OverviewView = memo(OverviewViewInner);
