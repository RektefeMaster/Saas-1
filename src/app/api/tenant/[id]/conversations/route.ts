import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import {
  ConversationAccessError,
  getInboxMetrics,
  listConversations,
} from "@/services/conversation.service";
import { getActiveMembership } from "@/services/tenantMembership.service";
import type { ConversationActor, ConversationStatus } from "@/types/conversation.types";

async function buildActor(
  tenantId: string,
  auth: { actor: "admin" | "owner"; userId?: string }
): Promise<ConversationActor> {
  if (auth.actor === "admin") {
    return { kind: "admin", canAccessAllTenants: true, userId: auth.userId };
  }
  let membershipId: string | undefined;
  if (auth.userId) {
    const membership = await getActiveMembership(tenantId, auth.userId);
    membershipId = membership?.id;
  }
  return {
    kind: "tenant",
    tenantId,
    userId: auth.userId,
    membershipId,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    requireValidTenantId(rawId);
    const tenantId = rawId;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;

    const actor = await buildActor(tenantId, auth);
    const status = request.nextUrl.searchParams.get("status") as ConversationStatus | null;
    const withMetrics = request.nextUrl.searchParams.get("metrics") === "1";

    const items = await listConversations({
      actor,
      tenantId,
      limit: Number(request.nextUrl.searchParams.get("limit") || 50),
      status: status || null,
    });

    const metrics = withMetrics ? await getInboxMetrics(actor, tenantId) : null;
    return NextResponse.json({ items, metrics });
  } catch (err) {
    if (err instanceof ConversationAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
