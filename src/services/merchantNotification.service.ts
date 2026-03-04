import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { createOpsAlert } from "@/services/opsAlert.service";
import { extractMissingSchemaColumn, extractMissingSchemaTable } from "@/lib/postgrest-schema";

type AppointmentSource = "bot" | "dashboard" | "cron" | "manual";

interface NotifyTarget {
  phone: string;
  kind: "business" | "staff";
  staffId?: string;
}

async function getTenantNotifyTargets(
  tenantId: string,
  staffId?: string | null
): Promise<{
  targets: NotifyTarget[];
  name: string;
}> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, owner_phone_e164, contact_phone")
    .eq("id", tenantId)
    .single();

  const tenantName = tenant?.name || "İşletme";
  const owner = (tenant?.owner_phone_e164 || "").trim();
  const contact = (tenant?.contact_phone || "").trim();
  const businessPhone = owner || contact;
  const targets: NotifyTarget[] = [];

  if (businessPhone) {
    targets.push({ phone: businessPhone, kind: "business" });
  }

  const scopedStaffId = (staffId || "").trim();
  if (scopedStaffId) {
    const staffRes = await supabase
      .from("staff")
      .select("id, phone_e164, active")
      .eq("tenant_id", tenantId)
      .eq("id", scopedStaffId)
      .eq("active", true)
      .maybeSingle();

    const missingTable = extractMissingSchemaTable(staffRes.error);
    const missingColumn = extractMissingSchemaColumn(staffRes.error);
    const missingPhoneColumn =
      missingColumn?.table === "staff" && missingColumn.column === "phone_e164";

    if (!staffRes.error || missingPhoneColumn || missingTable === "staff") {
      const staff = staffRes.data;
      const staffPhone = (staff?.phone_e164 || "").trim();
      if (staffPhone && staff) {
        targets.push({
          phone: staffPhone,
          kind: "staff",
          staffId: staff.id,
        });
      }
    } else {
      console.error("[merchant notify] staff lookup error:", staffRes.error.message);
    }
  }

  const deduped = Array.from(new Map(targets.map((target) => [target.phone, target])).values());
  return { targets: deduped, name: tenantName };
}

async function notifyTargets(
  tenantId: string,
  text: string,
  staffId?: string | null
): Promise<void> {
  const { targets } = await getTenantNotifyTargets(tenantId, staffId);
  for (const target of targets) {
    const delivery = await sendCustomerNotification(target.phone, text);
    if (!delivery.whatsapp && !delivery.sms) {
      console.warn("[merchant notify] delivery failed", {
        tenantId,
        to: target.phone,
        kind: target.kind,
      });
    }
  }
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
  staffId?: string | null;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, date, time, source, staffId } = params;
  const { name } = await getTenantNotifyTargets(tenantId, staffId);
  const dt = formatDateTimeTr(date, time);
  const text = `Yeni randevu! ${customerPhone} müşterisi ${dt} için ${name} işletmesinde randevu aldı.`;

  await notifyTargets(tenantId, text, staffId).catch((e) =>
    console.error("[merchant notify] new appointment notify error:", e)
  );

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
  staffId?: string | null;
  cancelledBy: "customer" | "tenant";
  reason?: string | null;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, date, time, staffId, cancelledBy, reason, source } = params;
  const dt = formatDateTimeTr(date, time);
  const who = cancelledBy === "customer" ? "Müşteri" : "İşletme";
  const text = `Randevu iptal edildi. ${who}: ${customerPhone} - ${dt}${reason ? ` (Neden: ${reason})` : ""}.`;

  await notifyTargets(tenantId, text, staffId).catch((e) =>
    console.error("[merchant notify] cancel notify error:", e)
  );

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
  staffId?: string | null;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, newDate, newTime, staffId, source } = params;
  const dt = formatDateTimeTr(newDate, newTime);
  const text = `Randevu saati değişti. ${customerPhone} müşterisi için yeni saat: ${dt}.`;

  await notifyTargets(tenantId, text, staffId).catch((e) =>
    console.error("[merchant notify] reschedule notify error:", e)
  );

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
  staffId?: string | null;
  source: AppointmentSource;
}): Promise<void> {
  const { tenantId, customerPhone, staffId, source } = params;
  const text = `No-show uyarısı: ${customerPhone} müşterisi randevuya gelmedi.`;

  await notifyTargets(tenantId, text, staffId).catch((e) =>
    console.error("[merchant notify] no_show notify error:", e)
  );

  // ops_alert no-show cron'da zaten oluşturuluyor; burada tekrar etmiyoruz.
  console.info("[merchant notify] no_show notification sent", {
    tenantId,
    customerPhone,
    source,
    staffId: staffId || null,
  });
}
