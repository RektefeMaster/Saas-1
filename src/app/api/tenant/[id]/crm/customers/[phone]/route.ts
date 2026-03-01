import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizePhone(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  const { id: tenantId, phone } = await params;
  const customerPhone = normalizePhone(phone);
  const { data: customer, error } = await supabase
    .from("crm_customers")
    .select(
      "id, tenant_id, customer_phone, customer_name, tags, notes_summary, last_visit_at, total_visits, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: notes } = await supabase
    .from("crm_notes")
    .select("id, tenant_id, customer_phone, note, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    customer:
      customer ??
      ({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        customer_name: null,
        tags: [],
        notes_summary: null,
        last_visit_at: null,
        total_visits: 0,
      } as Record<string, unknown>),
    notes: notes ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  const { id: tenantId, phone } = await params;
  const customerPhone = normalizePhone(phone);
  const body = (await request.json().catch(() => ({}))) as {
    customer_name?: string | null;
    tags?: string[];
    notes_summary?: string | null;
    last_visit_at?: string | null;
    total_visits?: number;
  };

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_phone: customerPhone,
    updated_at: new Date().toISOString(),
  };

  if (body.customer_name !== undefined) payload.customer_name = body.customer_name;
  if (Array.isArray(body.tags)) payload.tags = body.tags;
  if (body.notes_summary !== undefined) payload.notes_summary = body.notes_summary;
  if (body.last_visit_at !== undefined) payload.last_visit_at = body.last_visit_at;
  if (typeof body.total_visits === "number") payload.total_visits = body.total_visits;

  const { data, error } = await supabase
    .from("crm_customers")
    .upsert(payload, { onConflict: "tenant_id,customer_phone" })
    .select(
      "id, tenant_id, customer_phone, customer_name, tags, notes_summary, last_visit_at, total_visits, created_at, updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
