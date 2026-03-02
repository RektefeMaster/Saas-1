import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

function normalizePhone(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  const { id: tenantId, phone } = await params;
  const customerPhone = normalizePhone(phone);
  const customerResult = await supabase
    .from("crm_customers")
    .select(
      "id, tenant_id, customer_phone, customer_name, tags, notes_summary, last_visit_at, total_visits, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  let customer = customerResult.data ?? null;
  if (customerResult.error) {
    const missingTable = extractMissingSchemaTable(customerResult.error);
    if (missingTable !== "crm_customers") {
      return NextResponse.json({ error: customerResult.error.message }, { status: 500 });
    }
    customer = null;
  }

  const notesResult = await supabase
    .from("crm_notes")
    .select("id, tenant_id, customer_phone, note, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .order("created_at", { ascending: false })
    .limit(20);
  let notes = notesResult.data ?? [];
  if (notesResult.error) {
    const missingTable = extractMissingSchemaTable(notesResult.error);
    if (missingTable !== "crm_notes") {
      return NextResponse.json({ error: notesResult.error.message }, { status: 500 });
    }
    notes = [];
  }

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

  if (error) {
    const missingTable = extractMissingSchemaTable(error);
    if (missingTable === "crm_customers") {
      return NextResponse.json(
        { error: "CRM modülü hazır değil. İlgili migration uygulanmalı." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
