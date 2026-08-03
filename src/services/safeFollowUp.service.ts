/**
 * Safe follow-up engine: cancel on reply, respect window/opt-out/HUMAN_ACTIVE.
 */

import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { normalizeWhatsAppIdentity } from "@/lib/phone";
import { getConversationAutomationMode } from "@/services/conversation.service";
import { emitConversationEvent } from "@/services/conversationObservability.service";
import { sendWhatsAppTemplateMessageDetailed, sendWhatsAppMessageDetailed } from "@/lib/whatsapp";

const MIN_OUTBOUND_GAP_MS = 60 * 60 * 1000;

export async function scheduleFollowUp(input: {
  tenantId: string;
  customerId?: string | null;
  conversationId?: string | null;
  customerPhoneDigits: string;
  delayHours: number;
  trigger: string;
  templateName?: string | null;
}): Promise<{ ok: boolean; id?: string }> {
  const digits =
    normalizeWhatsAppIdentity(input.customerPhoneDigits) ||
    input.customerPhoneDigits.replace(/\D/g, "");
  if (!digits) return { ok: false };

  // Cancel prior scheduled jobs for same trigger+customer
  await supabase
    .from("followup_jobs")
    .update({
      status: "cancelled",
      cancel_reason: "rescheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("customer_phone_digits", digits)
    .eq("status", "scheduled")
    .contains("trigger_snapshot", { trigger: input.trigger });

  const scheduledFor = new Date(
    Date.now() + input.delayHours * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("followup_jobs")
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId || null,
      conversation_id: input.conversationId || null,
      customer_phone_digits: digits,
      status: "scheduled",
      scheduled_for: scheduledFor,
      template_name: input.templateName || null,
      trigger_snapshot: { trigger: input.trigger, at: new Date().toISOString() },
    })
    .select("id")
    .single();

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "followup_jobs") return { ok: false };
    console.error("[followup] schedule failed", error.message);
    return { ok: false };
  }

  emitConversationEvent("followup_scheduled", {
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    conversation_id: input.conversationId,
    reason: input.trigger,
  });
  return { ok: true, id: data.id };
}

