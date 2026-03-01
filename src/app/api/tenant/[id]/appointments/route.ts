import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("tenant_id", id)
    .neq("status", "cancelled")
    .order("slot_start", { ascending: true });

  if (from) {
    query = query.gte("slot_start", from);
  }
  if (to) {
    query = query.lte("slot_start", to);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { customer_phone, slot_start, service_slug, extra_data } = body;

  if (!customer_phone || !slot_start) {
    return NextResponse.json(
      { error: "customer_phone ve slot_start gerekli" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: id,
      customer_phone,
      slot_start,
      status: "confirmed",
      service_slug: service_slug || null,
      extra_data: extra_data || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
