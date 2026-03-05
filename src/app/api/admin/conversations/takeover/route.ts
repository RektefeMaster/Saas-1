import { NextRequest, NextResponse } from "next/server";
import type { ConversationState } from "@/lib/database.types";
import { buildAdminTakeoverReason } from "@/lib/human-takeover";
import { getSession, setSession } from "@/lib/redis";
import { normalizePhoneDigits } from "@/lib/phone";
import { supabase } from "@/lib/supabase";
import { logConversationMessage } from "@/services/conversationMessages.service";
import { logTenantEvent } from "@/services/eventLog.service";
import { createOpsAlert } from "@/services/opsAlert.service";

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
  const existing = await getSession(tenantId, phoneDigits);
  const reason = buildAdminTakeoverReason(actor);

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

  await setSession(tenantId, phoneDigits, nextState);

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
    },
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    step: nextState.step,
    pause_reason: nextState.pause_reason || null,
    updated_at: nextState.updated_at,
  });
}
