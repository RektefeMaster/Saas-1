/**
 * Conversation domain service — shared by Admin and Tenant APIs.
 * Ownership (automation_mode) truth lives in Postgres, not Redis.
 */

import { supabase } from "@/lib/supabase";
import { normalizeWhatsAppIdentity } from "@/lib/phone";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { emitConversationEvent } from "@/services/conversationObservability.service";
import type {
  AutomationMode,
  ConversationActor,
  ConversationPriority,
  ConversationRow,
  ConversationStatus,
  DeliveryStatus,
  HandoffSummarySnapshot,
  MessageDirection,
  MessageSource,
  SenderType,
} from "@/types/conversation.types";
import { DELIVERY_STATUS_RANK } from "@/types/conversation.types";

const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export class ConversationAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "ConversationAccessError";
    this.status = status;
  }
}

export class ConversationConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConversationConflictError";
  }
}

function previewText(text: string | null | undefined, limit = 160): string | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, limit);
}

function assertActorCanAccessTenant(actor: ConversationActor, tenantId: string): void {
  if (actor.canAccessAllTenants || actor.kind === "admin") return;
  if (actor.tenantId && actor.tenantId === tenantId) return;
  throw new ConversationAccessError("Tenant erişimi yok", 403);
}

/**
 * Touch conversation after a *new* inbound was accepted.
 * Must NOT run on duplicate webhook retries — that would inflate unread_count.
 */
export async function touchConversationForInbound(input: {
  conversationId: string;
  tenantId: string;
  customerId?: string | null;
  messagePreview?: string | null;
  messageId?: string | null;
  requestId?: string | null;
}): Promise<ConversationRow | null> {
  const now = new Date();
  const serviceWindowExpiry = new Date(
    now.getTime() + WHATSAPP_SERVICE_WINDOW_MS
  ).toISOString();

  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (!existing?.id) return null;

  const reopen =
    existing.conversation_status === "RESOLVED" ||
    existing.conversation_status === "CLOSED";

  // Prefer atomic unread++ (migration 045); fall back to RMW.
  const rpc = await supabase.rpc("increment_conversation_unread", {
    p_conversation_id: existing.id,
    p_tenant_id: input.tenantId,
  });
  const unreadFromRpc =
    !rpc.error && typeof rpc.data === "number" ? rpc.data : null;

  const { data: updated, error } = await supabase
    .from("conversations")
    .update({
      last_message_at: now.toISOString(),
      last_inbound_message_at: now.toISOString(),
      last_customer_message_at: now.toISOString(),
      last_message_preview: previewText(input.messagePreview),
      last_message_direction: "inbound",
      last_message_id: input.messageId || existing.last_message_id,
      service_window_expiry: serviceWindowExpiry,
      ...(unreadFromRpc == null
        ? { unread_count: (existing.unread_count || 0) + 1 }
        : {}),
      conversation_status: reopen ? "OPEN" : existing.conversation_status,
      closed_at: reopen ? null : existing.closed_at,
      customer_id: input.customerId || existing.customer_id,
      updated_at: now.toISOString(),
    })
    .eq("id", existing.id)
    .eq("tenant_id", input.tenantId)
    .select("*")
    .single();

  if (error) {
    console.error("[conversation] touch inbound update", error.message);
    return existing as ConversationRow;
  }

  emitConversationEvent("conversation_updated", {
    tenant_id: input.tenantId,
    conversation_id: updated.id,
    request_id: input.requestId,
    message_id: input.messageId,
    customer_id: updated.customer_id,
    reason: reopen ? "reopen_on_inbound" : "inbound",
  });
  return updated as ConversationRow;
}

