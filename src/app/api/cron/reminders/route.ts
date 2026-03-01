import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { incrementNoShow } from "@/services/blacklist.service";

const CRON_SECRET = process.env.CRON_SECRET || "ahi_ai_cron";

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
    .select("id, name, config_override")
    .in("id", tenantIds);

  const tenantMap = new Map(
    (tenants || []).map((t) => [
      t.id,
      {
        name: t.name,
        reminder_preference: (t.config_override as Record<string, string>)?.reminder_preference ?? "customer_only",
      },
    ])
  );

  for (const apt of appointments || []) {
    const pref = tenantMap.get(apt.tenant_id)?.reminder_preference ?? "customer_only";
    if (pref === "off" || pref === "merchant_only") continue;

    const slotDate = new Date(apt.slot_start);
    const timeStr = slotDate.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const tenantName = tenantMap.get(apt.tenant_id)?.name || "İşletme";
    const message = `Merhaba, yarın ${timeStr}'da ${tenantName} için randevunuz var. Lütfen unutmayın!`;
    const ok = await sendWhatsAppMessage({
      to: apt.customer_phone,
      text: message,
    });
    if (ok) sent++;
  }

  // No-show: 2+ saat geçmiş confirmed randevuları no_show yap
  let noShowMarked = 0;
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: noShowApts } = await supabase
      .from("appointments")
      .select("id, tenant_id, customer_phone")
      .eq("status", "confirmed")
      .lt("slot_start", twoHoursAgo);
    if (noShowApts && noShowApts.length > 0) {
      await supabase
        .from("appointments")
        .update({ status: "no_show" })
        .in("id", noShowApts.map((a) => a.id));
      noShowMarked = noShowApts.length;
      for (const apt of noShowApts) {
        await incrementNoShow(apt.tenant_id, apt.customer_phone).catch((e) =>
          console.error("[cron] blacklist increment error:", e)
        );
      }
    }
  } catch (e) {
    console.error("[cron] no-show error:", e);
  }

  // Review reminder: 1 saat geçmiş, completed/confirmed, review'u olmayan randevular
  let reviewSent = 0;
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: reviewApts } = await supabase
      .from("appointments")
      .select("id, tenant_id, customer_phone")
      .in("status", ["completed", "confirmed"])
      .lt("slot_start", oneHourAgo)
      .gte("slot_start", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (reviewApts) {
      const { data: existingReviews } = await supabase
        .from("reviews")
        .select("appointment_id")
        .in("appointment_id", reviewApts.map((a) => a.id));
      const reviewedIds = new Set((existingReviews || []).map((r) => r.appointment_id));
      for (const apt of reviewApts) {
        if (reviewedIds.has(apt.id)) continue;
        const ok = await sendWhatsAppMessage({
          to: apt.customer_phone,
          text: "Merhaba! Bugünkü randevunuz nasıldı? 1-5 arası puan verir misiniz? ⭐",
        });
        if (ok) reviewSent++;
      }
    }
  } catch (e) {
    console.error("[cron] review-reminder error:", e);
  }

  // CRM reminder dispatch (whatsapp / both)
  let crmReminderSent = 0;
  try {
    const { data: crmReminders } = await supabase
      .from("crm_reminders")
      .select("id, customer_phone, title, note, channel")
      .eq("status", "pending")
      .lte("remind_at", new Date().toISOString())
      .in("channel", ["whatsapp", "both"])
      .limit(200);

    for (const reminder of crmReminders || []) {
      const text = `Hatırlatma: ${reminder.title}${reminder.note ? `\n${reminder.note}` : ""}`;
      const ok = await sendWhatsAppMessage({
        to: reminder.customer_phone,
        text,
      });
      if (!ok) continue;
      crmReminderSent++;
      await supabase
        .from("crm_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);
    }
  } catch (e) {
    console.error("[cron] crm-reminder error:", e);
  }

  return NextResponse.json({
    ok: true,
    reminders: { total: appointments?.length || 0, sent },
    noShowMarked,
    reviewSent,
    crmReminderSent,
  });
}
