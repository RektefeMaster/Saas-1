import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  ConversationConflictError,
  getConversationById,
  listConversationMessages,
  setAutomationMode,
  setConversationStatus,
} from "@/services/conversation.service";
import { getActiveMembership } from "@/services/tenantMembership.service";
import type {
  AutomationMode,
  ConversationActor,
  ConversationStatus,
} from "@/types/conversation.types";

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

    if (body.conversation_status) {
      const conversation = await setConversationStatus({
        actor,
        tenantId,
        conversationId,
        status: body.conversation_status,
      });
      return NextResponse.json({ conversation });
    }

    if (body.automation_mode && body.expected_version != null) {
      const conversation = await setAutomationMode({
        actor,
        tenantId,
        conversationId,
        mode: body.automation_mode,
        expectedVersion: body.expected_version,
        membershipId: actor.membershipId,
      });
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
