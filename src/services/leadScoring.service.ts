/**
 * Explainable lead scoring. WhatsApp V1: no +15 for phone (already channel identity).
 * Silence decay applied at most once per window via silence_decay_applied_at.
 * Event updates MERGE into existing breakdown — never wipe prior signals.
 */

import { supabase } from "@/lib/supabase";
import { transitionPipelineStage } from "@/services/crmPipeline.service";
import { createOpsAlert } from "@/services/opsAlert.service";

export type LeadScoreBreakdown = {
  nameProvided?: number;
  serviceSelected?: number;
  branchSelected?: number;
  dateSelected?: number;
  appointmentCompleted?: number;
  budgetStated?: number;
  paymentIntent?: number;
  nearTermIntent?: number;
  priceReask?: number;
  spam?: number;
  silenceDecay?: number;
  [key: string]: number | undefined;
};

export type LeadScoreSignals = {
  nameProvided?: boolean;
  serviceSelected?: boolean;
  branchSelected?: boolean;
  dateSelected?: boolean;
  appointmentCompleted?: boolean;
  budgetStated?: boolean;
  paymentIntent?: boolean;
  nearTermIntent?: boolean;
  priceReask?: boolean;
  spam?: boolean;
  silenceDays?: number;
};

const WEIGHTS = {
  nameProvided: 10,
  serviceSelected: 10,
  branchSelected: 5,
  dateSelected: 15,
  appointmentCompleted: 25,
  budgetStated: 15,
  paymentIntent: 20,
  nearTermIntent: 20,
  priceReask: 5,
  spam: -100,
  silenceDecay: -10,
} as const;

const LEAD_SCORE_VERSION = 1;
const SILENCE_DECAY_DAYS = 3;

export function computeLeadScore(signals: LeadScoreSignals): {
  score: number;
  breakdown: LeadScoreBreakdown;
} {
  const breakdown: LeadScoreBreakdown = {};
  let score = 0;

  const apply = (key: keyof typeof WEIGHTS, on: boolean | undefined) => {
    if (!on) return;
    breakdown[key] = WEIGHTS[key];
    score += WEIGHTS[key];
  };

  apply("nameProvided", signals.nameProvided);
  apply("serviceSelected", signals.serviceSelected);
  apply("branchSelected", signals.branchSelected);
  apply("dateSelected", signals.dateSelected);
  apply("appointmentCompleted", signals.appointmentCompleted);
  apply("budgetStated", signals.budgetStated);
  apply("paymentIntent", signals.paymentIntent);
  apply("nearTermIntent", signals.nearTermIntent);
  apply("priceReask", signals.priceReask);
  apply("spam", signals.spam);

  if ((signals.silenceDays || 0) >= SILENCE_DECAY_DAYS) {
    breakdown.silenceDecay = WEIGHTS.silenceDecay;
    score += WEIGHTS.silenceDecay;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, breakdown };
}

/** Merge event delta into existing breakdown without wiping prior positives. */
export function mergeLeadScoreBreakdown(
  existing: LeadScoreBreakdown | null | undefined,
  delta: LeadScoreBreakdown
): { score: number; breakdown: LeadScoreBreakdown } {
  const merged: LeadScoreBreakdown = { ...(existing || {}) };

  let hasPositive = false;
  for (const [key, value] of Object.entries(delta)) {
    if (value == null || !Number.isFinite(value)) continue;
    if (key === "spam") {
      merged.spam = value;
      continue;
    }
    if (key === "silenceDecay") {
      if (merged.silenceDecay == null) merged.silenceDecay = value;
      continue;
    }
    if (value > 0) hasPositive = true;
    const prev = merged[key];
    merged[key] = prev == null ? value : Math.max(prev, value);
  }
  // Fresh positive signals clear a prior spam hard-negative (one-shot kill switch).
  if (hasPositive && delta.spam == null) {
    delete merged.spam;
  }

  let score = 0;
  for (const value of Object.values(merged)) {
    if (typeof value === "number") score += value;
  }
  score = Math.max(0, Math.min(100, score));
  return { score, breakdown: merged };
}

export function leadTier(score: number): "cold" | "interested" | "qualified" | "ready" {
  if (score <= 20) return "cold";
  if (score <= 50) return "interested";
  if (score <= 75) return "qualified";
  return "ready";
}

export async function applyLeadScore(input: {
  tenantId: string;
  customerId: string;
  signals: LeadScoreSignals;
  applySilenceDecay?: boolean;
}): Promise<{ score: number; breakdown: LeadScoreBreakdown; tier: string } | null> {
  const { data: customer } = await supabase
    .from("crm_customers")
    .select("id, silence_decay_applied_at, lead_score, lead_score_breakdown")
    .eq("id", input.customerId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (!customer) return null;

  const signals = { ...input.signals };
  if (input.applySilenceDecay) {
    if (customer.silence_decay_applied_at) {
      delete signals.silenceDays;
    }
  }

  const { breakdown: delta } = computeLeadScore(signals);
  const existingBreakdown =
    customer.lead_score_breakdown && typeof customer.lead_score_breakdown === "object"
      ? (customer.lead_score_breakdown as LeadScoreBreakdown)
      : {};
  const { score, breakdown } = mergeLeadScoreBreakdown(existingBreakdown, delta);
  const now = new Date().toISOString();

  await supabase
    .from("crm_customers")
    .update({
      lead_score: score,
      lead_score_breakdown: breakdown,
      lead_score_version: LEAD_SCORE_VERSION,
      lead_score_updated_at: now,
      updated_at: now,
      ...(input.applySilenceDecay &&
      signals.silenceDays &&
      signals.silenceDays >= SILENCE_DECAY_DAYS &&
      !customer.silence_decay_applied_at
        ? { silence_decay_applied_at: now }
        : {}),
    })
    .eq("id", input.customerId)
    .eq("tenant_id", input.tenantId);

  const tier = leadTier(score);
  if (tier === "qualified" || tier === "ready") {
    await transitionPipelineStage({
      tenantId: input.tenantId,
      customerId: input.customerId,
      targetStage: "qualified",
      reason: `lead_score_${score}`,
      sourceEvent: "LEAD_SCORE_UPDATED",
    });
  }

  if (tier === "ready" && score >= 76) {
    await createOpsAlert({
      tenantId: input.tenantId,
      type: "system",
      severity: "high",
      message: `Yüksek öncelikli lead (skor ${score}). Satışa hazır sinyaller var.`,
      meta: {
        source: "lead_scoring",
        customer_id: input.customerId,
        score,
        breakdown,
      },
      dedupeKey: `high_intent_lead:${input.tenantId}:${input.customerId}`,
    }).catch(() => undefined);
  }

  return { score, breakdown, tier };
}
