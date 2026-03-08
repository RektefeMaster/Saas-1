import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

interface PackagePayload {
  name?: string;
  service_slug?: string;
  total_sessions?: number;
  price?: number;
  validity_days?: number | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;

  const result = await supabase
    .from("packages")
    .select(
      "id, tenant_id, name, service_slug, total_sessions, price, validity_days, is_active, metadata, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "packages") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as PackagePayload;

  const name = body.name?.trim();
  const serviceSlug = body.service_slug?.trim();
  const totalSessions = Number(body.total_sessions || 0);

  if (!name || !serviceSlug || !Number.isFinite(totalSessions) || totalSessions <= 0) {
    return NextResponse.json(
      { error: "name, service_slug ve total_sessions(>0) gerekli" },
      { status: 400 }
    );
  }

  const price = Number(body.price || 0);
  const validityDays =
    body.validity_days === null || body.validity_days === undefined
      ? null
      : Number(body.validity_days);

  if (validityDays !== null && (!Number.isFinite(validityDays) || validityDays < 0)) {
    return NextResponse.json({ error: "validity_days negatif olamaz" }, { status: 400 });
  }

  const insertPayload = {
    tenant_id: tenantId,
    name,
    service_slug: serviceSlug,
    total_sessions: Math.floor(totalSessions),
    price: Number.isFinite(price) ? Math.max(0, price) : 0,
    validity_days: validityDays === null ? null : Math.floor(validityDays),
    is_active: body.is_active !== false,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };

  const result = await supabase
    .from("packages")
    .insert(insertPayload)
    .select(
      "id, tenant_id, name, service_slug, total_sessions, price, validity_days, is_active, metadata, created_at, updated_at"
    )
    .single();

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "packages") {
      return NextResponse.json(
        { error: "Paket modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
