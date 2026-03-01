import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("tenants")
    .select("*, business_types(*)")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    name,
    tenant_code,
    status,
    config_override,
    owner_phone_e164,
    security_config,
    ui_preferences,
  } = body;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (tenant_code !== undefined) updates.tenant_code = String(tenant_code).toUpperCase();
  if (status !== undefined) updates.status = status;
  if (config_override !== undefined) updates.config_override = config_override;
  if (owner_phone_e164 !== undefined) updates.owner_phone_e164 = owner_phone_e164;
  if (security_config !== undefined) updates.security_config = security_config;
  if (ui_preferences !== undefined) updates.ui_preferences = ui_preferences;

  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const soft = request.nextUrl.searchParams.get("soft") !== "false";
  if (soft) {
    const { data, error } = await supabase
      .from("tenants")
      .update({ deleted_at: new Date().toISOString(), status: "inactive" })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
