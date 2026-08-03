import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { createOpsAlert } from "@/services/opsAlert.service";
import { extractMissingSchemaColumn, extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { phonesMatch } from "@/lib/phone";

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

/**
 * İşletme bildirimi asla müşteri sohbetine düşmemeli.
 * İşletme sahibi/personel kendi numarasından bota yazdığında (ya da test
 * kurulumunda sahip numarası müşteri numarasıyla aynı olduğunda) müşteriye
 * "Yeni randevu! +90... müşterisi randevu aldı" gibi iç mesajlar gidiyordu.
 */
function excludeCustomerPhone(
  targets: NotifyTarget[],
  customerPhone?: string | null
): NotifyTarget[] {
  const phone = (customerPhone || "").trim();
  if (!phone) return targets;
  return targets.filter((target) => {
    if (!phonesMatch(target.phone, phone)) return true;
    console.info("[merchant notify] skipped: target equals customer phone", {
      kind: target.kind,
    });
    return false;
  });
}

async function notifyTargets(
  tenantId: string,
  text: string,
  staffId?: string | null,
  preloaded?: { targets: NotifyTarget[]; name: string },
  customerPhone?: string | null
): Promise<void> {
  const loaded = preloaded || (await getTenantNotifyTargets(tenantId, staffId));
  const targets = excludeCustomerPhone(loaded.targets, customerPhone);
  await Promise.all(
    targets.map(async (target) => {
      // İşletme sahibi/personel bildirimi: bilerek ortak numaradan. İşletmenin
      // kendi numarası bağlıysa oradan göndermek, numaranın kendi kendine
      // mesaj atması riskini doğurur. Bu bir platform bildirimidir.
      const delivery = await sendCustomerNotification(target.phone, text);
      if (!delivery.whatsapp && !delivery.sms) {
        console.warn("[merchant notify] delivery failed", {
          tenantId,
          to: target.phone,
          kind: target.kind,
        });
      }
    })
  );
}

/** date: YYYY-MM-DD, time: HH:mm (zaten tenant timezone'da). Çıktı: "DD.MM.YYYY HH:mm" */
function formatDateTimeTr(date: string, time: string): string {
  const parts = date.split("-");
  const timeParts = time.split(":");
  if (parts.length < 3 || timeParts.length < 2) return `${date} ${time}`;
  const [y, m, d] = parts.map(Number);
  const [hh, mm] = timeParts.map(Number);
  if (!y || !m || !d || hh == null || mm == null) return `${date} ${time}`;
  const d2 = String(d).padStart(2, "0");
  const m2 = String(m).padStart(2, "0");
  const h2 = String(hh).padStart(2, "0");
  const min2 = String(mm).padStart(2, "0");
  return `${d2}.${m2}.${y} ${h2}:${min2}`;
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
  const loaded = await getTenantNotifyTargets(tenantId, staffId);
  const dt = formatDateTimeTr(date, time);
  const text = `Yeni randevu! ${customerPhone} müşterisi ${dt} için ${loaded.name} işletmesinde randevu aldı.`;

  await Promise.allSettled([
    notifyTargets(tenantId, text, staffId, loaded, customerPhone),
    createOpsAlert({
      tenantId,
      type: "system",
      severity: "low",
      customerPhone,
      message: `Yeni randevu (${dt}) - ${customerPhone}`,
      meta: { source, kind: "new_appointment", date, time },
    }),
  ]);
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

  await notifyTargets(tenantId, text, staffId, undefined, customerPhone).catch((e) =>
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

  await notifyTargets(tenantId, text, staffId, undefined, customerPhone).catch((e) =>
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

  await notifyTargets(tenantId, text, staffId, undefined, customerPhone).catch((e) =>
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