/** @deprecated Prefer ensureConversation + insertInbound + touchConversationForInbound */
export async function upsertConversationForInbound(input: {
  tenantId: string;
  channel?: "whatsapp";
  externalUserId: string;
  customerId?: string | null;
  messagePreview?: string | null;
  messageId?: string | null;
  requestId?: string | null;
}): Promise<ConversationRow | null> {
  const ensured = await ensureConversation({
    tenantId: input.tenantId,
    externalUserId: input.externalUserId,
    channel: input.channel,
  });
  if (!ensured) return null;
  return touchConversationForInbound({
    conversationId: ensured.id,
    tenantId: input.tenantId,
    customerId: input.customerId,
    messagePreview: input.messagePreview,
    messageId: input.messageId,
    requestId: input.requestId,
  });
}

export async function getConversationById(
  conversationId: string,
  tenantId: string
): Promise<ConversationRow | null> {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as ConversationRow) || null;
}

/** Ensure conversation row exists without treating the call as a customer inbound. */
export async function ensureConversation(input: {
  tenantId: string;
  externalUserId: string;
  channel?: "whatsapp";
}): Promise<ConversationRow | null> {
  const existing = await getConversationByExternalUser(
    input.tenantId,
    input.externalUserId
  );
  if (existing) return existing;

  const identity =
    normalizeWhatsAppIdentity(input.externalUserId) ||
    input.externalUserId.replace(/\D/g, "");
  if (!identity) return null;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      tenant_id: input.tenantId,
      channel: input.channel || "whatsapp",
      external_user_id: identity,
      automation_mode: "AI_ACTIVE",
      conversation_status: "OPEN",
      unread_count: 0,
      priority: "normal",
      version: 1,
    })
    .select("*")
    .single();

  if (error) {
    return getConversationByExternalUser(input.tenantId, identity);
  }
  return data as ConversationRow;
}

export async function getConversationByExternalUser(
  tenantId: string,
  externalUserId: string
): Promise<ConversationRow | null> {
  const identity =
    normalizeWhatsAppIdentity(externalUserId) || externalUserId.replace(/\D/g, "");
  if (!identity) return null;
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel", "whatsapp")
    .eq("external_user_id", identity)
    .maybeSingle();
  return (data as ConversationRow) || null;
}

export async function getConversationAutomationMode(
  tenantId: string,
  externalUserId: string
): Promise<AutomationMode | null> {
  const row = await getConversationByExternalUser(tenantId, externalUserId);
  return row?.automation_mode || null;
}

/**
 * True when the full AI agent must not run.
 * AUTOMATION_PAUSED is intentionally NOT skipped here: processor handles
 * canned "waiting for human" / "bot devam" / 2h auto-resume. Skipping it
 * ghosted customers after soft handoff.
 */
export function shouldSkipAiProcessing(mode: AutomationMode | null | undefined): boolean {
  if (!mode) return false;
  return mode === "HUMAN_ACTIVE" || mode === "AI_ASSIST";
}

/** Soft bot pause — AI limited to resume/ack paths inside processMessage. */
export function isAutomationSoftPaused(mode: AutomationMode | null | undefined): boolean {
  return mode === "AUTOMATION_PAUSED";
}

export async function listConversations(input: {
  actor: ConversationActor;
  tenantId: string;
  limit?: number;
  status?: ConversationStatus | null;
}): Promise<ConversationRow[]> {
  assertActorCanAccessTenant(input.actor, input.tenantId);
  const limit = Math.min(Math.max(input.limit || 50, 1), 200);

  let query = supabase
    .from("conversations")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (input.status) query = query.eq("conversation_status", input.status);

  const { data, error } = await query;
  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "conversations") return [];
    throw new Error(error.message);
  }
  return (data || []) as ConversationRow[];
}

