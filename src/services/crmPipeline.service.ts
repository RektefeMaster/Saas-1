/**
 * CRM pipeline state machine — no direct stage writes outside this module.
 */

import { supabase } from "@/lib/supabase";
import { emitConversationEvent } from "@/services/conversationObservability.service";

export type PipelineStage =
  | "new_lead"
  | "contacted"
  | "need_identified"
  | "qualified"
  | "appointment_booked"
  | "offer_sent"
  | "follow_up"
  | "won"
  | "lost";

/** Allowed forward/side transitions. Backward only via explicit keys. */
const ALLOWED: Record<PipelineStage, PipelineStage[]> = {
  new_lead: ["contacted", "need_identified", "qualified", "lost"],
  contacted: ["need_identified", "qualified", "appointment_booked", "offer_sent", "lost"],
  need_identified: ["qualified", "appointment_booked", "offer_sent", "lost"],
  qualified: ["appointment_booked", "offer_sent", "follow_up", "lost"],
  appointment_booked: ["follow_up", "won", "lost"],
  offer_sent: ["follow_up", "appointment_booked", "won", "lost"],
  follow_up: ["appointment_booked", "offer_sent", "won", "lost"],
  won: [],
  lost: ["new_lead", "contacted"],
};

export function canTransitionPipeline(
  from: PipelineStage,
  to: PipelineStage
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export async function transitionPipelineStage(input: {
  tenantId: string;
  customerId: string;
  targetStage: PipelineStage;
  reason?: string;
  sourceEvent?: string;
}): Promise<{ ok: boolean; from?: PipelineStage; to?: PipelineStage; skipped?: boolean }> {
  const { data: customer, error } = await supabase
    .from("crm_customers")
    .select("id, pipeline_stage")
    .eq("id", input.customerId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (error || !customer) {
    return { ok: false };
  }

  const from = (customer.pipeline_stage || "new_lead") as PipelineStage;
  const to = input.targetStage;
  if (from === to) return { ok: true, from, to, skipped: true };

  if (!canTransitionPipeline(from, to)) {
    console.info("[crm-pipeline] transition blocked", { from, to, reason: input.reason });
    return { ok: false, from, to, skipped: true };
  }

  const { error: updateError } = await supabase
    .from("crm_customers")
    .update({
      pipeline_stage: to,
      updated_at: new Date().toISOString(),
      ...(to === "lost" && input.reason ? { lost_reason: input.reason } : {}),
    })
    .eq("id", input.customerId)
    .eq("tenant_id", input.tenantId);

  if (updateError) {
    console.error("[crm-pipeline] update failed", updateError.message);
    return { ok: false, from, to };
  }

  await supabase.from("crm_pipeline_transitions").insert({
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    from_stage: from,
    to_stage: to,
    reason: input.reason || null,
    source_event: input.sourceEvent || null,
  });

  emitConversationEvent("crm_event_applied", {
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    reason: `pipeline:${from}->${to}`,
  });

  return { ok: true, from, to };
}
