import { NextRequest, NextResponse } from "next/server";
import type { ConversationState } from "@/lib/database.types";
import { buildAdminTakeoverReason } from "@/lib/human-takeover";
import { getSession, setSession } from "@/lib/redis";
import { normalizePhoneDigits } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { logConversationMessage } from "@/services/conversationMessages.service";
import { logTenantEvent } from "@/services/eventLog.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import {
  applyHandoffToConversation,
  ensureConversation,
} from "@/services/conversation.service";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    tenant_id?: string;
    customer_phone?: string;
    actor?: string;
    note?: string;
  };

  const tenantId = (body.tenant_id || "").trim();
  const phoneDigits = normalizePhoneDigits(body.customer_phone || "");
  const actor = (body.actor || "admin").trim() || "admin";
  const note = (body.note || "").trim();

  if (!tenantId || !phoneDigits) {
    return NextResponse.json(
      { error: "tenant_id ve customer_phone zorunlu" },
      { status: 400 }
    );
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError || !tenant) {
    return NextResponse.json({ error: "Tenant bulunamadi" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const reason = buildAdminTakeoverReason(actor);

  // Postgres first (SoT). Redis is FSM mirror only.
  const conv = await ensureConversation({
    tenantId,
    externalUserId: phoneDigits,
  });
  if (!conv?.id) {
    return NextResponse.json(
      { error: "Konuşma satırı oluşturulamadı (migration 038?)" },
      { status: 500 }
    );
  }

  const handed = await applyHandoffToConversation({
    tenantId,
    conversationId: conv.id,
    reason,
    automationMode: "HUMAN_ACTIVE",
    summarySnapshot: {
      version: 1,
      generatedAt: nowIso,
      plainSummary: note || "Admin takeover",
      recommendedAction: "Admin canlı destekte",
      handoffSignals: [{ type: "ADMIN_TAKEOVER", severity: "high", evidence: [actor] }],
    },
    priority: "high",
  });

  if (!handed || handed.automation_mode !== "HUMAN_ACTIVE") {
    return NextResponse.json(
      { error: "Postgres takeover başarısız" },
      { status: 500 }
    );
  }

  const existing = await getSession(tenantId, phoneDigits);
  const nextState: ConversationState = {
    ...(existing || {
      tenant_id: tenantId,
      customer_phone: phoneDigits,
      flow_type: "appointment",
      extracted: {},
      step: "PAUSED_FOR_HUMAN",
      updated_at: nowIso,
    }),
    tenant_id: tenantId,
    customer_phone: phoneDigits,
    step: "PAUSED_FOR_HUMAN",
    pause_reason: reason,
    window_status: "OPEN",
    timezone: existing?.timezone || "Europe/Istanbul",
    updated_at: nowIso,
  };

  await setSession(tenantId, phoneDigits, nextState).catch((err) =>
    console.warn("[admin/takeover] redis mirror failed", err)
  );

  await logConversationMessage({
    tenantId,
    customerPhone: phoneDigits,
    direction: "system",
    messageText: note || "Destek ekibi konuşmayı devraldı",
    messageType: "system",
    stage: "admin_takeover_started",
    metadata: {
      actor,
      pause_reason: reason,
      tenant_name: tenant.name || null,
      conversation_id: conv.id,
    },
  });

  await createOpsAlert({
    tenantId,
    type: "system",
    severity: "high",
    customerPhone: phoneDigits,
    message: "Destek ekibi bu konuşmayı manuel olarak devraldı.",
    meta: {
      source: "admin_conversations_takeover",
      visibility: "internal",
      actor,
      note: note || null,
      conversation_id: conv.id,
    },
    dedupeKey: `admin_takeover:${tenantId}:${phoneDigits}:${nowIso.slice(0, 16)}`,
  }).catch(() => undefined);

  await logTenantEvent({
    tenantId,
    eventType: "admin_takeover_started",
    actor,
    entityType: "conversation",
    entityId: phoneDigits,
    payload: {
      customer_phone_digits: phoneDigits,
      note: note || null,
      pause_reason: reason,
      conversation_id: conv.id,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    conversation_id: conv.id,
    automation_mode: handed.automation_mode,
    step: nextState.step,
    pause_reason: nextState.pause_reason || null,
    updated_at: nextState.updated_at,
  });
}
