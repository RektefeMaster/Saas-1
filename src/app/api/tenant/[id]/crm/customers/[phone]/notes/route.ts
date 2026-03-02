import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { logTenantEvent } from "@/services/eventLog.service";

function normalizePhone(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  const { id: tenantId, phone } = await params;
  const customerPhone = normalizePhone(phone);
  const body = (await request.json().catch(() => ({}))) as {
    note?: string;
    created_by?: string;
  };

  const note = body.note?.trim();
  if (!note) {
    return NextResponse.json({ error: "Not metni gerekli" }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from("crm_notes")
    .insert({
      tenant_id: tenantId,
      customer_phone: customerPhone,
      note,
      created_by: body.created_by?.trim() || null,
    })
    .select("id, tenant_id, customer_phone, note, created_by, created_at")
    .single();

  if (error) {
    const missingTable = extractMissingSchemaTable(error);
    if (missingTable === "crm_notes") {
      return NextResponse.json(
        { error: "CRM modülü hazır değil. İlgili migration uygulanmalı." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("crm_customers")
    .upsert(
      {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        notes_summary: note.slice(0, 300),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_phone" }
    );

  await logTenantEvent({
    tenantId,
    eventType: "crm.note.created",
    actor: body.created_by?.trim() || "tenant",
    entityType: "crm_note",
    entityId: created.id,
    payload: {
      customer_phone: customerPhone,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
