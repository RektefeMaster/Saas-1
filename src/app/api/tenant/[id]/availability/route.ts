/**
 * GET /api/tenant/:id/availability?date=YYYY-MM-DD
 * Seçilen gün için müsait / dolu saatleri döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDailyAvailability } from "@/services/booking.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const serviceSlug = searchParams.get("service_slug");
  const customerPhone = searchParams.get("customer_phone");

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: "date parametresi YYYY-MM-DD formatında gerekli" },
      { status: 400 }
    );
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Geçersiz tarih" }, { status: 400 });
  }

  const daily = await getDailyAvailability(tenantId, dateStr, {
    serviceSlug: serviceSlug || undefined,
    customerPhone: customerPhone || undefined,
  });

  return NextResponse.json({
    date: daily.date,
    blocked: Boolean(daily.blocked),
    closed: Boolean(daily.closed),
    noSchedule: Boolean(daily.noSchedule),
    available: daily.available,
    booked: daily.booked.map((time) => ({ time })),
    workingHours: daily.workingHours,
    duration_minutes: daily.durationMinutes,
  });
}
