import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

interface PackagePatchPayload {
  name?: string;
  service_slug?: string;
  total_sessions?: number;
  price?: number;
  validity_days?: number | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  const { id: tenantId, packageId } = await params;
  const body = (await request.json().catch(() => ({}))) as PackagePatchPayload;

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) payload.name = String(body.name).trim();
  if (body.service_slug !== undefined) payload.service_slug = String(body.service_slug).trim();
  if (body.total_sessions !== undefined) {
    const total = Number(body.total_sessions);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: "total_sessions > 0 olmali" }, { status: 400 });
    }
    payload.total_sessions = Math.floor(total);
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    payload.price = Number.isFinite(price) ? Math.max(0, price) : 0;
  }
  if (body.validity_days !== undefined) {
    if (body.validity_days === null) {
      payload.validity_days = null;
    } else {
      const validityDays = Number(body.validity_days);
      if (!Number.isFinite(validityDays) || validityDays < 0) {
        return NextResponse.json({ error: "validity_days negatif olamaz" }, { status: 400 });
      }
      payload.validity_days = Math.floor(validityDays);
    }
  }
  if (body.is_active !== undefined) payload.is_active = Boolean(body.is_active);
  if (body.metadata !== undefined) {
    payload.metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }

  if (Object.keys(payload).length === 1) {
    return NextResponse.json({ error: "Guncellenecek alan yok" }, { status: 400 });
  }

  const result = await supabase
    .from("packages")
    .update(payload)
    .eq("tenant_id", tenantId)
    .eq("id", packageId)
    .select(
      "id, tenant_id, name, service_slug, total_sessions, price, validity_days, is_active, metadata, created_at, updated_at"
    )
    .maybeSingle();

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

  if (!result.data) {
    return NextResponse.json({ error: "Paket bulunamadi" }, { status: 404 });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  const { id: tenantId, packageId } = await params;

  const result = await supabase
    .from("packages")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", packageId)
    .select("id")
    .maybeSingle();

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

  if (!result.data) {
    return NextResponse.json({ error: "Paket bulunamadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: result.data.id });
}
