import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json([]);
  }
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("business_type");

    let query = supabase
      .from("tenants")
      .select("*, business_types(id, name, slug)")
      .is("deleted_at", null)
      .order("name");

    if (status) query = query.eq("status", status);
    if (type) query = query.eq("business_type_id", type);

    const { data, error } = await query;
    if (error) {
      console.error("[tenants GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json(
      { error: msg.includes("Supabase") ? "Supabase kurulumu gerekli. .env dosyasını kontrol edin." : msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Veritabanı bağlantısı yapılandırılmamış" },
      { status: 503 }
    );
  }
  const body = await request.json();
  const { business_type_id, name, tenant_code, config_override } = body;
  if (!business_type_id || !name || !tenant_code) {
    return NextResponse.json(
      { error: "business_type_id, name, tenant_code gerekli" },
      { status: 400 }
    );
  }
  const code = String(tenant_code).toUpperCase().trim();
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      business_type_id,
      name,
      tenant_code: code,
      config_override: config_override || {},
      status: "active",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
