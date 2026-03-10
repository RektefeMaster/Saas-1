"use client";

import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import type { CommandCenterSnapshot, CommandCenterAction } from "./CommandCenterSection";
import { DAY_NAMES, type Appointment, type OpsAlert, type ReviewData } from "./dashboard.types";

const ChartBar = dynamic(
  () => import("@/components/charts/ChartBar").then((m) => ({ default: m.ChartBar })),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

const CommandCenterSection = dynamic(
  () => import("./CommandCenterSection").then((m) => ({ default: m.CommandCenterSection })),
  { ssr: false, loading: () => <div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> }
);

interface OverviewViewProps {
  commandCenter: CommandCenterSnapshot | null;
  commandCenterLoading: boolean;
  runningActionId: string | null;
  opsAlerts: OpsAlert[];
  opsAlertsLoading: boolean;
  resolvingAlertId: string | null;
  reviews: ReviewData | null;
  appointments: Appointment[];
  grouped: Record<string, Appointment[]>;
  weekDates: string[];
  onRunAction: (action: CommandCenterAction) => void;
  onResolveAlert: (alertId: string) => void;
}

export function OverviewView({
  commandCenter,
  commandCenterLoading,
  runningActionId,
  opsAlerts,
  opsAlertsLoading,
  resolvingAlertId,
  reviews,
  appointments,
  grouped,
  weekDates,
  onRunAction,
  onResolveAlert,
}: OverviewViewProps) {
  return (
    <>
      <ScrollReveal variant="fadeUp" delay={0} as="section" className="mb-6" reduceMotion>
        <CommandCenterSection
          commandCenter={commandCenter}
          loading={commandCenterLoading}
          runningActionId={runningActionId}
          onRunAction={onRunAction}
        />
      </ScrollReveal>

      <ScrollReveal variant="fadeUp" delay={0.08} as="section" className="mb-6" reduceMotion>
        <section className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-white to-red-50/30 p-5 shadow-lg dark:border-red-900/50 dark:from-slate-900 dark:to-red-950/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-red-900 dark:text-red-200">
                <AlertCircle className="h-5 w-5" />
                Önemli Bildirimler
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {opsAlerts.length > 0 ? `${opsAlerts.length} açık bildirim` : "Açık bildirim yok"}
              </p>
            </div>
            {opsAlertsLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Yenileniyor…
              </div>
            )}
          </div>
          {opsAlerts.length === 0 ? (
            <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-6 text-center dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-800">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">Açık bildirim yok</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Şu an takip edilmesi gereken bir konu görünmüyor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opsAlerts.map((alert) => {
                const severityStyles = {
                  high: "from-red-50 to-red-100 border-red-300 text-red-900 dark:from-red-900/40 dark:to-red-800/40 dark:border-red-800 dark:text-red-200",
                  medium: "from-amber-50 to-amber-100 border-amber-300 text-amber-900 dark:from-amber-900/40 dark:to-amber-800/40 dark:border-amber-700 dark:text-amber-200",
                  low: "from-blue-50 to-blue-100 border-blue-300 text-blue-900 dark:from-blue-900/40 dark:to-blue-800/40 dark:border-blue-700 dark:text-blue-200",
                };
                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl border-2 bg-gradient-to-r ${severityStyles[alert.severity]} px-4 py-3 shadow-sm`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold">{alert.message}</p>
                            <p className="mt-1.5 flex items-center gap-2 text-xs opacity-80">
                              <Clock className="h-3 w-3" />
                              {new Date(alert.created_at).toLocaleString("tr-TR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {alert.customer_phone && (
                                <>
                                  <span>•</span>
                                  <span>{alert.customer_phone}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onResolveAlert(alert.id)}
                        disabled={resolvingAlertId === alert.id}
                        className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:shadow-md disabled:opacity-50 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {resolvingAlertId === alert.id ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
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
      </ScrollReveal>

      {appointments.length > 0 && (
        <ScrollReveal variant="fadeUp" delay={0.02} as="section" className="mb-6" reduceMotion>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Haftalık Randevu Özeti
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">Son 7 günün randevu dağılımı</p>
            <ChartBar
              data={weekDates.slice(0, 7).map((dateStr) => {
                const d = new Date(dateStr + "T12:00:00");
                return {
                  gün: DAY_NAMES[d.getDay()],
                  Randevu: grouped[dateStr]?.length ?? 0,
                };
              })}
              xKey="gün"
              bars="Randevu"
              colors="emerald"
              height={280}
            />
          </section>
        </ScrollReveal>
      )}

      {reviews && (
        <ScrollReveal variant="scale" delay={0} as="section" className="mt-6" reduceMotion>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">⭐ Değerlendirmeler</h3>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Ortalama: <span className="font-semibold text-amber-600 dark:text-amber-400">{reviews.avgRating} ⭐</span> ({reviews.totalCount}{" "}
              yorum)
            </p>
            {reviews.reviews.length > 0 && (
              <ul className="max-h-40 space-y-2 overflow-y-auto">
                {reviews.reviews.map((r) => (
                  <li key={r.id} className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm dark:bg-slate-800/60">
                    <span className="text-amber-600 dark:text-amber-400">{r.rating} ⭐</span>
                    {r.comment && <span className="ml-2 text-slate-700 dark:text-slate-300">– {r.comment}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ScrollReveal>
      )}
    </>
  );
}