export async function cancelFollowUpsForCustomer(
  tenantId: string,
  customerId: string | null,
  cancelReason: string,
  phoneDigits?: string | null
): Promise<void> {
  let query = supabase
    .from("followup_jobs")
    .update({
      status: "cancelled",
      cancel_reason: cancelReason,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled");

  if (customerId) query = query.eq("customer_id", customerId);
  else if (phoneDigits) {
    const digits = normalizeWhatsAppIdentity(phoneDigits) || phoneDigits.replace(/\D/g, "");
    query = query.eq("customer_phone_digits", digits);
  } else return;

  await query;
  emitConversationEvent("followup_cancelled", {
    tenant_id: tenantId,
    customer_id: customerId,
    reason: cancelReason,
  });
}

async function claimFollowUpJob(jobId: string): Promise<boolean> {
  const rpc = await supabase.rpc("claim_followup_job", { p_job_id: jobId });
  if (!rpc.error) return Boolean(rpc.data);

  // Fallback: CAS status scheduled → sending (needs migration 045 CHECK).
  const { data, error } = await supabase
    .from("followup_jobs")
    .update({
      status: "sending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (!error) return Boolean(data?.id);

  // Pre-045: claim via cancel_reason marker while still scheduled.
  const claimToken = `claiming:${Date.now()}`;
  const { data: claimed } = await supabase
    .from("followup_jobs")
    .update({
      cancel_reason: claimToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "scheduled")
    .is("cancel_reason", null)
    .select("id")
    .maybeSingle();
  return Boolean(claimed?.id);
}

export async function processDueFollowUps(limit = 50): Promise<number> {
  const now = new Date().toISOString();
  // Recover crash-stuck claims (sending older than 15 minutes).
  const stuckBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabase
    .from("followup_jobs")
    .update({
      status: "scheduled",
      cancel_reason: null,
      updated_at: now,
    })
    .eq("status", "sending")
    .lt("updated_at", stuckBefore);

  const { data: jobs, error } = await supabase
    .from("followup_jobs")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error || !jobs?.length) return 0;
  let sent = 0;

  for (const job of jobs) {
    const claimed = await claimFollowUpJob(job.id);
    if (!claimed) continue;

    const skipReason = await shouldSkipFollowUp({
      id: job.id,
      tenant_id: job.tenant_id,
      customer_id: job.customer_id,
      customer_phone_digits: job.customer_phone_digits,
      conversation_id: job.conversation_id,
      created_at: job.created_at,
    });
    if (skipReason) {
      await supabase
        .from("followup_jobs")
        .update({
          status: "skipped",
          cancel_reason: skipReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      continue;
    }

    const to = `+${job.customer_phone_digits}`;
    let ok = false;
    if (job.template_name) {
      const result = await sendWhatsAppTemplateMessageDetailed({
        to,
        templateName: job.template_name,
        tenantId: job.tenant_id,
      });
      ok = result.ok;
    } else {
      // Free-form only inside service window
      const { data: conv } = await supabase
        .from("conversations")
        .select("service_window_expiry")
        .eq("tenant_id", job.tenant_id)
        .eq("external_user_id", job.customer_phone_digits)
        .maybeSingle();
      const windowOk =
        conv?.service_window_expiry &&
        new Date(conv.service_window_expiry).getTime() > Date.now();
      if (!windowOk) {
        await supabase
          .from("followup_jobs")
          .update({
            status: "skipped",
            cancel_reason: "outside_service_window_no_template",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        continue;
      }
      const result = await sendWhatsAppMessageDetailed({
        to,
        text: "Merhaba, önceki görüşmemize devam etmek ister misiniz?",
        tenantId: job.tenant_id,
      });
      ok = result.ok;
    }

    await supabase
      .from("followup_jobs")
      .update({
        status: ok ? "sent" : "failed",
        cancel_reason: ok ? null : "send_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    if (ok) sent += 1;
  }

  return sent;
}

async function shouldSkipFollowUp(job: {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_phone_digits: string;
  conversation_id: string | null;
  created_at: string;
}): Promise<string | null> {
  const mode = await getConversationAutomationMode(
    job.tenant_id,
    job.customer_phone_digits
  );
  if (
    mode === "HUMAN_ACTIVE" ||
    mode === "AI_ASSIST" ||
    mode === "AUTOMATION_PAUSED"
  ) {
    return "automation_not_ai_active";
  }

  if (job.customer_id) {
    const { data: customer } = await supabase
      .from("crm_customers")
      .select("marketing_opt_out, pipeline_stage, last_contact_at")
      .eq("id", job.customer_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    if (customer?.marketing_opt_out) return "opt_out";
    if (customer?.pipeline_stage === "won" || customer?.pipeline_stage === "appointment_booked") {
      return "stage_advanced";
    }
    if (
      customer?.last_contact_at &&
      new Date(customer.last_contact_at).getTime() >
        new Date(job.created_at).getTime()
    ) {
      return "customer_replied";
    }
  }

  const { data: lastOutbound } = await supabase
    .from("conversation_messages")
    .select("created_at")
    .eq("tenant_id", job.tenant_id)
    .eq("customer_phone_digits", job.customer_phone_digits)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    lastOutbound?.created_at &&
    Date.now() - new Date(lastOutbound.created_at).getTime() < MIN_OUTBOUND_GAP_MS
  ) {
    return "min_outbound_gap";
  }

  // Inbound after schedule → cancel
  const { data: lastInbound } = await supabase
    .from("conversation_messages")
    .select("created_at")
    .eq("tenant_id", job.tenant_id)
    .eq("customer_phone_digits", job.customer_phone_digits)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    lastInbound?.created_at &&
    new Date(lastInbound.created_at).getTime() > new Date(job.created_at).getTime()
  ) {
    return "customer_replied";
  }

  return null;
}
