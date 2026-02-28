import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json([]);
  }
  try {
    const { data, error } = await supabase
      .from("business_types")
      .select("*")
      .order("name");
    if (error) {
      console.error("[business-types GET]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası";
    if (msg.includes("SUPABASE_NOT_CONFIGURED")) return NextResponse.json([]);
    return NextResponse.json({ error: msg }, { status: 500 });
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
  const { name, slug, flow_type, config } = body;
  if (!name || !slug || !flow_type) {
    return NextResponse.json({ error: "name, slug, flow_type gerekli" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("business_types")
    .insert({ name, slug, flow_type, config: config || {} })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
