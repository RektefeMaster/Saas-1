import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  ConversationConflictError,
  resumeConversationToAi,
} from "@/services/conversation.service";
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

    const body = (await request.json()) as { expected_version: number };
    if (body.expected_version == null) {
      return NextResponse.json({ error: "expected_version gerekli" }, { status: 400 });
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
