import { normalizePhoneDigits } from "@/lib/phone";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { supabase } from "@/lib/supabase";

export interface ConversationMessageInput {
  traceId?: string | null;
  tenantId?: string | null;
  customerPhone?: string | null;
  direction: "inbound" | "outbound" | "system";
  messageText?: string | null;
  messageType?: string | null;
  stage?: string | null;
  messageId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
}

let missingTableWarned = false;

function normalizeText(value: string | null | undefined, limit = 4000): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned.slice(0, limit);
}

export async function logConversationMessage(
  input: ConversationMessageInput
): Promise<void> {
  const phoneDigits = normalizePhoneDigits(input.customerPhone || "");
  if (!phoneDigits) return;

  const payload = {
    trace_id: input.traceId || null,
    tenant_id: input.tenantId || null,
    customer_phone_digits: phoneDigits,
    direction: input.direction,
    message_text: normalizeText(input.messageText),
    message_type: normalizeText(input.messageType, 80),
    stage: normalizeText(input.stage, 120),
    message_id: normalizeText(input.messageId, 120),
    metadata: input.metadata || {},
    created_at: input.createdAt || new Date().toISOString(),
  };

  const { error } = await supabase.from("conversation_messages").insert(payload);
  if (!error) return;

  const missingTable = extractMissingSchemaTable(error);
  if (missingTable === "conversation_messages") {
    if (!missingTableWarned) {
      missingTableWarned = true;
      console.warn(
        "[conversation-messages] tablo bulunamadi. Supabase migration 029 uygulanmali."
      );
    }
    return;
  }

  console.error("[conversation-messages] insert error", error.message);
}
