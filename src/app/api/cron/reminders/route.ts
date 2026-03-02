import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp";
import { incrementNoShow } from "@/services/blacklist.service";
import { createOpsAlert } from "@/services/opsAlert.service";

const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";
const REMINDER_TEMPLATE_NAME = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME?.trim() || "";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "tr";

async function sendReminderWithBestChannel(
  to: string,
  tenantName: string,
  dateText: string,
  timeText: string
): Promise<boolean> {
  if (REMINDER_TEMPLATE_NAME) {
    const ok = await sendWhatsAppTemplateMessage({
      to,
      templateName: REMINDER_TEMPLATE_NAME,
      languageCode: TEMPLATE_LANG,
      bodyParams: [tenantName, dateText, timeText],
    });
    if (ok) return true;
  }

  const fallbackText = `Merhaba, ${dateText} günü ${timeText}'da ${tenantName} için randevunuz var. Lütfen unutmayın!`;
  const delivery = await sendCustomerNotification(to, fallbackText);
  return delivery.whatsapp || delivery.sms;
}

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  }

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
    const dateStr = slotDate.toLocaleDateString("tr-TR");
    const tenantName = tenantMap.get(apt.tenant_id)?.name || "İşletme";
    const ok = await sendReminderWithBestChannel(
      apt.customer_phone,
      tenantName,
      dateStr,
      timeStr
    );
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
      const { error: noShowUpdateError } = await supabase
        .from("appointments")
        .update({ status: "no_show" })
        .in("id", noShowApts.map((a) => a.id));
      if (noShowUpdateError) {
        console.error("[cron] no-show update error:", noShowUpdateError.message);
      } else {
      noShowMarked = noShowApts.length;
      for (const apt of noShowApts) {
        await incrementNoShow(apt.tenant_id, apt.customer_phone).catch((e) =>
          console.error("[cron] blacklist increment error:", e)
        );
        await createOpsAlert({
          tenantId: apt.tenant_id,
          type: "no_show",
          severity: "high",
          customerPhone: apt.customer_phone,
          message: `${apt.customer_phone} müşterisi randevuya gelmedi (no-show).`,
          meta: { appointment_id: apt.id, source: "cron/reminders" },
          dedupeKey: `no_show:${apt.id}`,
        }).catch((e) => console.error("[cron] ops alert error:", e));
      }
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
        const delivery = await sendCustomerNotification(
          apt.customer_phone,
          "Merhaba! Bugünkü randevunuz nasıldı? 1-5 arası puan verir misiniz? ⭐"
        );
        if (delivery.whatsapp || delivery.sms) reviewSent++;
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
      const delivery = await sendCustomerNotification(reminder.customer_phone, text);
      if (!delivery.whatsapp && !delivery.sms) continue;
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
