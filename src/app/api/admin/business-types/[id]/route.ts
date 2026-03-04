import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Veritabanı yapılandırılmamış" },
      { status: 503 }
    );
  }
  const { id } = await params;
  const { data, error } = await supabase
    .from("business_types")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Bulunamadı" },
      { status: error?.code === "PGRST116" ? 404 : 500 }
    );
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Veritabanı yapılandırılmamış" },
      { status: 503 }
    );
  }
  const { id } = await params;
  const body = await request.json();
  const { name, slug, flow_type, config, bot_config, feature_flags } = body;
  const updatePayload: Record<string, unknown> = {};
  if (name !== undefined) updatePayload.name = name;
  if (slug !== undefined) updatePayload.slug = slug;
  if (flow_type !== undefined) updatePayload.flow_type = flow_type;
  if (config !== undefined) updatePayload.config = config;
  if (bot_config !== undefined) updatePayload.bot_config = bot_config === null ? null : bot_config;
  if (feature_flags !== undefined) {
    updatePayload.feature_flags =
      feature_flags === null ? {} : feature_flags;
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("business_types")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Veritabanı yapılandırılmamış" },
      { status: 503 }
    );
  }
  const { id } = await params;

  const { data: existing } = await supabase
    .from("business_types")
    .select("id, name, slug")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "İşletme tipi bulunamadı" }, { status: 404 });
  }

  const { count: tenantCount } = await supabase
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("business_type_id", id)
    .is("deleted_at", null);
  if (tenantCount && tenantCount > 0) {
    return NextResponse.json(
      {
        error: `Bu işletme tipi ${tenantCount} işletme tarafından kullanılıyor. Önce bu işletmelerin tipini değiştirin veya silin.`,
        tenant_count: tenantCount,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("business_types").delete().eq("id", id);
  if (error) {
    console.error("[business-types DELETE]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, deleted_id: id });
}
