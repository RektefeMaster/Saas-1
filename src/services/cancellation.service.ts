/**
 * Randevu iptal servisi
 * cancel_appointment: Randevuyu iptal eder, esnafa bildirim gönderir
 */

import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { notifyCancelledAppointmentForMerchant } from "@/services/merchantNotification.service";
import { phoneVariants, phonesMatch } from "@/lib/phone";

const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";

export type CancelledBy = "customer" | "tenant";

export interface CancelAppointmentParams {
  tenantId: string;
  appointmentId: string;
  cancelledBy: CancelledBy;
  reason?: string;
  /** Required when cancelledBy=customer (ownership check). */
  customerPhone?: string;
  /** İptal tetikleyen kaynak (esnaf bildirimi meta için). */
  source?: "bot" | "dashboard" | "cron" | "manual";
}

/**
 * Randevuyu iptal eder.
 * status=cancelled, cancelled_at, cancelled_by, cancellation_reason güncellenir.
 * Müşteriye onay mesajı, esnafa bildirim gönderilir.
 *
 * @param params - tenantId, appointmentId, cancelledBy, reason (opsiyonel)
 * @returns { ok, error? }
 *
 * @example
 * await cancelAppointment({ tenantId: "x", appointmentId: "y", cancelledBy: "customer" });
 */
export async function cancelAppointment(params: CancelAppointmentParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const { tenantId, appointmentId, cancelledBy, reason, customerPhone } = params;

    const { data: apt, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, tenant_id, customer_phone, slot_start, staff_id, status")
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !apt) {
      return { ok: false, error: "Randevu bulunamadı" };
    }

    if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "no_show") {
      return { ok: false, error: "Randevu zaten kapatılmış" };
    }

    if (cancelledBy === "customer") {
      if (!customerPhone || !phonesMatch(customerPhone, apt.customer_phone)) {
        return { ok: false, error: "Bu randevu için iptal yetkiniz yok" };
      }
    }

    const { data: updatedRows, error: updateErr } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason || null,
      })
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "pending"])
      .select("id");

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }
    if (!updatedRows?.length) {
      return { ok: false, error: "Randevu durumu iptal için uygun değil" };
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, timezone")
      .eq("id", tenantId)
      .single();

    const tenantName = tenant?.name || "İşletme";
    const tz = (tenant?.timezone as string)?.trim() || APP_TIMEZONE;

    const slotDate = new Date(apt.slot_start);
    const dateStr = slotDate.toLocaleDateString("tr-TR", { timeZone: tz });
    const timeStr = slotDate.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });
    const dateIso = slotDate.toLocaleDateString("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeIso = slotDate.toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const customerMessage = `${tenantName} randevunuz (${dateStr} ${timeStr}) iptal edildi. Başka bir saate almak ister misiniz?`;
    // Fire-and-forget: do not block bot/API reply on WhatsApp/SMS RTT.
    void sendCustomerNotification(apt.customer_phone, customerMessage).catch((e) =>
      console.error("[cancelAppointment] customer notify error:", e)
    );

    void notifyCancelledAppointmentForMerchant({
      tenantId,
      customerPhone: apt.customer_phone,
      date: dateIso,
      time: timeIso,
      staffId: (apt.staff_id as string | null | undefined) || null,
      cancelledBy,
      reason: reason || null,
      source: params.source ?? "bot",
    }).catch((e) => console.error("[cancelAppointment] merchant notify error:", e));

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "İptal işlemi başarısız";
    return { ok: false, error: msg };
  }
}

/**
 * Müşterinin son aktif (confirmed/pending) randevusunu döndürür.
 *
 * @param tenantId - Tenant ID
 * @param customerPhone - Müşteri telefonu (+90...)
 * @returns Randevu veya null
 */
export async function getCustomerLastActiveAppointment(
  tenantId: string,
  customerPhone: string
): Promise<{ id: string; slot_start: string } | null> {
  const variants = phoneVariants(customerPhone);
  if (variants.length === 0) return null;

  const { data, error } = await supabase
    .from("appointments")
    .select("id, slot_start, customer_phone")
    .eq("tenant_id", tenantId)
    .in("customer_phone", variants)
    .in("status", ["confirmed", "pending"])
    .gte("slot_start", new Date().toISOString())
    .order("slot_start", { ascending: true })
    .limit(5);

  if (error || !data?.length) return null;
  const match = data.find((row) => phonesMatch(customerPhone, row.customer_phone)) || data[0];
  return { id: match.id, slot_start: match.slot_start };
}
