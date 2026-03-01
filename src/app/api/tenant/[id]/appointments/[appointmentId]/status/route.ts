import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const VALID_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; appointmentId: string }> }
) {
  const { id: tenantId, appointmentId } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status geçersiz. (${VALID_STATUSES.join(", ")})` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .select("id, tenant_id, customer_phone, slot_start, status, service_slug, extra_data, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "completed") {
    const { data: existing } = await supabase
      .from("crm_customers")
      .select("total_visits")
      .eq("tenant_id", tenantId)
      .eq("customer_phone", data.customer_phone)
      .maybeSingle();

    try {
      await supabase
        .from("crm_customers")
        .upsert(
          {
            tenant_id: tenantId,
            customer_phone: data.customer_phone,
            total_visits: (existing?.total_visits || 0) + 1,
            last_visit_at: data.slot_start,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,customer_phone" }
        );
    } catch {
      // CRM güncellemesi başarısız olsa da status geçişi başarılı kalmalı.
    }
  }

  return NextResponse.json(data);
}
