import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  ConversationConflictError,
  getConversationById,
  listConversationMessages,
  markConversationUnreadCleared,
  setAutomationMode,
  setConversationStatus,
} from "@/services/conversation.service";
import { getActiveMembership } from "@/services/tenantMembership.service";
import { getSession, setSession } from "@/lib/redis";
import type {
  AutomationMode,
  ConversationActor,
  ConversationRow,
  ConversationStatus,
} from "@/types/conversation.types";

/** Keep Redis FSM aligned with Postgres automation_mode (avoid staff_takeover sticky pause). */
async function syncRedisForMode(conversation: ConversationRow): Promise<void> {
  const session = await getSession(conversation.tenant_id, conversation.external_user_id);
  if (!session) return;
  const now = new Date().toISOString();
  const mode = conversation.automation_mode;
  switch (mode) {
    case "AUTOMATION_PAUSED":
      await setSession(conversation.tenant_id, conversation.external_user_id, {
        ...session,
        step: "PAUSED_FOR_HUMAN",
        // Clear staff_takeover:* so soft-pause path is not admin-locked.
        pause_reason: "automation_paused",
        updated_at: now,
      });
      return;
    case "AI_ACTIVE":
      await setSession(conversation.tenant_id, conversation.external_user_id, {
        ...session,
        step: "devam",
        pause_reason: null,
        updated_at: now,
      });
      return;
    case "HUMAN_ACTIVE":
    case "AI_ASSIST":
      await setSession(conversation.tenant_id, conversation.external_user_id, {
        ...session,
        step: "PAUSED_FOR_HUMAN",
        pause_reason:
          session.pause_reason?.startsWith("staff_takeover") ||
          session.pause_reason?.startsWith("admin_takeover")
            ? session.pause_reason
            : "staff_takeover:dashboard",
        updated_at: now,
      });
      return;
    default: {
      const _exhaustive: never = mode;
      void _exhaustive;
    }
  }
}

async function buildActor(
  tenantId: string,
  auth: { actor: "admin" | "owner"; userId?: string }
): Promise<ConversationActor> {
  if (auth.actor === "admin") {
    return { kind: "admin", canAccessAllTenants: true, userId: auth.userId };
  }
  let membershipId: string | undefined;
  if (auth.userId) {
    membershipId = (await getActiveMembership(tenantId, auth.userId))?.id;
  }
  return { kind: "tenant", tenantId, userId: auth.userId, membershipId };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const { id: rawId, conversationId } = await params;
    requireValidTenantId(rawId);
    const tenantId = rawId;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;
    const actor = await buildActor(tenantId, auth);

    const conversation = await getConversationById(conversationId, tenantId);
    if (!conversation) {
      return NextResponse.json({ error: "Konuşma bulunamadı" }, { status: 404 });
    }
    const messages = await listConversationMessages({
      actor,
      tenantId,
      conversationId,
    });

    // Konuşma açıldı = okundu. Bu satır olmadan unread_count yalnızca istemci
    // state'inde sıfırlanıyor, sayfa yenilenince rozet geri geliyordu; ekip
    // gelen kutusu kuyruğunu hiçbir zaman temizleyemiyordu.
    if ((conversation.unread_count ?? 0) > 0) {
      await markConversationUnreadCleared(conversationId, tenantId).catch((e) =>
        console.error("[conversation] unread clear failed:", e)
      );
      conversation.unread_count = 0;
    }

    return NextResponse.json({ conversation, messages });
  } catch (err) {
    if (err instanceof ConversationAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; conversationId: string }> }
) {
  try {
    const { id: rawId, conversationId } = await params;
    requireValidTenantId(rawId);
    const tenantId = rawId;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;
    const actor = await buildActor(tenantId, auth);
    const body = (await request.json()) as {
      conversation_status?: ConversationStatus;
      automation_mode?: AutomationMode;
      expected_version?: number;
    };

    // Soft-pause / mode change (+ optional status) in one request.
    if (body.automation_mode && body.expected_version != null) {
      let conversation = await setAutomationMode({
        actor,
        tenantId,
        conversationId,
        mode: body.automation_mode,
        expectedVersion: body.expected_version,
        membershipId: actor.membershipId,
      });
      // AUTOMATION_PAUSED already sets PENDING inside setAutomationMode.
      if (
        body.conversation_status &&
        !(
          body.automation_mode === "AUTOMATION_PAUSED" &&
          body.conversation_status === "PENDING"
        )
      ) {
        conversation = await setConversationStatus({
          actor,
          tenantId,
          conversationId,
          status: body.conversation_status,
        });
      }
      await syncRedisForMode(conversation);
      return NextResponse.json({ conversation });
    }

    if (body.conversation_status) {
      let conversation = await getConversationById(conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json({ error: "Konuşma bulunamadı" }, { status: 404 });
      }

      // Resolving must return the thread to AI so soft-pause/human ownership does not stick.
      if (
        body.conversation_status === "RESOLVED" &&
        conversation.automation_mode !== "AI_ACTIVE"
      ) {
        conversation = await setAutomationMode({
          actor,
          tenantId,
          conversationId,
          mode: "AI_ACTIVE",
          expectedVersion: conversation.version,
          membershipId: actor.membershipId,
        });
      }

      conversation = await setConversationStatus({
        actor,
        tenantId,
        conversationId,
        status: body.conversation_status,
      });
      await syncRedisForMode(conversation);
      return NextResponse.json({ conversation });
    }

    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  } catch (err) {
    if (err instanceof ConversationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ConversationAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
