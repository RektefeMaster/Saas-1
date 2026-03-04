import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { markAppointmentNoShow } from "@/services/noShow.service";

const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (
    auth !== `Bearer ${CRON_SECRET}` &&
    request.nextUrl.searchParams.get("key") !== CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, staff_id")
    .eq("status", "confirmed")
    .lt("slot_start", twoHoursAgo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ ok: true, marked: 0 });
  }

  const ids = appointments.map((a) => a.id);
  const { error: updateErr } = await supabase
    .from("appointments")
    .update({ status: "no_show" })
    .in("id", ids);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  for (const apt of appointments) {
    await markAppointmentNoShow({
      appointmentId: apt.id,
      tenantId: apt.tenant_id,
      customerPhone: apt.customer_phone,
      staffId: (apt.staff_id as string | null | undefined) || null,
      source: "cron/no-show",
    }).catch((e) => console.error("[cron/no-show] no-show side effects error:", e));
  }

  return NextResponse.json({ ok: true, marked: ids.length });
}
