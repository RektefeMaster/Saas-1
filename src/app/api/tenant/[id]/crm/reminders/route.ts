import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_CHANNELS = ["panel", "whatsapp", "both"] as const;
const VALID_STATUS = ["pending", "sent", "cancelled"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("crm_reminders")
    .select(
      "id, tenant_id, customer_phone, title, note, remind_at, channel, status, sent_at, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("remind_at", { ascending: true });

  if (status && VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    customer_phone?: string;
    title?: string;
    note?: string;
    remind_at?: string;
    channel?: string;
  };

  if (!body.customer_phone?.trim() || !body.title?.trim() || !body.remind_at) {
    return NextResponse.json(
      { error: "customer_phone, title ve remind_at zorunludur" },
      { status: 400 }
    );
  }

  const channel = VALID_CHANNELS.includes(body.channel as (typeof VALID_CHANNELS)[number])
    ? body.channel
    : "panel";

  const { data, error } = await supabase
    .from("crm_reminders")
    .insert({
      tenant_id: tenantId,
      customer_phone: body.customer_phone.trim(),
      title: body.title.trim(),
      note: body.note?.trim() || null,
      remind_at: body.remind_at,
      channel,
      status: "pending",
    })
    .select(
      "id, tenant_id, customer_phone, title, note, remind_at, channel, status, sent_at, created_at, updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    title?: string;
    note?: string | null;
    remind_at?: string;
    channel?: string;
    status?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (body.note !== undefined) updates.note = typeof body.note === "string" ? body.note.trim() : null;
  if (typeof body.remind_at === "string") updates.remind_at = body.remind_at;
  if (body.channel && VALID_CHANNELS.includes(body.channel as (typeof VALID_CHANNELS)[number])) {
    updates.channel = body.channel;
  }
  if (body.status && VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])) {
    updates.status = body.status;
    if (body.status === "sent") updates.sent_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("crm_reminders")
    .update(updates)
    .eq("id", body.id)
    .eq("tenant_id", tenantId)
    .select(
      "id, tenant_id, customer_phone, title, note, remind_at, channel, status, sent_at, created_at, updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
