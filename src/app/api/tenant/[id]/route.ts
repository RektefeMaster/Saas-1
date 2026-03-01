import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, tenant_code, status, config_override, ui_preferences, security_config, owner_phone_e164, contact_phone, working_hours_text")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(data);
}
