import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";

export interface BotAuditInput {
  traceId: string;
  tenantId?: string | null;
  customerPhone?: string | null;
  direction?: "inbound" | "outbound" | "system";
  stage: string;
  messageId?: string | null;
  policyReason?: string | null;
  fsmStateBefore?: string | null;
  fsmStateAfter?: string | null;
  toolName?: string | null;
  toolResult?: Record<string, unknown> | null;
  replyPreview?: string | null;
  latencyMs?: number | null;
  llmLatencyMs?: number | null;
  dbLatencyMs?: number | null;
  lockWaitMs?: number | null;
  queueLagMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: number | null;
  model?: string | null;
  modelPricingVersion?: string | null;
  errorCode?: string | null;
}

export interface BotDlqInput {
  traceId: string;
  tenantId?: string | null;
  customerPhone?: string | null;
  messageId?: string | null;
  payload?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

function hashPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export async function logBotMessageAudit(input: BotAuditInput): Promise<void> {
  const payload = {
    trace_id: input.traceId,
    tenant_id: input.tenantId || null,
    customer_phone_hash: hashPhone(input.customerPhone),
    direction: input.direction || "system",
    stage: input.stage,
    message_id: input.messageId || null,
    policy_reason: input.policyReason || null,
    fsm_state_before: input.fsmStateBefore || null,
    fsm_state_after: input.fsmStateAfter || null,
    tool_name: input.toolName || null,
    tool_result: input.toolResult || null,
    reply_preview: input.replyPreview || null,
    latency_ms: input.latencyMs || null,
    llm_latency_ms: input.llmLatencyMs || null,
    db_latency_ms: input.dbLatencyMs || null,
    lock_wait_ms: input.lockWaitMs || null,
    queue_lag_ms: input.queueLagMs || null,
    prompt_tokens: input.promptTokens || null,
    completion_tokens: input.completionTokens || null,
    total_tokens: input.totalTokens || null,
    cost_usd: input.costUsd || null,
    model: input.model || null,
    model_pricing_version: input.modelPricingVersion || null,
    error_code: input.errorCode || null,
  };

  const { error } = await supabase.from("bot_message_audit").insert(payload);
  if (error) {
    console.error("[bot-audit] insert error:", error.message);
  }
}

export async function logBotDlq(input: BotDlqInput): Promise<void> {
  const payload = {
    trace_id: input.traceId,
    tenant_id: input.tenantId || null,
    customer_phone_hash: hashPhone(input.customerPhone),
    message_id: input.messageId || null,
    payload: input.payload || null,
    error_code: input.errorCode || null,
    error_message: input.errorMessage || null,
  };
  const { error } = await supabase.from("bot_dlq_events").insert(payload);
  if (error) {
    console.error("[bot-audit] dlq insert error:", error.message);
  }
}
