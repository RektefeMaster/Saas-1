import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  ConversationConflictError,
  takeoverConversation,
} from "@/services/conversation.service";
import { getActiveMembership } from "@/services/tenantMembership.service";
import { setSession, getSession } from "@/lib/redis";
import type { ConversationActor, ConversationPriority } from "@/types/conversation.types";

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
    if (!auth.userId && auth.actor !== "admin") {
      return NextResponse.json({ error: "Kullanıcı kimliği yok" }, { status: 401 });
    }

    const membership = auth.userId
      ? await getActiveMembership(tenantId, auth.userId)
      : null;
    if (!membership && auth.actor !== "admin") {
      return NextResponse.json({ error: "Üyelik bulunamadı" }, { status: 403 });
    }

    const body = (await request.json()) as {
      expected_version: number;
      handoff_reason?: string;
      priority?: ConversationPriority;
    };
    if (body.expected_version == null) {
      return NextResponse.json({ error: "expected_version gerekli" }, { status: 400 });
    }

    const actor: ConversationActor =
      auth.actor === "admin"
        ? { kind: "admin", canAccessAllTenants: true, userId: auth.userId }
        : {
            kind: "tenant",
            tenantId,
            userId: auth.userId,
            membershipId: membership!.id,
          };

    const conversation = await takeoverConversation({
      actor,
      tenantId,
      conversationId,
      membershipId: membership?.id || actor.membershipId || null,
      expectedVersion: body.expected_version,
      handoffReason:
        body.handoff_reason ||
        (auth.actor === "admin" ? "admin_takeover" : "staff_takeover"),
      priority: body.priority,
    });

    // Bridge Redis FSM so legacy paths also pause
    const phone = conversation.external_user_id;
    const session = await getSession(tenantId, phone);
    if (session) {
      await setSession(tenantId, phone, {
        ...session,
        step: "PAUSED_FOR_HUMAN",
        pause_reason: `staff_takeover:${membership?.id || "admin"}`,
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
