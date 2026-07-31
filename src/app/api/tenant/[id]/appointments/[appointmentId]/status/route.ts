import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logTenantEvent } from "@/services/eventLog.service";
import { markAppointmentNoShow } from "@/services/noShow.service";
import { cancelAppointment } from "@/services/cancellation.service";
import { notifyWaitlist } from "@/services/waitlist.service";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";

const VALID_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
type AppointmentStatus = (typeof VALID_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled", "completed", "no_show"],
  confirmed: ["completed", "cancelled", "no_show", "pending"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; appointmentId: string }> }
) {
  const { id: tenantId, appointmentId } = await params;
  const auth = await requireTenantApiAccess(request, tenantId);
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status as AppointmentStatus)) {
    return NextResponse.json(
      { error: `status geçersiz. (${VALID_STATUSES.join(", ")})` },
      { status: 400 }
    );
  }
  const nextStatus = body.status as AppointmentStatus;

  const { data: current, error: fetchError } = await supabase
    .from("appointments")
    .select(
      "id, tenant_id, customer_phone, staff_id, slot_start, status, service_slug, extra_data, updated_at, cancelled_at, cancelled_by"
    )
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Randevu bulunamadı" }, { status: 404 });
  }

  const currentStatus = current.status as AppointmentStatus;
  if (currentStatus === nextStatus) {
    return NextResponse.json(current);
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      { error: `${currentStatus} → ${nextStatus} geçişine izin yok` },
      { status: 400 }
    );
  }

  if (nextStatus === "cancelled") {
    const cancelResult = await cancelAppointment({
      tenantId,
      appointmentId,
      cancelledBy: "tenant",
      source: "dashboard",
    });
    if (!cancelResult.ok) {
      return NextResponse.json(
        { error: cancelResult.error || "İptal başarısız" },
        { status: 409 }
      );
    }

    const { data: cancelled } = await supabase
      .from("appointments")
      .select(
        "id, tenant_id, customer_phone, staff_id, slot_start, status, service_slug, extra_data, updated_at"
      )
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .single();

    void (async () => {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, timezone")
        .eq("id", tenantId)
        .maybeSingle();
      const tz =
        (tenant?.timezone as string)?.trim() ||
        process.env.APP_TIMEZONE?.trim() ||
        "Europe/Istanbul";
      const dateStr = new Date(current.slot_start).toLocaleDateString("en-CA", {
        timeZone: tz,
      });
      // Müsaitlik, bekleyen her müşterinin kendi hizmet süresine göre
      // notifyWaitlist içinde hesaplanır.
      await notifyWaitlist(tenantId, dateStr, tenant?.name || "İşletme");
    })().catch((e) => console.error("[status] waitlist notify error:", e));

    await logTenantEvent({
      tenantId,
      actor: auth.actor === "admin" ? "admin" : "owner",
      eventType: "appointment.status_changed",
      entityType: "appointment",
      entityId: appointmentId,
      payload: { from: currentStatus, to: nextStatus, via: "cancelAppointment" },
    }).catch(() => undefined);

    return NextResponse.json(cancelled || { id: appointmentId, status: "cancelled" });
  }

  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .eq("status", currentStatus)
    .select(
      "id, tenant_id, customer_phone, staff_id, slot_start, status, service_slug, extra_data, updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (nextStatus === "no_show") {
    await markAppointmentNoShow({
      appointmentId,
      tenantId,
      customerPhone: data.customer_phone,
      staffId: (data.staff_id as string | null | undefined) || null,
      source: "dashboard",
    }).catch((e) => console.error("[status] no-show side effects error:", e));
  }

  // Visit++ only on first transition into completed.
  if (nextStatus === "completed" && currentStatus !== "completed") {
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
      status: nextStatus,
      from: currentStatus,
    },
  });

  return NextResponse.json(data);
}
