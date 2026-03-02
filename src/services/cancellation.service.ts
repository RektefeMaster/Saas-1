/**
 * Randevu iptal servisi
 * cancel_appointment: Randevuyu iptal eder, esnafa bildirim gönderir
 */

import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";

export type CancelledBy = "customer" | "tenant";

export interface CancelAppointmentParams {
  tenantId: string;
  appointmentId: string;
  cancelledBy: CancelledBy;
  reason?: string;
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
    const { tenantId, appointmentId, cancelledBy, reason } = params;

    const { data: apt, error: fetchErr } = await supabase
      .from("appointments")
      .select("id, tenant_id, customer_phone, slot_start")
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !apt) {
      return { ok: false, error: "Randevu bulunamadı" };
    }

    const { error: updateErr } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason || null,
      })
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    const slotDate = new Date(apt.slot_start);
    const dateStr = slotDate.toLocaleDateString("tr-TR");
    const timeStr = slotDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const tenantName = tenant?.name || "İşletme";

    const customerMessage = `${tenantName} randevunuz (${dateStr} ${timeStr}) iptal edildi. Başka bir saate almak ister misiniz?`;
    await sendCustomerNotification(apt.customer_phone, customerMessage);

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
  const { data, error } = await supabase
    .from("appointments")
    .select("id, slot_start")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .in("status", ["confirmed", "pending"])
    .gte("slot_start", new Date().toISOString())
    .order("slot_start", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/*
 * Örnek kullanım:
 *
 * const result = await cancelAppointment({
 *   tenantId: "uuid",
 *   appointmentId: "apt-uuid",
 *   cancelledBy: "customer",
 *   reason: "Plan değişikliği"
 * });
 *
 * const lastApt = await getCustomerLastActiveAppointment(tenantId, customerPhone);
 * if (lastApt) { ... }
 */
