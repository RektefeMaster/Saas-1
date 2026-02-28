/**
 * Randevu iptal API
 * POST /api/tenant/:id/cancel
 * Body: { appointment_id, cancelled_by, reason? }
 */

import { NextRequest, NextResponse } from "next/server";
import { cancelAppointment } from "@/services/cancellation.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { appointment_id, cancelled_by, reason } = body;

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

    const result = await cancelAppointment({
      tenantId: id,
      appointmentId: appointment_id,
      cancelledBy: cancelled_by as "customer" | "tenant",
      reason,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[cancel POST]", err);
    return NextResponse.json({ error: "İptal başarısız" }, { status: 500 });
  }
}
