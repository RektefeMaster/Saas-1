import { NextRequest, NextResponse } from "next/server";
import { isAdminTakeoverReason } from "@/lib/human-takeover";
import { getSession, setSession } from "@/lib/redis";
import { normalizePhoneDigits } from "@/lib/phone";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";
import { logConversationMessage } from "@/services/conversationMessages.service";
import { logTenantEvent } from "@/services/eventLog.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import {
  ConversationConflictError,
  ensureConversation,
  getConversationByExternalUser,
  markOutboundFailed,
  markOutboundSent,
  recordOutboundQueued,
  resumeConversationToAi,
} from "@/services/conversation.service";

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

  // Postgres SoT first — Redis may be expired while HUMAN_ACTIVE remains.
  let conv = await getConversationByExternalUser(tenantId, phoneDigits);
  if (!conv) {
    conv = await ensureConversation({ tenantId, externalUserId: phoneDigits });
  }
  if (!conv?.id) {
    return NextResponse.json(
      { error: "Konuşma bulunamadı" },
      { status: 404 }
    );
  }

  const state = await getSession(tenantId, phoneDigits);
  const redisAdminPaused =
    state?.step === "PAUSED_FOR_HUMAN" &&
    isAdminTakeoverReason(state.pause_reason);
  const pgHuman = conv.automation_mode === "HUMAN_ACTIVE";

  if (!pgHuman && !redisAdminPaused) {
    return NextResponse.json(
      { error: "Sohbet canli destek modunda degil" },
      { status: 409 }
    );
  }

  try {
    conv = await resumeConversationToAi({
      actor: { kind: "admin", canAccessAllTenants: true },
      tenantId,
      conversationId: conv.id,
      expectedVersion: conv.version,
    });
  } catch (err) {
    if (err instanceof ConversationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Resume failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  if (state) {
    await setSession(tenantId, phoneDigits, {
      ...state,
      step: "RECOVERY_CHECK",
      pause_reason: null,
      window_status: "OPEN",
      updated_at: nowIso,
    }).catch((err) => console.warn("[admin/resume] redis mirror failed", err));
  }

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
      conversation_id: conv.id,
    },
  });

  if (notifyCustomer) {
    const queued = await recordOutboundQueued({
      tenantId,
      conversationId: conv.id,
      externalUserId: phoneDigits,
      text: notifyText,
      senderType: "SYSTEM",
      source: "admin",
    });
    const sendResult = await sendWhatsAppMessageDetailed({
      to: phoneDigits,
      text: notifyText,
    });
    if (queued && sendResult.ok) {
      await markOutboundSent({
        rowId: queued.id,
        tenantId,
        conversationId: conv.id,
        externalMessageId: sendResult.messageId || `local_${queued.id}`,
        preview: notifyText,
      });
    } else if (queued) {
      await markOutboundFailed({
        rowId: queued.id,
        tenantId,
        conversationId: conv.id,
        failureCode:
          sendResult.errorCode != null ? String(sendResult.errorCode) : null,
        failureReason: sendResult.errorMessage || "send_failed",
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
      conversation_id: conv.id,
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
      conversation_id: conv.id,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    conversation_id: conv.id,
    automation_mode: conv.automation_mode,
    step: "RECOVERY_CHECK",
  });
}
