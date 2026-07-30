import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { supabase } from "@/lib/supabase";
import { APP_TIMEZONE } from "@/lib/dayjs-utils";
import { sendCustomerNotification } from "@/lib/notify";
import { processNoShowBatch } from "@/services/noShowCron.service";
import {
  assertCronAuthorized,
  claimAppointmentExtraFlag,
  clearAppointmentExtraFlag,
} from "@/lib/cron-auth";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  // "Yarın" penceresi APP_TIMEZONE'a göre (Vercel UTC host local değil).
  const tomorrow = dayjs().tz(APP_TIMEZONE).add(1, "day").format("YYYY-MM-DD");
  const windowStartIso = dayjs.tz(`${tomorrow}T00:00:00`, APP_TIMEZONE).toISOString();
  const windowEndIso = dayjs.tz(`${tomorrow}T00:00:00`, APP_TIMEZONE).add(1, "day").toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start, extra_data")
    .gte("slot_start", windowStartIso)
    .lt("slot_start", windowEndIso)
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

  const tenantMap = new Map(
    (tenants || []).map((t) => [
      t.id,
      {
        name: t.name,
        timezone: (t.timezone as string)?.trim() || APP_TIMEZONE,
        reminder_preference:
          (t.config_override as Record<string, string>)?.reminder_preference ?? "customer_only",
      },
    ])
  );

  for (const apt of appointments || []) {
    const extra = (apt.extra_data as Record<string, unknown>) || {};
    if (typeof extra.reminder_2h_sent_at === "string") continue;

    const pref = tenantMap.get(apt.tenant_id)?.reminder_preference ?? "customer_only";
    if (pref === "off" || pref === "merchant_only") continue;

    const claim = await claimAppointmentExtraFlag(apt.id, extra, "reminder_2h_sent_at");
    if (!claim.claimed) continue;

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
    } else {
      await clearAppointmentExtraFlag(apt.id, extra, "reminder_2h_sent_at");
    }
  }

  let noShowMarked = 0;
  try {
    const noShowResult = await processNoShowBatch("cron/reminders");
    if (noShowResult.error) {
      console.error("[cron] no-show update error:", noShowResult.error);
    } else {
      noShowMarked = noShowResult.marked;
    }
  } catch (e) {
    console.error("[cron] no-show error:", e);
  }

  // CRM reminder dispatch (whatsapp / both)
  let crmReminderSent = 0;
  try {
    const stuckBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase
      .from("crm_reminders")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("status", "sending")
      .lt("updated_at", stuckBefore);

    const { data: crmReminders } = await supabase
      .from("crm_reminders")
      .select("id, customer_phone, title, note, channel")
      .eq("status", "pending")
      .lte("remind_at", new Date().toISOString())
      .in("channel", ["whatsapp", "both"])
      .limit(200);

    for (const reminder of crmReminders || []) {
      const { data: claimed, error: claimErr } = await supabase
        .from("crm_reminders")
        .update({
          status: "sending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) continue;

      const text = `Hatırlatma: ${reminder.title}${reminder.note ? `\n${reminder.note}` : ""}`;
      const delivery = await sendCustomerNotification(reminder.customer_phone, text);
      if (!delivery.whatsapp && !delivery.sms) {
        await supabase
          .from("crm_reminders")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", reminder.id)
          .eq("status", "sending");
        continue;
      }
      crmReminderSent++;
      await supabase
        .from("crm_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", reminder.id)
        .eq("status", "sending");
    }
  } catch (e) {
    console.error("[cron] crm-reminder error:", e);
  }

  return NextResponse.json({
    ok: true,
    reminders: { total: appointments?.length || 0, sent },
    noShowMarked,
    crmReminderSent,
  });
}
