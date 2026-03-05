/**
 * CRM müşteri servisi
 * Bot tarafından müşteri tanıma ve randevu sonrası kayıt için kullanılır.
 */

import { supabase } from "@/lib/supabase";
import { normalizePhoneE164, normalizePhoneDigits } from "@/lib/phone";

export interface CrmCustomerProfile {
  customer_name: string | null;
  total_visits: number;
  last_visit_at: string | null;
}

/**
 * Telefon numarasına göre CRM müşteri profilini getirir.
 * Bot konuşma başında müşteriyi tanımak için kullanır.
 */
export async function getCrmCustomer(
  tenantId: string,
  customerPhone: string
): Promise<CrmCustomerProfile | null> {
  const normalized =
    normalizePhoneE164(customerPhone) ||
    (normalizePhoneDigits(customerPhone) ? `+${normalizePhoneDigits(customerPhone)}` : null);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("crm_customers")
    .select("customer_name, total_visits, last_visit_at")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", normalized)
    .maybeSingle();

  if (error || !data) return null;

  return {
    customer_name: data.customer_name?.trim() || null,
    total_visits: data.total_visits ?? 0,
    last_visit_at: data.last_visit_at || null,
  };
}

/**
 * Randevu oluşturulduğunda müşteriyi CRM'e kaydeder veya günceller.
 * İlk randevuda customer_name ile kayıt; sonraki randevularda mevcut kaydı günceller.
 */
export async function upsertCrmCustomer(
  tenantId: string,
  customerPhone: string,
  customerName?: string | null
): Promise<void> {
  const normalized =
    normalizePhoneE164(customerPhone) ||
    (normalizePhoneDigits(customerPhone) ? `+${normalizePhoneDigits(customerPhone)}` : null);
  if (!normalized) return;

  try {
    await supabase.from("crm_customers").upsert(
      {
        tenant_id: tenantId,
        customer_phone: normalized,
        ...(customerName?.trim() ? { customer_name: customerName.trim() } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_phone" }
    );
  } catch {
    // CRM upsert başarısız olsa da randevu akışı devam etmeli
  }
}
