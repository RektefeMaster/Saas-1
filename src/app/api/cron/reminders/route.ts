import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { markAppointmentNoShow } from "@/services/noShow.service";

const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";

async function sendReminder(
  to: string,
  tenantName: string,
  dateText: string,
  timeText: string
): Promise<boolean> {
  const text = `Merhaba, ${dateText} günü ${timeText}'da ${tenantName} için randevunuz var. Lütfen unutmayın! İptal etmek isterseniz "iptal" yazabilirsiniz.`;
  const delivery = await sendCustomerNotification(to, text);
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
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() + 1);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start, extra_data")
    .gte("slot_start", windowStart.toISOString())
    .lte("slot_start", windowEnd.toISOString())
    .eq("status", "confirmed");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const tenantIds = [...new Set((appointments || []).map((a) => a.tenant_id))];
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, timezone, config_override")
    .in("id", tenantIds);

  const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";
  const tenantMap = new Map(
    (tenants || []).map((t) => [
      t.id,
      {
        name: t.name,
        timezone: (t.timezone as string)?.trim() || APP_TIMEZONE,
        reminder_preference: (t.config_override as Record<string, string>)?.reminder_preference ?? "customer_only",
      },
    ])
  );

  for (const apt of appointments || []) {
    const extra = (apt.extra_data as Record<string, unknown>) || {};
    if (typeof extra.reminder_2h_sent_at === "string") continue;

    const pref = tenantMap.get(apt.tenant_id)?.reminder_preference ?? "customer_only";
    if (pref === "off" || pref === "merchant_only") continue;

    const tz = tenantMap.get(apt.tenant_id)?.timezone ?? APP_TIMEZONE;
    const slotDate = new Date(apt.slot_start);
    const timeStr = slotDate.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
    const dateStr = slotDate.toLocaleDateString("tr-TR", {
      timeZone: tz,
    });
    const tenantName = tenantMap.get(apt.tenant_id)?.name || "İşletme";
    const ok = await sendReminder(apt.customer_phone, tenantName, dateStr, timeStr);
    if (ok) {
      sent++;
      await supabase
        .from("appointments")
        .update({
          extra_data: { ...extra, reminder_2h_sent_at: new Date().toISOString() },
        })
        .eq("id", apt.id);
    }
  }

  // No-show: 2+ saat geçmiş confirmed randevuları no_show yap
  let noShowMarked = 0;
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: noShowApts } = await supabase
      .from("appointments")
      .select("id, tenant_id, customer_phone, staff_id")
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
          await markAppointmentNoShow({
            appointmentId: apt.id,
            tenantId: apt.tenant_id,
            customerPhone: apt.customer_phone,
            staffId: (apt.staff_id as string | null | undefined) || null,
            source: "cron/reminders",
          }).catch((e) => console.error("[cron] no-show side effects error:", e));
        }
      }
    }
  } catch (e) {
    console.error("[cron] no-show error:", e);
  }

  // Review reminder akışı tek kaynak olarak /api/cron/review-reminder endpoint'ine taşındı.
  // Bu endpoint artık yalnızca hatırlatma/no-show/CRM işlerini çalıştırır.

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
    reviewSent: 0,
    reviewSkippedService: 0,
    reviewReminderRoute: "/api/cron/review-reminder",
    crmReminderSent,
  });
}
