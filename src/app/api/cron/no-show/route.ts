import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { incrementNoShow } from "@/services/blacklist.service";

const CRON_SECRET = process.env.CRON_SECRET || "ahi_ai_cron";

export async function GET(request: NextRequest) {
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
    .select("id, tenant_id, customer_phone")
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
    await incrementNoShow(apt.tenant_id, apt.customer_phone).catch((e) =>
      console.error("[cron/no-show] blacklist increment error:", e)
    );
  }

  return NextResponse.json({ ok: true, marked: ids.length });
}
