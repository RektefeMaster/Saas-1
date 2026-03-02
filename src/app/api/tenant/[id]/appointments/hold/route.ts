import { NextRequest, NextResponse } from "next/server";
import { reserveAppointment } from "@/services/booking.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      customer_phone?: string;
      date?: string;
      time?: string;
      service_slug?: string | null;
      hold_ttl_seconds?: number;
    };

    const customerPhone = body.customer_phone?.trim();
    const date = body.date?.trim();
    const time = body.time?.trim();

    if (!customerPhone || !date || !time) {
      return NextResponse.json(
        { error: "customer_phone, date ve time gerekli" },
        { status: 400 }
      );
    }

    const booking = await reserveAppointment({
      tenantId,
      customerPhone,
      date,
      time,
      serviceSlug: body.service_slug || null,
      holdOnly: true,
      holdTtlSeconds:
        typeof body.hold_ttl_seconds === "number" && body.hold_ttl_seconds > 0
          ? Math.min(300, Math.max(30, Math.floor(body.hold_ttl_seconds)))
          : undefined,
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
        { error: booking.error, suggested_time: booking.suggested_time },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      hold_expires_at: booking.hold_expires_at,
      duration_minutes: booking.duration_minutes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Hold oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
