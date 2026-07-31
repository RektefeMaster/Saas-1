/**
 * Structured ops events for conversation pipeline. Never log message body / PII.
 */

export type ConversationObsEvent =
  | "webhook_received"
  | "message_deduplicated"
  | "conversation_created"
  | "conversation_updated"
  | "ai_processing_started"
  | "ai_processing_skipped"
  | "tool_called"
  | "tool_failed"
  | "guardrail_blocked"
  | "handoff_triggered"
  | "takeover_completed"
  | "resume_completed"
  | "outbound_queued"
  | "outbound_sent"
  | "outbound_failed"
  | "crm_event_applied"
  | "followup_scheduled"
  | "followup_cancelled";

export type ConversationObsFields = {
  request_id?: string | null;
  tenant_id?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  customer_id?: string | null;
  reason?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

export function emitConversationEvent(
  event: ConversationObsEvent,
  fields: ConversationObsFields = {}
): void {
  const payload: Record<string, unknown> = { event, at: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) payload[k] = v;
  }
  console.info("[conversation-obs]", JSON.stringify(payload));
}
