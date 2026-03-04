/**
 * Çalışma saatleri (availability_slots) API
 * GET: Tenant'ın tüm günlük çalışma saatlerini döner
 * PUT: Tüm slotları günceller (body: { slots: [{ day_of_week, start_time, end_time }] })
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const DAY_NAMES: Record<number, string> = {
  0: "Pazar",
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staff_id");

  let query = supabase
    .from("availability_slots")
    .select("id, staff_id, day_of_week, start_time, end_time")
    .eq("tenant_id", tenantId);
  if (staffId) {
    query = query.eq("staff_id", staffId);
  } else {
    query = query.is("staff_id", null);
  }
  const { data, error } = await query.order("day_of_week");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const slots = (data || []).map((s) => ({
    ...s,
    day_name: DAY_NAMES[s.day_of_week] ?? `Gün ${s.day_of_week}`,
  }));

  return NextResponse.json(slots);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staff_id");
  const body = await request.json();
  const { slots } = body;

  if (!Array.isArray(slots)) {
    return NextResponse.json(
      { error: "slots dizisi gerekli" },
      { status: 400 }
    );
  }

  const valid = slots.every(
    (s: unknown) =>
      typeof s === "object" &&
      s !== null &&
      "day_of_week" in s &&
      "start_time" in s &&
      "end_time" in s &&
      typeof (s as { day_of_week: unknown }).day_of_week === "number" &&
      typeof (s as { start_time: unknown }).start_time === "string" &&
      typeof (s as { end_time: unknown }).end_time === "string"
  );

  if (!valid) {
    return NextResponse.json(
      { error: "Her slot: day_of_week (0-6), start_time (HH:MM), end_time (HH:MM)" },
      { status: 400 }
    );
  }

  const toInsert = slots
    .filter((s: { day_of_week: number }) => s.day_of_week >= 0 && s.day_of_week <= 6)
    .map((s: { day_of_week: number; start_time: string; end_time: string }) => ({
      tenant_id: tenantId,
      staff_id: staffId || null,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    }));

  let deleteQuery = supabase
    .from("availability_slots")
    .delete()
    .eq("tenant_id", tenantId);
  if (staffId) {
    deleteQuery = deleteQuery.eq("staff_id", staffId);
  } else {
    deleteQuery = deleteQuery.is("staff_id", null);
  }
  const { error: delError } = await deleteQuery;

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  if (toInsert.length > 0) {
    const { error: insError } = await supabase
      .from("availability_slots")
      .insert(toInsert);

    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }
  }

  let updatedQuery = supabase
    .from("availability_slots")
    .select("id, staff_id, day_of_week, start_time, end_time")
    .eq("tenant_id", tenantId);
  if (staffId) {
    updatedQuery = updatedQuery.eq("staff_id", staffId);
  } else {
    updatedQuery = updatedQuery.is("staff_id", null);
  }
  const { data: updated } = await updatedQuery.order("day_of_week");

  return NextResponse.json(
    (updated || []).map((s) => ({
      ...s,
      day_name: DAY_NAMES[s.day_of_week] ?? `Gün ${s.day_of_week}`,
    }))
  );
}
