import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

function normalizePhone(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

interface CustomerPackageCreatePayload {
  customer_phone?: string;
  package_id?: string;
  purchased_at?: string;
  metadata?: Record<string, unknown>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const phoneFilter = normalizePhone(searchParams.get("customer_phone") || "");
  const statusFilter = (searchParams.get("status") || "").trim();

  let query = supabase
    .from("customer_packages")
    .select(
      "id, tenant_id, customer_phone, package_id, total_sessions, remaining_sessions, purchased_at, expires_at, status, metadata, packages(id, name, service_slug)"
    )
    .eq("tenant_id", tenantId)
    .order("purchased_at", { ascending: false })
    .limit(200);

  if (phoneFilter) query = query.eq("customer_phone", phoneFilter);
  if (statusFilter) query = query.eq("status", statusFilter);

  const result = await query;

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "customer_packages" || missingTable === "packages") {
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
  const body = (await request.json().catch(() => ({}))) as CustomerPackageCreatePayload;

  const customerPhone = normalizePhone(body.customer_phone || "");
  const packageId = body.package_id?.trim();

  if (!customerPhone || !packageId) {
    return NextResponse.json(
      { error: "customer_phone ve package_id gerekli" },
      { status: 400 }
    );
  }

  const packageResult = await supabase
    .from("packages")
    .select("id, total_sessions, validity_days, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", packageId)
    .maybeSingle();

  if (packageResult.error) {
    const missingTable = extractMissingSchemaTable(packageResult.error);
    if (missingTable === "packages") {
      return NextResponse.json(
        { error: "Paket modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: packageResult.error.message }, { status: 500 });
  }

  if (!packageResult.data || packageResult.data.is_active === false) {
    return NextResponse.json({ error: "Paket bulunamadi veya pasif" }, { status: 404 });
  }

  const purchasedAt = body.purchased_at ? new Date(body.purchased_at) : new Date();
  if (Number.isNaN(purchasedAt.getTime())) {
    return NextResponse.json({ error: "purchased_at gecersiz" }, { status: 400 });
  }

  const validityDays = Number(packageResult.data.validity_days || 0);
  const expiresAt =
    Number.isFinite(validityDays) && validityDays > 0
      ? new Date(purchasedAt.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const totalSessions = Number(packageResult.data.total_sessions || 0);
  if (!Number.isFinite(totalSessions) || totalSessions <= 0) {
    return NextResponse.json({ error: "Paket seans sayisi gecersiz" }, { status: 400 });
  }

  const insertPayload = {
    tenant_id: tenantId,
    customer_phone: customerPhone,
    package_id: packageId,
    total_sessions: Math.floor(totalSessions),
    remaining_sessions: Math.floor(totalSessions),
    purchased_at: purchasedAt.toISOString(),
    expires_at: expiresAt,
    status: "active",
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };

  const insertResult = await supabase
    .from("customer_packages")
    .insert(insertPayload)
    .select(
      "id, tenant_id, customer_phone, package_id, total_sessions, remaining_sessions, purchased_at, expires_at, status, metadata, packages(id, name, service_slug)"
    )
    .single();

  if (insertResult.error) {
    const missingTable = extractMissingSchemaTable(insertResult.error);
    if (missingTable === "customer_packages") {
      return NextResponse.json(
        { error: "Paket-seans modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json(insertResult.data);
}
