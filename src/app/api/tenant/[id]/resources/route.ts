import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { logTenantEvent } from "@/services/eventLog.service";

const VALID_TYPES = [
  "chair",
  "specialist",
  "room",
  "doctor",
  "device",
  "lift",
  "technician",
  "other",
] as const;

const VALID_STATUS = ["active", "inactive", "maintenance"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "").trim();

  let query = supabase
    .from("tenant_resources")
    .select("id, tenant_id, resource_type, name, status, capacity, metadata, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (type && VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    query = query.eq("resource_type", type);
  }

  const { data, error } = await query;
  if (!error) {
    return NextResponse.json(data || []);
  }

  const missing = extractMissingSchemaTable(error);
  if (missing === "tenant_resources") {
    return NextResponse.json([]);
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    resource_type?: string;
    name?: string;
    status?: string;
    capacity?: number;
    metadata?: Record<string, unknown>;
  };

  if (!body.resource_type || !VALID_TYPES.includes(body.resource_type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: "resource_type gecersiz" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name gerekli" }, { status: 400 });
  }

  const status = VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])
    ? body.status
    : "active";

  const { data, error } = await supabase
    .from("tenant_resources")
    .insert({
      tenant_id: tenantId,
      resource_type: body.resource_type,
      name: body.name.trim(),
      status,
      capacity: Math.max(1, Number(body.capacity || 1)),
      metadata: body.metadata || {},
    })
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
    eventType: "resource.created",
    actor: "tenant",
    entityType: "resource",
    entityId: data.id,
    payload: {
      resource_type: data.resource_type,
      status: data.status,
      capacity: data.capacity,
    },
  });

  return NextResponse.json(data, { status: 201 });
}
