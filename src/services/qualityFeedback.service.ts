import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export type QualityCategory =
  | "wrong_price"
  | "wrong_availability"
  | "hallucination"
  | "unsafe_health_claim"
  | "wrong_policy"
  | "tone_issue"
  | "failed_handoff"
  | "wrong_customer_context"
  | "other";

export async function reportQualityFeedback(input: {
  tenantId: string;
  conversationId?: string | null;
  messageId?: string | null;
  reportedBy?: string | null;
  category: QualityCategory;
  comment?: string | null;
}): Promise<{ ok: boolean; id?: string }> {
  const { data, error } = await supabase
    .from("conversation_quality_feedback")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId || null,
      message_id: input.messageId || null,
      reported_by: input.reportedBy || null,
      category: input.category,
      comment: input.comment || null,
    })
    .select("id")
    .single();

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "conversation_quality_feedback") return { ok: false };
    console.error("[quality] insert failed", error.message);
    return { ok: false };
  }
  return { ok: true, id: String(data.id) };
}

export async function getQualitySummary(
  tenantId: string,
  days = 30
): Promise<Record<string, number>> {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("conversation_quality_feedback")
    .select("category")
    .eq("tenant_id", tenantId)
    .gte("created_at", from);

  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.category] = (counts[row.category] || 0) + 1;
  }
  return counts;
}
