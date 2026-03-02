import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { logTenantEvent } from "@/services/eventLog.service";

const VALID_STATUS = ["active", "inactive", "maintenance"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id: tenantId, resourceId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    status?: string;
    capacity?: number;
    metadata?: Record<string, unknown>;
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])) {
    updates.status = body.status;
  }
  if (typeof body.capacity === "number") {
    updates.capacity = Math.max(1, Math.floor(body.capacity));
  }
  if (body.metadata && typeof body.metadata === "object") {
    updates.metadata = body.metadata;
  }

  const { data, error } = await supabase
    .from("tenant_resources")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", resourceId)
    .select("id, tenant_id, resource_type, name, status, capacity, metadata, created_at, updated_at")
    .single();

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "tenant_resources") {
      return NextResponse.json(
        { error: "Resources modulu hazir degil. Migration 016 uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logTenantEvent({
    tenantId,
    eventType: "resource.updated",
    actor: "tenant",
    entityType: "resource",
    entityId: resourceId,
    payload: updates,
  });

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> }
) {
  const { id: tenantId, resourceId } = await params;

  const { error } = await supabase
    .from("tenant_resources")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", resourceId);

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "tenant_resources") {
      return NextResponse.json(
        { error: "Resources modulu hazir degil. Migration 016 uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logTenantEvent({
    tenantId,
    eventType: "resource.deleted",
    actor: "tenant",
    entityType: "resource",
    entityId: resourceId,
    payload: {},
  });

  return NextResponse.json({ deleted: true });
}
