/**
 * Müşteri geçmişi servisi
 * get_customer_history: Son randevuları LLM prompt'a özet olarak eklemek için
 */

import { supabase } from "@/lib/supabase";

export interface HistoryItem {
  date: string;
  service: string | null;
  status: string;
}

/**
 * Müşterinin son 5 randevusunu döndürür.
 * LLM'e gönderilecek özet için kullanılır.
 *
 * @param tenantId - Tenant ID
 * @param customerPhone - Müşteri telefonu
 * @returns HistoryItem[] (max 5)
 *
 * @example
 * const history = await getCustomerHistory(tenantId, "+905551234567");
 * // Özet: "Saç boyama (3 Ocak), Saç kesimi (15 Aralık)"
 */
export async function getCustomerHistory(
  tenantId: string,
  customerPhone: string
): Promise<HistoryItem[]> {
  try {
    const { data, error } = await supabase
      .from("appointments")
      .select("slot_start, service_slug, status")
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .order("slot_start", { ascending: false })
      .limit(5);

    if (error) return [];

    return (data ?? []).map((a) => ({
      date: new Date(a.slot_start).toLocaleDateString("tr-TR"),
      service: a.service_slug || null,
      status: a.status,
    }));
  } catch {
    return [];
  }
}

/**
 * Geçmişi LLM prompt'una eklenecek kısa metne dönüştürür.
 *
 * @param history - getCustomerHistory sonucu
 * @returns Özet metin (boş veya "Müşteri geçmişi: X, Y, Z")
 */
export function formatHistoryForPrompt(history: HistoryItem[]): string {
  if (!history.length) return "";
  const lines = history
    .filter((h) => h.status !== "cancelled")
    .map((h) => `${h.service || "Randevu"} (${h.date})`);
  if (!lines.length) return "";
  return `Müşteri geçmişi: ${lines.join(", ")}`;
}
