import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneDigits } from "@/lib/phone";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";
import { logTenantEvent } from "@/services/eventLog.service";
import {
  ensureConversation,
  getConversationByExternalUser,
  markOutboundFailed,
  markOutboundSent,
  recordOutboundQueued,
} from "@/services/conversation.service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    tenant_id?: string;
    customer_phone?: string;
    text?: string;
    actor?: string;
  };

  const tenantId = (body.tenant_id || "").trim();
  const phoneDigits = normalizePhoneDigits(body.customer_phone || "");
  const text = (body.text || "").trim();
  const actor = (body.actor || "admin").trim() || "admin";

  if (!tenantId || !phoneDigits || !text) {
    return NextResponse.json(
      { error: "tenant_id, customer_phone ve text zorunlu" },
      { status: 400 }
    );
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "text en fazla 1000 karakter olabilir" },
      { status: 400 }
    );
  }

  let conv = await getConversationByExternalUser(tenantId, phoneDigits);
  if (!conv) {
    conv = await ensureConversation({ tenantId, externalUserId: phoneDigits });
  }
  if (!conv?.id) {
    return NextResponse.json({ error: "Konuşma bulunamadı" }, { status: 404 });
  }

  // Postgres SoT — stale Redis pause must not authorize send while AI owns the thread.
  const pgAllowsSend =
    conv.automation_mode === "HUMAN_ACTIVE" ||
    conv.automation_mode === "AI_ASSIST";

  if (!pgAllowsSend) {
    return NextResponse.json(
      { error: "Bu sohbet admin/insan takeover modunda degil" },
      { status: 409 }
    );
  }

  const queued = await recordOutboundQueued({
    tenantId,
    conversationId: conv.id,
    externalUserId: phoneDigits,
    text,
    senderType: "HUMAN",
    source: "admin",
  });

  if (!queued) {
    return NextResponse.json(
      { error: "Mesaj kuyruğa yazılamadı" },
      { status: 500 }
    );
  }

  const sendResult = await sendWhatsAppMessageDetailed({
    to: phoneDigits,
    text,
  });

  if (!sendResult.ok) {
    await markOutboundFailed({
      rowId: queued.id,
      tenantId,
      conversationId: conv.id,
      failureCode:
        sendResult.errorCode != null ? String(sendResult.errorCode) : null,
      failureReason: sendResult.errorMessage || "send_failed",
    });
    return NextResponse.json(
      {
        error: sendResult.errorMessage || "WhatsApp gönderimi başarısız",
        details: sendResult,
        queued_id: queued.id,
      },
      { status: 502 }
    );
  }

  const externalMessageId =
    sendResult.messageId || `local_${queued.id}_${Date.now()}`;
  await markOutboundSent({
    rowId: queued.id,
    tenantId,
    conversationId: conv.id,
    externalMessageId,
    preview: text,
  });

  await logTenantEvent({
    tenantId,
    eventType: "admin_takeover_message_sent",
    actor,
    entityType: "conversation",
    entityId: phoneDigits,
    payload: {
      customer_phone_digits: phoneDigits,
      message_preview: text.slice(0, 180),
      conversation_id: conv.id,
      external_message_id: externalMessageId,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    conversation_id: conv.id,
    external_message_id: externalMessageId,
    sent: true,
  });
}
