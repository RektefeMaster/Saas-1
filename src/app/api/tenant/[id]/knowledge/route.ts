/**
 * İşletmeye özel onaylı bilgi (SSS / politika / kampanya metni).
 * Bot yalnızca `approved` kayıtları okur — yazmak ile yayınlamak ayrı adımdır.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import {
  createKnowledgeEntry,
  listKnowledgeForPanel,
  updateKnowledgeEntry,
  KNOWLEDGE_STATUSES,
  MAX_APPROVED_ENTRIES,
  type KnowledgeStatus,
} from "@/services/tenantKnowledge.service";

function parseStatusFilter(value: string | null): KnowledgeStatus | undefined {
  if (!value || value === "all") return undefined;
  return KNOWLEDGE_STATUSES.includes(value as KnowledgeStatus)
    ? (value as KnowledgeStatus)
    : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const auth = await requireTenantApiAccess(request, tenantId);
  if (!auth.ok) return auth.response;

  const status = parseStatusFilter(request.nextUrl.searchParams.get("status"));
  const result = await listKnowledgeForPanel(tenantId, status);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { ...result.data, max_approved: MAX_APPROVED_ENTRIES },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const auth = await requireTenantApiAccess(request, tenantId);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await createKnowledgeEntry(tenantId, {
    title: String(body.title || ""),
    body: String(body.body || ""),
    category: body.category ? String(body.category) : undefined,
    effective_from: body.effective_from ? String(body.effective_from) : null,
    effective_until: body.effective_until ? String(body.effective_until) : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ entry: result.data, warning: result.warning ?? null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const auth = await requireTenantApiAccess(request, tenantId);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entryId = String(body.id || "");
  if (!entryId) {
    return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  }

  const result = await updateKnowledgeEntry(
    tenantId,
    entryId,
    {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.body !== undefined ? { body: String(body.body) } : {}),
      ...(body.category !== undefined ? { category: String(body.category) } : {}),
      ...(body.effective_from !== undefined
        ? { effective_from: body.effective_from ? String(body.effective_from) : null }
        : {}),
      ...(body.effective_until !== undefined
        ? { effective_until: body.effective_until ? String(body.effective_until) : null }
        : {}),
      ...(body.status !== undefined ? { status: body.status as KnowledgeStatus } : {}),
    },
    auth.actor === "owner" ? auth.userId : undefined
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ entry: result.data, warning: result.warning ?? null });
}
