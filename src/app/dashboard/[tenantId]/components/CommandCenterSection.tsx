"use client";

import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

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

export function CommandCenterSection({
  commandCenter,
  loading,
  runningActionId,
  onRunAction,
}: CommandCenterSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <span className="text-xl">🎯</span>
            Operasyon Merkezi
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Gelir ve operasyon aksiyonlarınızı buradan yönetin
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Yenileniyor...
          </div>
        )}
      </div>

      {!commandCenter ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">Operasyon verisi alınıyor...</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Aylık Ciro</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {commandCenter.kpis.monthly_revenue_try.toLocaleString("tr-TR")} ₺
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Doluluk</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                %{commandCenter.kpis.fill_rate_pct.toFixed(1)}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Gelmeme</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                %{commandCenter.kpis.no_show_rate_pct.toFixed(1)}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Riskli Müşteri</p>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {commandCenter.kpis.at_risk_customers}
              </p>
            </motion.div>
          </div>

          <div className="space-y-3">
            {commandCenter.actions.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border-2 border-slate-200 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">Bugün için kritik aksiyon bulunmuyor</p>
                <p className="mt-1 text-xs text-slate-500">Her şey yolunda görünüyor! 🎉</p>
              </div>
            ) : (
              commandCenter.actions.map((action, idx) => {
                const severityColors = {
                  high: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
                  medium: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
                  low: "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
                };
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-4 shadow-sm ${severityColors[action.severity]}`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{action.description}</p>
                      {action.estimated_impact_try > 0 && (
                        <p className="mt-2 inline-block rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          💰 Tahmini etki: {action.estimated_impact_try.toLocaleString("tr-TR")} ₺
                        </p>
                      )}
                    </div>
                    <motion.button
                      type="button"
                      onClick={() => onRunAction(action)}
                      disabled={runningActionId === action.id}
                      whileHover={{ scale: runningActionId === action.id ? 1 : 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {runningActionId === action.id ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Çalışıyor...
                        </span>
                      ) : (
                        action.cta_label
                      )}
                    </motion.button>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}
    </section>
  );
}
