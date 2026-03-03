import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";

function hashPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

export async function createMessageProcessingJob(input: {
  traceId: string;
  provider: string;
  messageId: string;
  tenantId?: string | null;
  customerPhone?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from("message_processing_jobs").insert({
    trace_id: input.traceId,
    provider: input.provider,
    message_id: input.messageId,
    tenant_id: input.tenantId || null,
    customer_phone_hash: hashPhone(input.customerPhone),
    status: "queued",
    payload: input.payload || null,
  });
  if (error) {
    console.error("[message-jobs] create error:", error.message);
  }
}

export async function updateMessageProcessingJob(input: {
  traceId: string;
  status: "processing" | "completed" | "failed" | "dlq";
  attemptCount?: number;
  errorCode?: string | null;
}): Promise<void> {
  const payload: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.attemptCount != null) payload.attempt_count = input.attemptCount;
  if (input.errorCode != null) payload.error_code = input.errorCode;

  const { error } = await supabase
    .from("message_processing_jobs")
    .update(payload)
    .eq("trace_id", input.traceId);
  if (error) {
    console.error("[message-jobs] update error:", error.message);
  }
}
