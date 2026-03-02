import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const requestedColumns = [
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
  let selectColumns = [...requestedColumns];
  let data: Record<string, unknown>[] | null = null;
  let error: { message: string } | null = null;
  for (let i = 0; i < requestedColumns.length; i++) {
    let query = supabase
      .from("services")
      .select(selectColumns.join(", "))
      .eq("tenant_id", tenantId);

    if (selectColumns.includes("display_order")) {
      query = query.order("display_order", { ascending: true });
    }
    if (selectColumns.includes("created_at")) {
      query = query.order("created_at", { ascending: true });
    }

    const result = await query;
    if (!result.error) {
      data = ((result.data as unknown) as Record<string, unknown>[]) ?? [];
      error = null;
      break;
    }
    error = { message: result.error.message };
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "services" || !selectColumns.includes(missing.column)) {
      break;
    }
    selectColumns = selectColumns.filter((c) => c !== missing.column);
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    description?: string;
    price?: number | null;
    duration_minutes?: number;
    is_active?: boolean;
    price_visible?: boolean;
    display_order?: number;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Hizmet adı gereklidir" }, { status: 400 });
  }

  const slug = (body.slug?.trim() || slugify(name)).slice(0, 120);
  if (!slug) {
    return NextResponse.json({ error: "Geçerli bir slug üretilemedi" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    name,
    slug,
    description: body.description?.trim() || null,
    price: typeof body.price === "number" ? body.price : null,
    duration_minutes:
      typeof body.duration_minutes === "number" && body.duration_minutes > 0
        ? body.duration_minutes
        : 30,
    is_active: body.is_active !== false,
    price_visible: body.price_visible !== false,
    display_order:
      typeof body.display_order === "number" && body.display_order >= 0
        ? body.display_order
        : 0,
  };

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
      .insert(payload)
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
    if (fallbackMutationColumns.has(missing.column) && missing.column in payload) {
      delete payload[missing.column];
      changed = true;
    }
    if (selectColumns.includes(missing.column)) {
      selectColumns = selectColumns.filter((c) => c !== missing.column);
      changed = true;
    }
    if (!changed) break;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
