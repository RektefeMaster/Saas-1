import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const STATUS_ORDER = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `${date}T00:00:00`
      : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const to =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `${date}T23:59:59`
      : new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, customer_phone, slot_start, status, service_slug, extra_data")
    .eq("tenant_id", tenantId)
    .gte("slot_start", from)
    .lte("slot_start", to)
    .order("slot_start", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = STATUS_ORDER.reduce<Record<string, unknown[]>>((acc, status) => {
    acc[status] = [];
    return acc;
  }, {});

  for (const appointment of data ?? []) {
    const status = STATUS_ORDER.includes(appointment.status as (typeof STATUS_ORDER)[number])
      ? appointment.status
      : "pending";
    grouped[status].push(appointment);
  }

  return NextResponse.json({
    date: date ?? new Date().toISOString().slice(0, 10),
    statuses: grouped,
  });
}
