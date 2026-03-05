import { NextRequest, NextResponse } from "next/server";
import { isAdminTakeoverReason } from "@/lib/human-takeover";
import { getSession, setSession } from "@/lib/redis";
import { normalizePhoneDigits } from "@/lib/phone";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";
import { logConversationMessage } from "@/services/conversationMessages.service";
import { logTenantEvent } from "@/services/eventLog.service";
import { createOpsAlert } from "@/services/opsAlert.service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    tenant_id?: string;
    customer_phone?: string;
    actor?: string;
    note?: string;
    notify_customer?: boolean;
    notify_text?: string;
  };

  const tenantId = (body.tenant_id || "").trim();
  const phoneDigits = normalizePhoneDigits(body.customer_phone || "");
  const actor = (body.actor || "admin").trim() || "admin";
  const note = (body.note || "").trim();
  const notifyCustomer = body.notify_customer === true;
  const notifyText =
    (body.notify_text || "").trim() ||
    "Canli destek gorusmesi tamamlandi. Bot asistan tekrar devrede.";

  if (!tenantId || !phoneDigits) {
    return NextResponse.json(
      { error: "tenant_id ve customer_phone zorunlu" },
      { status: 400 }
    );
  }

  const state = await getSession(tenantId, phoneDigits);
  if (!state) {
    return NextResponse.json(
      { error: "Aktif sohbet oturumu bulunamadi" },
      { status: 404 }
    );
  }
  if (state.step !== "PAUSED_FOR_HUMAN" || !isAdminTakeoverReason(state.pause_reason)) {
    return NextResponse.json(
      { error: "Sohbet canli destek modunda degil" },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  await setSession(tenantId, phoneDigits, {
    ...state,
    step: "RECOVERY_CHECK",
    pause_reason: null,
    window_status: "OPEN",
    updated_at: nowIso,
  });

  await logConversationMessage({
    tenantId,
    customerPhone: phoneDigits,
    direction: "system",
    messageText: note || "Konusma bot akisina geri alindi",
    messageType: "system",
    stage: "admin_takeover_resumed",
    metadata: {
      actor,
      notify_customer: notifyCustomer,
    },
  });

  if (notifyCustomer) {
    const sendResult = await sendWhatsAppMessageDetailed({
      to: phoneDigits,
      text: notifyText,
    });
    if (sendResult.ok) {
      await logConversationMessage({
        tenantId,
        customerPhone: phoneDigits,
        direction: "outbound",
        messageText: notifyText,
        messageType: "text",
        stage: "admin_takeover_resume_notify",
        metadata: {
          actor,
          source: sendResult.source || null,
        },
      });
    } else {
      await logConversationMessage({
        tenantId,
        customerPhone: phoneDigits,
        direction: "system",
        messageText: notifyText,
        messageType: "text",
        stage: "admin_takeover_resume_notify_failed",
        metadata: {
          actor,
          error_code: sendResult.errorCode || null,
          blocked_reason: sendResult.blockedReason || null,
        },
      });
    }
  }

  await createOpsAlert({
    tenantId,
    type: "system",
    severity: "low",
    customerPhone: phoneDigits,
    message: "Destek ekibi konuşmayı bot akışına geri aldı.",
    meta: {
      source: "admin_conversations_resume",
      visibility: "internal",
      actor,
      note: note || null,
    },
    dedupeKey: `admin_takeover_resume:${tenantId}:${phoneDigits}:${nowIso.slice(0, 16)}`,
  }).catch(() => undefined);

  await logTenantEvent({
    tenantId,
    eventType: "admin_takeover_resumed",
    actor,
    entityType: "conversation",
    entityId: phoneDigits,
    payload: {
      customer_phone_digits: phoneDigits,
      notify_customer: notifyCustomer,
      note: note || null,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    step: "RECOVERY_CHECK",
  });
}
