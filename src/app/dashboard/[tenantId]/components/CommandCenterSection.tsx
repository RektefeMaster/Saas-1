"use client";

import { memo } from "react";
import { Loader2, Target } from "lucide-react";

export interface CommandCenterAction {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  cta_label: string;
  cta_endpoint: string;
  estimated_impact_try: number;
}

export interface CommandCenterSnapshot {
  tenant_id: string;
  generated_at: string;
  blueprint_slug: string;
  kpis: {
    monthly_revenue_try: number;
    monthly_appointments: number;
    no_show_rate_pct: number;
    cancellation_rate_pct: number;
    fill_rate_pct: number;
    avg_ticket_try: number;
    at_risk_customers: number;
    open_ops_alerts: number;
    avg_rating: number;
    north_star_ai_revenue_try: number;
  };
  actions: CommandCenterAction[];
}

interface CommandCenterSectionProps {
  commandCenter: CommandCenterSnapshot | null;
  loading: boolean;
  runningActionId: string | null;
  onRunAction: (action: CommandCenterAction) => void;
}

const severityDot: Record<CommandCenterAction["severity"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

export const CommandCenterSection = memo(function CommandCenterSection({
  commandCenter,
  loading,
  runningActionId,
  onRunAction,
}: CommandCenterSectionProps) {
  return (
    <section className="panel-surface p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Bugünün özeti
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ciro, doluluk ve önerilen sonraki adımlar
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Yenileniyor…
          </div>
        )}
      </div>

      {!commandCenter ? (
        <div className="flex flex-col items-center justify-center py-12" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" aria-hidden />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Özet yükleniyor…</p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Aylık Ciro",
                value: `${commandCenter.kpis.monthly_revenue_try.toLocaleString("tr-TR")} ₺`,
              },
              {
                label: "Doluluk",
                value: `%${commandCenter.kpis.fill_rate_pct.toFixed(1)}`,
              },
              {
                label: "Gelmeme oranı",
                value: `%${commandCenter.kpis.no_show_rate_pct.toFixed(1)}`,
              },
              {
                label: "Riskli müşteri",
                value: String(commandCenter.kpis.at_risk_customers),
              },
            ].map((kpi) => (
              <div key={kpi.label} className="panel-muted px-4 py-3.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-slate-100">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            {commandCenter.actions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Şu an önerilen bir adım yok
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Yeni bir öneri oluşunca burada listelenir.
                </p>
              </div>
            ) : (
              commandCenter.actions.map((action) => (
                <div
                  key={action.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${severityDot[action.severity]}`}
                        aria-label={`Önem: ${action.severity}`}
                      />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {action.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {action.description}
                    </p>
                    {action.estimated_impact_try > 0 && (
                      <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Tahmini etki: {action.estimated_impact_try.toLocaleString("tr-TR")} ₺
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRunAction(action)}
                    disabled={runningActionId === action.id}
                    className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
                  >
                    {runningActionId === action.id ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Çalışıyor…
                      </span>
                    ) : (
                      action.cta_label
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
});
