import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const { id: tenantId, serviceId } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.slug === "string") updates.slug = body.slug.trim();
  if (typeof body.description === "string" || body.description === null) {
    updates.description =
      typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (typeof body.price === "number" || body.price === null) updates.price = body.price;
  if (typeof body.duration_minutes === "number") updates.duration_minutes = body.duration_minutes;
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.price_visible === "boolean") updates.price_visible = body.price_visible;
  if (typeof body.display_order === "number") updates.display_order = body.display_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const patchPayload = { ...updates };
  let selectColumns = [
    "id",
    "tenant_id",
    "name",
    "slug",
    "description",
    "price",
    "duration_minutes",
    "is_active",
    "price_visible",
    "display_order",
    "created_at",
  ];
  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;
  const fallbackMutationColumns = new Set([
    "duration_minutes",
    "is_active",
    "price_visible",
    "display_order",
  ]);
  for (let i = 0; i < 12; i++) {
    const result = await supabase
      .from("services")
      .update(patchPayload)
      .eq("id", serviceId)
      .eq("tenant_id", tenantId)
      .select(selectColumns.join(", "))
      .single();
    if (!result.error) {
      data = (result.data ?? null) as unknown as Record<string, unknown>;
      error = null;
      break;
    }
    error = { message: result.error.message };
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "services") break;
    let changed = false;
    if (fallbackMutationColumns.has(missing.column) && missing.column in patchPayload) {
      delete patchPayload[missing.column];
      changed = true;
    }
    if (selectColumns.includes(missing.column)) {
      selectColumns = selectColumns.filter((c) => c !== missing.column);
      changed = true;
    }
    if (!changed) break;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const { id: tenantId, serviceId } = await params;
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
