import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, tenant_id, name, slug, description, price, duration_minutes, is_active, price_visible, display_order, created_at"
    )
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

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

  const payload = {
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

  const { data, error } = await supabase
    .from("services")
    .insert(payload)
    .select(
      "id, tenant_id, name, slug, description, price, duration_minutes, is_active, price_visible, display_order, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
