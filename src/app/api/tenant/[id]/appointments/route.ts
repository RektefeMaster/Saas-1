import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { reserveAppointment } from "@/services/booking.service";
import { logTenantEvent } from "@/services/eventLog.service";

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
  const extraData =
    body.extra_data && typeof body.extra_data === "object" ? body.extra_data : {};

  if (!customerPhone || !slotStart) {
    return NextResponse.json(
      { error: "customer_phone ve slot_start gerekli" },
      { status: 400 }
    );
  }

  const parsed = new Date(slotStart);
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Geçersiz slot_start" }, { status: 400 });
  }

  const date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(parsed.getDate()).padStart(2, "0")}`;
  const time = `${String(parsed.getHours()).padStart(2, "0")}:${String(
    parsed.getMinutes()
  ).padStart(2, "0")}`;

  const booking = await reserveAppointment({
    tenantId: id,
    customerPhone,
    date,
    time,
    serviceSlug: serviceSlug || null,
    extraData,
  });

  if (!booking.ok) {
    const status =
      booking.error === "INVALID_DATE_OR_TIME"
        ? 400
        : booking.error === "SLOT_PROCESSING"
        ? 409
        : booking.error === "SLOT_TAKEN"
        ? 409
        : booking.error === "BLOCKED_DAY" ||
          booking.error === "CLOSED_DAY" ||
          booking.error === "NO_SCHEDULE"
        ? 422
        : 500;
    return NextResponse.json(
      {
        error: booking.error,
        suggested_time: booking.suggested_time,
      },
      { status }
    );
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", booking.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Randevu oluşturuldu ancak kayıt okunamadı." },
      { status: 500 }
    );
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

  await logTenantEvent({
    tenantId: id,
    eventType: "appointment.created",
    actor: "tenant",
    entityType: "appointment",
    entityId: String(data.id),
    payload: {
      customer_phone: data.customer_phone,
      slot_start: data.slot_start,
      service_slug: data.service_slug,
      source: "dashboard_api",
    },
  });

  return NextResponse.json(data);
}
