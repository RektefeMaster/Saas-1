import { NextRequest, NextResponse } from "next/server";
import { isAdminTakeoverReason } from "@/lib/human-takeover";
import { getSession } from "@/lib/redis";
import { normalizePhoneDigits } from "@/lib/phone";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";
import { logConversationMessage } from "@/services/conversationMessages.service";
import { logTenantEvent } from "@/services/eventLog.service";

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

  const state = await getSession(tenantId, phoneDigits);
  if (!state || state.step !== "PAUSED_FOR_HUMAN" || !isAdminTakeoverReason(state.pause_reason)) {
    return NextResponse.json(
      { error: "Bu sohbet admin takeover modunda degil" },
      { status: 409 }
    );
  }

  const sendResult = await sendWhatsAppMessageDetailed({
    to: phoneDigits,
    text,
  });

  if (!sendResult.ok) {
    await logConversationMessage({
      tenantId,
      customerPhone: phoneDigits,
      direction: "system",
      messageText: text,
      messageType: "text",
      stage: "admin_takeover_manual_send_failed",
      metadata: {
        actor,
        error_code: sendResult.errorCode || null,
        blocked_reason: sendResult.blockedReason || null,
        source: sendResult.source || null,
      },
    });

    return NextResponse.json(
      {
        error: sendResult.errorMessage || "WhatsApp gonderimi basarisiz",
        details: sendResult,
      },
      { status: 502 }
    );
  }

  await logConversationMessage({
    tenantId,
    customerPhone: phoneDigits,
    direction: "outbound",
    messageText: text,
    messageType: "text",
    stage: "admin_takeover_manual_send",
    metadata: {
      actor,
      source: sendResult.source || null,
    },
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
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    sent: true,
  });
}