export async function markConversationUnreadCleared(
  conversationId: string,
  tenantId: string
): Promise<void> {
  await supabase
    .from("conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("tenant_id", tenantId);
}

export async function setConversationStatus(input: {
  actor: ConversationActor;
  tenantId: string;
  conversationId: string;
  status: ConversationStatus;
}): Promise<ConversationRow> {
  assertActorCanAccessTenant(input.actor, input.tenantId);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    conversation_status: input.status,
    updated_at: now,
  };
  if (input.status === "CLOSED" || input.status === "RESOLVED") {
    patch.closed_at = now;
  } else {
    patch.closed_at = null;
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new ConversationAccessError("Konuşma bulunamadı", 404);
  return data as ConversationRow;
}

/** Atomic takeover with optimistic version + membership guard. */
export async function takeoverConversation(input: {
  actor: ConversationActor;
  tenantId: string;
  conversationId: string;
  membershipId?: string | null;
  expectedVersion: number;
  handoffReason?: string | null;
  summarySnapshot?: HandoffSummarySnapshot | null;
  priority?: ConversationPriority;
}): Promise<ConversationRow> {
  assertActorCanAccessTenant(input.actor, input.tenantId);
  const isAdmin = input.actor.kind === "admin" || input.actor.canAccessAllTenants;
  if (!input.membershipId && !isAdmin) {
    throw new ConversationAccessError("membership gerekli", 400);
  }

  const now = new Date().toISOString();
  const membershipId = input.membershipId || null;
  const patch: Record<string, unknown> = {
    assigned_membership_id: membershipId,
    automation_mode: "HUMAN_ACTIVE",
    assigned_at: now,
    human_takeover_at: now,
    automation_mode_updated_at: now,
    version: input.expectedVersion + 1,
    handoff_reason: input.handoffReason || null,
    summary_snapshot: input.summarySnapshot || {},
    conversation_status: "OPEN",
    updated_at: now,
  };
  if (input.priority) patch.priority = input.priority;

  let query = supabase
    .from("conversations")
    .update(patch)
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .eq("version", input.expectedVersion);

  // Staff: version AND (unassigned OR not human OR same membership).
  // Admin may force-take even when another membership owns it.
  if (!isAdmin && membershipId) {
    query = query.or(
      `assigned_membership_id.is.null,automation_mode.neq.HUMAN_ACTIVE,assigned_membership_id.eq.${membershipId}`
    );
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new ConversationConflictError(
      "Konuşma başka bir personelde veya sürüm değişti"
    );
  }

  emitConversationEvent("takeover_completed", {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    reason: input.handoffReason,
  });
  return data as ConversationRow;
}

export async function resumeConversationToAi(input: {
  actor: ConversationActor;
  tenantId: string;
  conversationId: string;
  expectedVersion: number;
}): Promise<ConversationRow> {
  assertActorCanAccessTenant(input.actor, input.tenantId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("conversations")
    .update({
      automation_mode: "AI_ACTIVE",
      assigned_membership_id: null,
      assigned_at: null,
      human_takeover_at: null,
      automation_mode_updated_at: now,
      version: input.expectedVersion + 1,
      handoff_reason: null,
      updated_at: now,
    })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .eq("version", input.expectedVersion)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new ConversationConflictError("Resume çakışması — sayfayı yenileyin");
  }

  emitConversationEvent("resume_completed", {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
  });
  return data as ConversationRow;
}

export async function setAutomationMode(input: {
  actor: ConversationActor;
  tenantId: string;
  conversationId: string;
  mode: AutomationMode;
  expectedVersion: number;
  membershipId?: string | null;
}): Promise<ConversationRow> {
  assertActorCanAccessTenant(input.actor, input.tenantId);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    automation_mode: input.mode,
    automation_mode_updated_at: now,
    version: input.expectedVersion + 1,
    updated_at: now,
  };
  if (input.mode === "AI_ASSIST" && input.membershipId) {
    patch.assigned_membership_id = input.membershipId;
    patch.assigned_at = now;
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .eq("version", input.expectedVersion)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new ConversationConflictError("Mod güncellenemedi");
  return data as ConversationRow;
}

export async function applyHandoffToConversation(input: {
  tenantId: string;
  conversationId: string;
  reason: string;
  summarySnapshot?: HandoffSummarySnapshot | null;
  priority?: ConversationPriority;
  /** Default AUTOMATION_PAUSED; admin/staff live takeover may pass HUMAN_ACTIVE */
  automationMode?: AutomationMode;
}): Promise<ConversationRow | null> {
  const now = new Date().toISOString();
  const mode = input.automationMode || "AUTOMATION_PAUSED";

  const existing = await getConversationById(input.conversationId, input.tenantId);
  if (!existing) return null;

  // Do not downgrade an active human takeover with a soft bot pause.
  if (
    existing.automation_mode === "HUMAN_ACTIVE" &&
    mode === "AUTOMATION_PAUSED"
  ) {
    return existing;
  }

  const patch: Record<string, unknown> = {
    automation_mode: mode,
    automation_mode_updated_at: now,
    handoff_reason: input.reason,
    summary_snapshot: input.summarySnapshot || {},
    priority: input.priority || "high",
    // Live human takeover stays OPEN; bot soft-pause waits in PENDING.
    conversation_status: mode === "HUMAN_ACTIVE" ? "OPEN" : "PENDING",
    version: (existing.version || 1) + 1,
    updated_at: now,
  };
  if (mode === "HUMAN_ACTIVE") {
    patch.human_takeover_at = now;
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .eq("version", existing.version)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[conversation] handoff update", error.message);
    return null;
  }
  if (!data) {
    // Version conflict — do NOT pretend handoff succeeded (avoids Redis/PG split-brain).
    emitConversationEvent("handoff_triggered", {
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      reason: `${input.reason}:version_conflict`,
    });
    return null;
  }

  emitConversationEvent("handoff_triggered", {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    reason: input.reason,
  });
  return data as ConversationRow;
}

export async function recordOutboundQueued(input: {
  tenantId: string;
  conversationId: string;
  externalUserId: string;
  text: string;
  senderType: SenderType;
  source: MessageSource;
  senderMembershipId?: string | null;
  requestId?: string | null;
}): Promise<{ id: string } | null> {
  const phoneDigits =
    normalizeWhatsAppIdentity(input.externalUserId) ||
    input.externalUserId.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      customer_phone_digits: phoneDigits,
      normalized_phone_digits: phoneDigits,
      direction: "outbound",
      message_text: previewText(input.text, 4000),
      message_type: "text",
      provider: "whatsapp",
      delivery_status: "queued",
      status_updated_at: new Date().toISOString(),
      processing_status: "pending",
      sender_type: input.senderType,
      sender_membership_id: input.senderMembershipId || null,
      source: input.source,
      request_id: input.requestId || null,
      metadata: {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[conversation] outbound queued insert", error.message);
    return null;
  }

  emitConversationEvent("outbound_queued", {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    message_id: String(data.id),
    request_id: input.requestId,
  });
  return { id: String(data.id) };
}

export async function markOutboundSent(input: {
  rowId: string;
  tenantId: string;
  conversationId: string;
  externalMessageId: string;
  preview?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("conversation_messages")
    .select("delivery_status")
    .eq("id", input.rowId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  const current = (existing?.delivery_status || null) as DeliveryStatus | null;
  const currentRank =
    current && current !== "failed"
      ? DELIVERY_STATUS_RANK[current as Exclude<DeliveryStatus, "failed">] || 0
      : 0;
  const sentRank = DELIVERY_STATUS_RANK.sent;
  // Never downgrade delivered/read back to sent (webhook race / retry).
  const deliveryPatch =
    currentRank > sentRank
      ? {
          external_message_id: input.externalMessageId,
          message_id: input.externalMessageId,
          processed_at: now,
          processing_status: "processed" as const,
        }
      : {
          external_message_id: input.externalMessageId,
          message_id: input.externalMessageId,
          delivery_status: "sent" as const,
          status_updated_at: now,
          processed_at: now,
          processing_status: "processed" as const,
        };

  await supabase
    .from("conversation_messages")
    .update(deliveryPatch)
    .eq("id", input.rowId)
    .eq("tenant_id", input.tenantId);

  await supabase
    .from("conversations")
    .update({
      last_message_at: now,
      last_outbound_message_at: now,
      last_message_preview: previewText(input.preview),
      last_message_direction: "outbound",
      last_message_id: input.externalMessageId,
      unread_count: 0,
      updated_at: now,
    })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId);

  emitConversationEvent("outbound_sent", {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    message_id: input.externalMessageId,
  });
}

/** Link CRM customer to conversation without inbound side-effects. */
export async function linkConversationCustomer(input: {
  tenantId: string;
  conversationId: string;
  customerId: string;
}): Promise<void> {
  await supabase
    .from("conversations")
    .update({
      customer_id: input.customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId)
    .is("customer_id", null);
}

export async function markOutboundFailed(input: {
  rowId: string;
  tenantId: string;
  conversationId: string;
  failureCode?: string | null;
  failureReason?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("conversation_messages")
    .update({
      delivery_status: "failed",
      status_updated_at: now,
      failed_at: now,
      failure_code: input.failureCode || null,
      failure_reason: input.failureReason || null,
      processing_status: "failed",
    })
    .eq("id", input.rowId)
    .eq("tenant_id", input.tenantId);

  emitConversationEvent("outbound_failed", {
    tenant_id: input.tenantId,
    conversation_id: input.conversationId,
    message_id: input.rowId,
    reason: input.failureReason,
  });
}

/** Idempotent inbound insert. `duplicate` only when unique constraint hit. */
export async function insertInboundMessageIdempotent(input: {
  tenantId: string;
  conversationId: string;
  externalUserId: string;
  externalMessageId: string;
  text?: string | null;
  messageType?: string | null;
  requestId?: string | null;
  eventId?: string | null;
  rawPayload?: Record<string, unknown> | null;
}): Promise<{ inserted: boolean; duplicate: boolean; id?: string; error?: string }> {
  const phoneDigits =
    normalizeWhatsAppIdentity(input.externalUserId) ||
    input.externalUserId.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId,
      customer_phone_digits: phoneDigits,
      normalized_phone_digits: phoneDigits,
      direction: "inbound" satisfies MessageDirection,
      message_text: previewText(input.text, 4000),
      message_type: input.messageType || "text",
      provider: "whatsapp",
      external_message_id: input.externalMessageId,
      message_id: input.externalMessageId,
      event_id: input.eventId || null,
      delivery_status: "delivered",
      status_updated_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      processing_status: "processed",
      source: "webhook",
      request_id: input.requestId || null,
      raw_payload: input.rawPayload || {},
      metadata: {},
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      emitConversationEvent("message_deduplicated", {
        tenant_id: input.tenantId,
        conversation_id: input.conversationId,
        message_id: input.externalMessageId,
        request_id: input.requestId,
      });
      return { inserted: false, duplicate: true };
    }
    console.error("[conversation] inbound insert", error.message);
    // Schema/network errors must NOT look like dedupe — caller should continue safely.
    return { inserted: false, duplicate: false, error: error.message };
  }
  return { inserted: true, duplicate: false, id: String(data.id) };
}

export async function applyDeliveryStatusUpdate(input: {
  tenantId?: string | null;
  externalMessageId: string;
  status: DeliveryStatus;
  failureCode?: string | null;
  failureReason?: string | null;
}): Promise<boolean> {
  let query = supabase
    .from("conversation_messages")
    .select("id, delivery_status, tenant_id")
    .eq("provider", "whatsapp")
    .eq("external_message_id", input.externalMessageId)
    .limit(1);
  if (input.tenantId) query = query.eq("tenant_id", input.tenantId);

  const { data: rows } = await query;
  const row = rows?.[0];

  if (!row?.id) return false;
  const tenantId = input.tenantId || row.tenant_id;
  if (!tenantId) return false;

  const now = new Date().toISOString();
  const current = row.delivery_status as DeliveryStatus | null;

  if (input.status === "failed") {
    // Do not overwrite terminal success (delivered/read) with a late failed webhook.
    if (current === "delivered" || current === "read") return false;
    await supabase
      .from("conversation_messages")
      .update({
        delivery_status: "failed",
        status_updated_at: now,
        failed_at: now,
        failure_code: input.failureCode || null,
        failure_reason: input.failureReason || null,
      })
      .eq("id", row.id)
      .eq("tenant_id", tenantId)
      .in("delivery_status", ["queued", "sent", "failed"]);
    return true;
  }

  const currentRank =
    current && current !== "failed"
      ? DELIVERY_STATUS_RANK[current as Exclude<DeliveryStatus, "failed">] || 0
      : 0;
  const nextRank = DELIVERY_STATUS_RANK[input.status as Exclude<DeliveryStatus, "failed">] || 0;
  if (nextRank <= currentRank) return false;

  await supabase
    .from("conversation_messages")
    .update({
      delivery_status: input.status,
      status_updated_at: now,
    })
    .eq("id", row.id)
    .eq("tenant_id", tenantId);
  return true;
}

export async function listConversationMessages(input: {
  actor: ConversationActor;
  tenantId: string;
  conversationId: string;
  limit?: number;
}): Promise<unknown[]> {
  assertActorCanAccessTenant(input.actor, input.tenantId);
  const conv = await getConversationById(input.conversationId, input.tenantId);
  if (!conv) throw new ConversationAccessError("Konuşma bulunamadı", 404);

  const limit = Math.min(Math.max(input.limit || 100, 1), 300);
  const { data, error } = await supabase
    .from("conversation_messages")
    .select(
      "id, direction, message_text, message_type, delivery_status, sender_type, source, external_message_id, created_at, failure_reason"
    )
    .eq("tenant_id", input.tenantId)
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  await markConversationUnreadCleared(input.conversationId, input.tenantId);
  return data || [];
}

export type InboxMetrics = {
  unanswered_open: number;
  human_handoff_rate: number;
  ai_resolution_rate: number;
  open_count: number;
  resolved_count: number;
};

export async function getInboxMetrics(
  actor: ConversationActor,
  tenantId: string,
  unansweredMinutes = 30
): Promise<InboxMetrics> {
  assertActorCanAccessTenant(actor, tenantId);
  const cutoff = new Date(Date.now() - unansweredMinutes * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("conversations")
    .select(
      "conversation_status, automation_mode, last_message_direction, last_inbound_message_at, human_takeover_at, handoff_reason"
    )
    .eq("tenant_id", tenantId)
    .in("conversation_status", ["OPEN", "PENDING", "RESOLVED"]);

  const list = rows || [];
  const openCount = list.filter(
    (r) => r.conversation_status === "OPEN" || r.conversation_status === "PENDING"
  ).length;
  const resolved = list.filter((r) => r.conversation_status === "RESOLVED");
  const unanswered = list.filter(
    (r) =>
      r.conversation_status === "OPEN" &&
      r.last_message_direction === "inbound" &&
      r.last_inbound_message_at &&
      r.last_inbound_message_at < cutoff
  ).length;

  const handoffLike = list.filter(
    (r) => r.human_takeover_at || r.handoff_reason || r.automation_mode === "HUMAN_ACTIVE"
  ).length;
  const denom = list.length || 1;
  const aiResolved = resolved.filter(
    (r) => !r.human_takeover_at && !r.handoff_reason
  ).length;

  return {
    unanswered_open: unanswered,
    human_handoff_rate: handoffLike / denom,
    ai_resolution_rate: resolved.length ? aiResolved / resolved.length : 0,
    open_count: openCount,
    resolved_count: resolved.length,
  };
}
