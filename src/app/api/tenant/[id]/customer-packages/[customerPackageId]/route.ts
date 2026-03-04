import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { consumeCustomerPackageSession } from "@/services/package.service";

interface CustomerPackagePatchPayload {
  remaining_sessions?: number;
  status?: "active" | "completed" | "expired" | "cancelled";
  metadata?: Record<string, unknown>;
  consume_one?: boolean;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; customerPackageId: string }> }
) {
  const { id: tenantId, customerPackageId } = await params;
  const body = (await request.json().catch(() => ({}))) as CustomerPackagePatchPayload;

  if (body.consume_one) {
    const consumeResult = await consumeCustomerPackageSession(customerPackageId);
    if (!consumeResult.ok) {
      return NextResponse.json(
        { error: consumeResult.error || "Paket seansi dusurulemedi" },
        { status: 409 }
      );
    }

    const read = await supabase
      .from("customer_packages")
      .select(
        "id, tenant_id, customer_phone, package_id, total_sessions, remaining_sessions, purchased_at, expires_at, status, metadata, packages(id, name, service_slug)"
      )
      .eq("tenant_id", tenantId)
      .eq("id", customerPackageId)
      .maybeSingle();

    if (read.error || !read.data) {
      return NextResponse.json(
        {
          ok: true,
          id: customerPackageId,
          remaining_sessions: consumeResult.remainingSessions,
          status: consumeResult.status,
        }
      );
    }

    return NextResponse.json(read.data);
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.remaining_sessions !== undefined) {
    const remaining = Number(body.remaining_sessions);
    if (!Number.isFinite(remaining) || remaining < 0) {
      return NextResponse.json(
        { error: "remaining_sessions negatif olamaz" },
        { status: 400 }
      );
    }
    payload.remaining_sessions = Math.floor(remaining);
    if (remaining <= 0 && body.status === undefined) {
      payload.status = "completed";
    }
  }

  if (body.status !== undefined) {
    payload.status = body.status;
  }

  if (body.metadata !== undefined) {
    payload.metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }

  if (Object.keys(payload).length === 1) {
    return NextResponse.json({ error: "Guncellenecek alan yok" }, { status: 400 });
  }

  const result = await supabase
    .from("customer_packages")
    .update(payload)
    .eq("tenant_id", tenantId)
    .eq("id", customerPackageId)
    .select(
      "id, tenant_id, customer_phone, package_id, total_sessions, remaining_sessions, purchased_at, expires_at, status, metadata, packages(id, name, service_slug)"
    )
    .maybeSingle();

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "customer_packages") {
      return NextResponse.json(
        { error: "Paket-seans modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Kayit bulunamadi" }, { status: 404 });
  }

  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; customerPackageId: string }> }
) {
  const { id: tenantId, customerPackageId } = await params;

  const result = await supabase
    .from("customer_packages")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", customerPackageId)
    .select("id")
    .maybeSingle();

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "customer_packages") {
      return NextResponse.json(
        { error: "Paket-seans modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Kayit bulunamadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: result.data.id });
}
