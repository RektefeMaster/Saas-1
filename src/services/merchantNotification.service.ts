import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { createOpsAlert } from "@/services/opsAlert.service";

type AppointmentSource = "bot" | "dashboard" | "cron" | "manual";

async function getTenantNotifyPhone(tenantId: string): Promise<{
  phone: string | null;
  name: string;
}> {
  const { data } = await supabase
    .from("tenants")
    .select("name, owner_phone_e164, contact_phone")
    .eq("id", tenantId)
    .single();
  if (!data) {
    return { phone: null, name: "İşletme" };
  }
  const owner = (data.owner_phone_e164 || "").trim();
  const contact = (data.contact_phone || "").trim();
  const phone = owner || contact || null;
  return { phone, name: data.name || "İşletme" };
}

/** date: YYYY-MM-DD, time: HH:mm (Türkiye yerel). Çıktı: "DD.MM.YYYY HH:mm" */
function formatDateTimeTr(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh == null || mm == null) {
    return `${date} ${time}`;
  }
  const iso = `${date}T${time.padStart(5, "0").slice(0, 5)}:00+03:00`;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return `${date} ${time}`;
  const dateStr = dt.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

export async function notifyNewAppointmentForMerchant(params: {
  tenantId: string;
  customerPhone: string;
  date: string;
  time: string;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, date, time, source } = params;
  const { phone, name } = await getTenantNotifyPhone(tenantId);
  const dt = formatDateTimeTr(date, time);
  const text = `Yeni randevu! ${customerPhone} müşterisi ${dt} için ${name} işletmesinde randevu aldı.`;

  if (phone) {
    await sendWhatsAppMessage({ to: phone, text }).catch((e) =>
      console.error("[merchant notify] new appointment whatsapp error:", e)
    );
  }

  await createOpsAlert({
    tenantId,
    type: "system",
    severity: "low",
    customerPhone,
    message: `Yeni randevu (${dt}) - ${customerPhone}`,
    meta: { source, kind: "new_appointment", date, time },
  }).catch((e) => console.error("[merchant notify] new appointment ops_alert error:", e));
}

export async function notifyCancelledAppointmentForMerchant(params: {
  tenantId: string;
  customerPhone: string;
  date: string;
  time: string;
  cancelledBy: "customer" | "tenant";
  reason?: string | null;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, date, time, cancelledBy, reason, source } = params;
  const { phone } = await getTenantNotifyPhone(tenantId);
  const dt = formatDateTimeTr(date, time);
  const who = cancelledBy === "customer" ? "Müşteri" : "İşletme";
  const text = `Randevu iptal edildi. ${who}: ${customerPhone} - ${dt}${reason ? ` (Neden: ${reason})` : ""}.`;

  if (phone) {
    await sendWhatsAppMessage({ to: phone, text }).catch((e) =>
      console.error("[merchant notify] cancel whatsapp error:", e)
    );
  }

  await createOpsAlert({
    tenantId,
    type: "cancellation",
    severity: "medium",
    customerPhone,
    message: `Randevu iptal (${dt}) - ${customerPhone} (${who}).`,
    meta: { source, kind: "cancel", date, time, cancelledBy, reason: reason || null },
  }).catch((e) => console.error("[merchant notify] cancel ops_alert error:", e));
}

export async function notifyRescheduledAppointmentForMerchant(params: {
  tenantId: string;
  customerPhone: string;
  newDate: string;
  newTime: string;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, newDate, newTime, source } = params;
  const { phone } = await getTenantNotifyPhone(tenantId);
  const dt = formatDateTimeTr(newDate, newTime);
  const text = `Randevu saati değişti. ${customerPhone} müşterisi için yeni saat: ${dt}.`;

  if (phone) {
    await sendWhatsAppMessage({ to: phone, text }).catch((e) =>
      console.error("[merchant notify] reschedule whatsapp error:", e)
    );
  }

  await createOpsAlert({
    tenantId,
    type: "system",
    severity: "medium",
    customerPhone,
    message: `Randevu değişikliği (yeni saat ${dt}) - ${customerPhone}.`,
    meta: { source, kind: "reschedule", newDate, newTime },
  }).catch((e) => console.error("[merchant notify] reschedule ops_alert error:", e));
}

export async function notifyNoShowForMerchant(params: {
  tenantId: string;
  customerPhone: string;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, source } = params;
  const { phone } = await getTenantNotifyPhone(tenantId);
  if (!phone) return;
  const text = `No-show uyarısı: ${customerPhone} müşterisi randevuya gelmedi.`;

  await sendWhatsAppMessage({ to: phone, text }).catch((e) =>
    console.error("[merchant notify] no_show whatsapp error:", e)
  );

  // ops_alert no-show cron'da zaten oluşturuluyor; burada tekrar etmiyoruz.
  console.info("[merchant notify] no_show notification sent", { tenantId, customerPhone, source });
}

