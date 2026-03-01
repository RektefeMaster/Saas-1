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
  const body = (await request.json().catch(() => ({}))) as {
    customer_phone?: string;
    slot_start?: string;
    service_slug?: string | null;
    extra_data?: Record<string, unknown>;
  };
  const customerPhone = body.customer_phone?.trim();
  const slotStart = body.slot_start;
  const serviceSlug = body.service_slug;
  const extraData = body.extra_data && typeof body.extra_data === "object" ? body.extra_data : {};

  if (!customerPhone || !slotStart) {
    return NextResponse.json(
      { error: "customer_phone ve slot_start gerekli" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: id,
      customer_phone: customerPhone,
      slot_start: slotStart,
      status: "confirmed",
      service_slug: serviceSlug || null,
      extra_data: extraData,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customerName =
    (extraData as { customer_name?: string }).customer_name?.trim() || null;
  try {
    await supabase
      .from("crm_customers")
      .upsert(
        {
          tenant_id: id,
          customer_phone: customerPhone,
          customer_name: customerName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,customer_phone" }
      );
  } catch {
    // CRM upsert başarısız olsa da randevu kaydı başarılı kalmalı.
  }

  return NextResponse.json(data);
}
