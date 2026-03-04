import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logTenantEvent } from "@/services/eventLog.service";
import { markAppointmentNoShow } from "@/services/noShow.service";

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
    .select("id, tenant_id, customer_phone, staff_id, slot_start, status, service_slug, extra_data, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "no_show") {
    await markAppointmentNoShow({
      appointmentId,
      tenantId,
      customerPhone: data.customer_phone,
      staffId: (data.staff_id as string | null | undefined) || null,
      source: "dashboard",
    }).catch((e) => console.error("[status] no-show side effects error:", e));
  }

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

    // Ciroya ekleme (idempotency: aynı randevu için çift kayıt engeli)
    const serviceSlug = data.service_slug as string | null | undefined;
    if (serviceSlug?.trim()) {
      const existingRevenue = await supabase
        .from("revenue_events")
        .select("id")
        .eq("appointment_id", appointmentId)
        .maybeSingle();

      if (!existingRevenue.error && !existingRevenue.data) {
        const { data: service } = await supabase
          .from("services")
          .select("price")
          .eq("tenant_id", tenantId)
          .eq("slug", serviceSlug.trim())
          .maybeSingle();

        const price = Number(service?.price ?? 0);
        if (price > 0) {
          const insertRes = await supabase.from("revenue_events").insert({
            tenant_id: tenantId,
            appointment_id: appointmentId,
            customer_phone: data.customer_phone,
            source: "appointment",
            gross_amount: price,
            discount_amount: 0,
            tax_amount: 0,
            net_amount: price,
            currency: "TRY",
            event_at: data.slot_start,
            meta: { ai_assisted: true },
          });
          if (insertRes.error) {
            console.error("[status] revenue_events insert error:", insertRes.error);
          }
        }
      }
    }
  }

  await logTenantEvent({
    tenantId,
    eventType: "appointment.status.updated",
    actor: "tenant",
    entityType: "appointment",
    entityId: appointmentId,
    payload: {
      status: body.status,
    },
  });

  return NextResponse.json(data);
}
