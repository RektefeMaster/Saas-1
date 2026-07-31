import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import { getConversationById } from "@/services/conversation.service";
import {
  reportQualityFeedback,
  type QualityCategory,
} from "@/services/qualityFeedback.service";

const CATEGORIES = new Set<QualityCategory>([
  "wrong_price",
  "wrong_availability",
  "hallucination",
  "unsafe_health_claim",
  "wrong_policy",
  "tone_issue",
  "failed_handoff",
  "wrong_customer_context",
  "other",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const { id: rawId, conversationId } = await params;
    requireValidTenantId(rawId);
    const tenantId = rawId;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;

    const conversation = await getConversationById(conversationId, tenantId);
    if (!conversation) {
      return NextResponse.json({ error: "Konuşma bulunamadı" }, { status: 404 });
    }

    const body = (await request.json()) as {
      category?: string;
      comment?: string;
      message_id?: string;
    };
    if (!body.category || !CATEGORIES.has(body.category as QualityCategory)) {
      return NextResponse.json({ error: "Geçersiz kategori" }, { status: 400 });
    }

    const result = await reportQualityFeedback({
      tenantId,
      conversationId,
      messageId: body.message_id,
      reportedBy: auth.userId,
      category: body.category as QualityCategory,
      comment: body.comment,
    });

    if (!result.ok) {
      return NextResponse.json({ error: "Kayıt başarısız" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
