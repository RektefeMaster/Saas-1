/**
 * No-show işlemleri için ortak servis.
 * Randevu no-show olarak işaretlendiğinde: blacklist artırma, ops alert, merchant bildirimi.
 */
import { incrementNoShow } from "@/services/blacklist.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import { notifyNoShowForMerchant } from "@/services/merchantNotification.service";

export type NoShowSource = "cron" | "cron/reminders" | "cron/no-show" | "dashboard";

export interface MarkNoShowParams {
  appointmentId: string;
  tenantId: string;
  customerPhone: string;
  staffId?: string | null;
  source: NoShowSource;
}

/**
 * Randevu no-show olarak işaretlendiğinde tüm yan etkileri uygular:
 * - incrementNoShow (blacklist)
 * - createOpsAlert
 * - notifyNoShowForMerchant (WhatsApp/SMS)
 */
export async function markAppointmentNoShow(params: MarkNoShowParams): Promise<void> {
  const { appointmentId, tenantId, customerPhone, staffId, source } = params;

  await incrementNoShow(tenantId, customerPhone).catch((e) =>
    console.error(`[noShow] blacklist increment error (${source}):`, e)
  );

  await createOpsAlert({
    tenantId,
    type: "no_show",
    severity: "high",
    customerPhone,
    message: `${customerPhone} müşterisi randevuya gelmedi (no-show).`,
    meta: { appointment_id: appointmentId, source },
    dedupeKey: `no_show:${appointmentId}`,
  }).catch((e) => console.error(`[noShow] ops alert error (${source}):`, e));

  const notifySource = source === "dashboard" ? "dashboard" : "cron";
  await notifyNoShowForMerchant({
    tenantId,
    customerPhone,
    staffId: staffId || null,
    source: notifySource,
  }).catch((e) => console.error(`[noShow] merchant notify error (${source}):`, e));
}
