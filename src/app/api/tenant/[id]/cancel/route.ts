/**
 * Randevu iptal API
 * POST /api/tenant/:id/cancel
 * Body: { appointment_id, cancelled_by, reason? }
 */

import { NextRequest, NextResponse } from "next/server";
import { cancelAppointment } from "@/services/cancellation.service";
import { logTenantEvent } from "@/services/eventLog.service";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { notifyWaitlist } from "@/services/waitlist.service";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireTenantApiAccess(request, id);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { appointment_id, cancelled_by, reason, customer_phone } = body;

    if (!appointment_id || !cancelled_by) {
      return NextResponse.json(
        { error: "appointment_id ve cancelled_by gerekli" },
        { status: 400 }
      );
    }

    if (!["customer", "tenant"].includes(cancelled_by)) {
      return NextResponse.json(
        { error: "cancelled_by: customer veya tenant olmalı" },
        { status: 400 }
      );
    }

    if (cancelled_by === "customer" && !customer_phone) {
      return NextResponse.json(
        { error: "customer_phone gerekli (müşteri iptali)" },
        { status: 400 }
      );
    }

    const result = await cancelAppointment({
      tenantId: id,
      appointmentId: appointment_id,
      cancelledBy: cancelled_by as "customer" | "tenant",
      customerPhone: typeof customer_phone === "string" ? customer_phone : undefined,
      reason,
      source: cancelled_by === "tenant" ? "dashboard" : "manual",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logTenantEvent({
      tenantId: id,
      eventType: "appointment.cancelled",
      actor: cancelled_by,
      entityType: "appointment",
      entityId: appointment_id,
      payload: {
        reason: reason || null,
        source: "cancel_api",
      },
    });

    // Notify waitlist after a slot is freed (same behavior as bot cancel path).
    void (async () => {
      const { data: apt } = await supabase
        .from("appointments")
        .select("slot_start")
        .eq("id", appointment_id)
        .eq("tenant_id", id)
        .maybeSingle();
      if (!apt?.slot_start) return;
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, timezone")
        .eq("id", id)
        .maybeSingle();
      const tz =
        (tenant?.timezone as string)?.trim() ||
        process.env.APP_TIMEZONE?.trim() ||
        "Europe/Istanbul";
      const dateStr = new Date(apt.slot_start).toLocaleDateString("en-CA", {
        timeZone: tz,
      });
      await notifyWaitlist(id, dateStr, tenant?.name || "İşletme");
    })().catch((e) => console.error("[cancel] waitlist notify error:", e));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cancel POST]", err);
    return NextResponse.json({ error: "İptal başarısız" }, { status: 500 });
  }
}
