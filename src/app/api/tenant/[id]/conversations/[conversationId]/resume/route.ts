import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  ConversationConflictError,
  getConversationById,
  resumeConversationToAi,
} from "@/services/conversation.service";
import { getActiveMembership } from "@/services/tenantMembership.service";
import { getSession, setSession } from "@/lib/redis";
import type { ConversationActor } from "@/types/conversation.types";

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

    const body = (await request.json()) as {
      expected_version: number;
      force?: boolean;
    };
    if (body.expected_version == null) {
      return NextResponse.json({ error: "expected_version gerekli" }, { status: 400 });
    }

    const existing = await getConversationById(conversationId, tenantId);
    if (!existing) {
      return NextResponse.json({ error: "Konuşma bulunamadı" }, { status: 404 });
    }

    // Only assignee (or admin / explicit force) may release an active human takeover.
    if (
      auth.actor !== "admin" &&
      !body.force &&
      (existing.automation_mode === "HUMAN_ACTIVE" ||
        existing.automation_mode === "AI_ASSIST") &&
      existing.assigned_membership_id
    ) {
      const membership = auth.userId
        ? await getActiveMembership(tenantId, auth.userId)
        : null;
      if (!membership || membership.id !== existing.assigned_membership_id) {
        return NextResponse.json(
          { error: "Bu konuşma başka bir personelde — AI'ya bırakamazsınız" },
          { status: 409 }
        );
      }
    }

    const actor: ConversationActor =
      auth.actor === "admin"
        ? { kind: "admin", canAccessAllTenants: true, userId: auth.userId }
        : { kind: "tenant", tenantId, userId: auth.userId };

    const conversation = await resumeConversationToAi({
      actor,
      tenantId,
      conversationId,
      expectedVersion: body.expected_version,
    });

    const session = await getSession(tenantId, conversation.external_user_id);
    if (session) {
      await setSession(tenantId, conversation.external_user_id, {
        ...session,
        step: "devam",
        pause_reason: null,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ conversation });
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
