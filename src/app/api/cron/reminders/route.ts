import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const CRON_SECRET = process.env.CRON_SECRET || "saasrandevu_cron";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}` && request.nextUrl.searchParams.get("key") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start")
    .gte("slot_start", tomorrowStart.toISOString())
    .lte("slot_start", tomorrowEnd.toISOString())
    .eq("status", "confirmed");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const tenantIds = [...new Set((appointments || []).map((a) => a.tenant_id))];
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .in("id", tenantIds);
  const tenantMap = new Map((tenants || []).map((t) => [t.id, t.name]));

  for (const apt of appointments || []) {
    const slotDate = new Date(apt.slot_start);
    const timeStr = slotDate.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const tenantName = tenantMap.get(apt.tenant_id) || "İşletme";
    const message = `Merhaba, yarın ${timeStr}'da ${tenantName} için randevunuz var. Lütfen unutmayın!`;
    const ok = await sendWhatsAppMessage({
      to: apt.customer_phone,
      text: message,
    });
    if (ok) sent++;
  }

  return NextResponse.json({
    ok: true,
    total: appointments?.length || 0,
    sent,
  });
}
