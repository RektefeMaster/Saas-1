/**
 * GET /api/tenant/:id/availability?date=YYYY-MM-DD
 * Seçilen gün için müsait / dolu saatleri döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkBlockedDate } from "@/services/blockedDates.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

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

  const blocked = await checkBlockedDate(tenantId, dateStr);
  if (blocked) {
    return NextResponse.json({
      date: dateStr,
      blocked: true,
      available: [],
      booked: [],
      workingHours: null,
    });
  }

  const { data: slots } = await supabase
    .from("availability_slots")
    .select("day_of_week, start_time, end_time")
    .eq("tenant_id", tenantId);

  let startTime: string | undefined;
  let endTime: string | undefined;

  const dayOfWeek = date.getDay();
  if (slots && slots.length > 0) {
    const daySlot = slots.find((s) => s.day_of_week === dayOfWeek);
    if (!daySlot) {
      return NextResponse.json({
        date: dateStr,
        blocked: false,
        available: [],
        booked: [],
        workingHours: null,
        noSchedule: true,
      });
    }
    startTime = daySlot.start_time;
    endTime = daySlot.end_time;
  } else {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("config_override")
      .eq("id", tenantId)
      .single();
    const defaultHours = (tenant?.config_override as { default_working_hours?: { start?: string; end?: string } })
      ?.default_working_hours;
    if (defaultHours?.start && defaultHours?.end) {
      startTime = defaultHours.start;
      endTime = defaultHours.end;
    } else {
      return NextResponse.json({
        date: dateStr,
        blocked: false,
        available: [],
        booked: [],
        workingHours: null,
        noSchedule: true,
      });
    }
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, slot_start, customer_phone")
    .eq("tenant_id", tenantId)
    .gte("slot_start", `${dateStr}T00:00:00`)
    .lt("slot_start", `${dateStr}T23:59:59`)
    .not("status", "in", "('cancelled')");

  const booked = (appointments || []).map((a) => {
    const d = new Date(a.slot_start);
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { time, customer_phone: a.customer_phone, id: a.id };
  });

  const bookedTimes = booked.map((b) => b.time);

  const [startH, startM] = startTime!.split(":").map(Number);
  const [endH, endM] = endTime!.split(":").map(Number);
  const available: string[] = [];
  for (let h = startH; h < endH || (h === endH && startM < endM); h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h < startH || (h === startH && m < startM)) continue;
      if (h > endH || (h === endH && m >= endM)) break;
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (!bookedTimes.includes(time)) available.push(time);
    }
  }

  booked.sort((a, b) => a.time.localeCompare(b.time));

  return NextResponse.json({
    date: dateStr,
    blocked: false,
    available,
    booked,
    workingHours: { start: startTime, end: endTime },
  });
}
