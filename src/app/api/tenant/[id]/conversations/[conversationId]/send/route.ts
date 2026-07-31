import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "@/lib/id";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  getConversationById,
  markOutboundFailed,
  markOutboundSent,
  recordOutboundQueued,
} from "@/services/conversation.service";
import { getActiveMembership } from "@/services/tenantMembership.service";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";

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

    const body = (await request.json()) as { text?: string };
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text gerekli" }, { status: 400 });
    }

    const conversation = await getConversationById(conversationId, tenantId);
    if (!conversation) {
      return NextResponse.json({ error: "Konuşma bulunamadı" }, { status: 404 });
    }

    // Prevent staff+bot split-brain outbound while AI owns the thread.
    if (
      conversation.automation_mode === "AI_ACTIVE" ||
      conversation.automation_mode === "AUTOMATION_PAUSED"
    ) {
      return NextResponse.json(
        { error: "Mesaj göndermek için önce konuşmayı devralın" },
        { status: 409 }
      );
    }

    if (
      conversation.automation_mode === "HUMAN_ACTIVE" &&
      conversation.assigned_membership_id &&
      auth.actor !== "admin"
    ) {
      const membership = auth.userId
        ? await getActiveMembership(tenantId, auth.userId)
        : null;
      if (!membership || conversation.assigned_membership_id !== membership.id) {
        return NextResponse.json(
          { error: "Bu konuşma başka bir personelde" },
          { status: 409 }
        );
      }
    }

    const membership = auth.userId
      ? await getActiveMembership(tenantId, auth.userId)
      : null;
    const requestId = nanoid();
    const queued = await recordOutboundQueued({
      tenantId,
      conversationId,
      externalUserId: conversation.external_user_id,
      text,
      senderType: "HUMAN",
      source: "tenant_inbox",
      senderMembershipId: membership?.id,
      requestId,
    });

    if (!queued) {
      return NextResponse.json(
        { error: "Mesaj kuyruğa yazılamadı" },
        { status: 500 }
      );
    }

    const to = conversation.external_user_id.startsWith("+")
      ? conversation.external_user_id
      : `+${conversation.external_user_id}`;
    const sendResult = await sendWhatsAppMessageDetailed({ to, text });

    if (!sendResult.ok) {
      await markOutboundFailed({
        rowId: queued.id,
        tenantId,
        conversationId,
        failureCode: sendResult.errorCode != null ? String(sendResult.errorCode) : null,
        failureReason: sendResult.errorMessage || "send_failed",
      });
      return NextResponse.json(
        {
          error: sendResult.errorMessage || "Gönderim başarısız",
          queued_id: queued.id,
          delivery_status: "failed",
        },
        { status: 502 }
      );
    }

    const externalMessageId =
      sendResult.messageId || `local_${queued.id}_${Date.now()}`;
    await markOutboundSent({
      rowId: queued.id,
      tenantId,
      conversationId,
      externalMessageId,
      preview: text,
    });

    return NextResponse.json({
      ok: true,
      queued_id: queued.id,
      external_message_id: externalMessageId,
      delivery_status: "sent",
    });
  } catch (err) {
    if (err instanceof ConversationAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
