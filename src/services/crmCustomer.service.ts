/**
 * CRM müşteri servisi
 * Bot tarafından müşteri tanıma ve randevu sonrası kayıt için kullanılır.
 */

import { supabase } from "@/lib/supabase";
import { normalizePhoneE164, normalizePhoneDigits, phoneVariants } from "@/lib/phone";

export interface CrmCustomerProfile {
  customer_name: string | null;
  total_visits: number;
  last_visit_at: string | null;
  notes_summary: string | null;
  metadata: Record<string, unknown>;
}

/** Prompt'a kısa etiketlerle giren bilinen CRM alanları. */
const PROFILE_LABELS: Record<string, string> = {
  hair_type: "saç tipi",
  color_formula: "renk formülü",
  allergies: "hassasiyet",
  scalp_notes: "saç derisi",
  preferred_staff: "tercih uzman",
  preferred_time: "tercih zaman",
  last_service_notes: "son işlem",
  nail_condition: "tırnak durumu",
  nail_sensitivity: "tırnak hassasiyeti",
  preferred_design: "tercih tasarım",
  skin_type: "cilt tipi",
  hair_color: "kıl rengi",
  treated_areas: "uygulanan bölgeler",
  session_number: "tamamlanan seans",
  last_session_date: "son seans",
  device: "cihaz",
  contraindications: "uzman uyarısı",
  treatment_plan: "tedavi planı",
  ongoing_treatment: "devam eden tedavi",
  next_control_date: "sonraki kontrol",
  medical_notes: "hekim notu",
  preferred_doctor: "tercih hekim",
  pet_name: "hayvan adı",
  pet_species: "tür",
  vehicle: "araç",
  address: "adres",
};

/**
 * Telefon numarasına göre CRM müşteri profilini getirir.
 * Bot konuşma başında müşteriyi tanımak için kullanır.
 */
export async function getCrmCustomer(
  tenantId: string,
  customerPhone: string
): Promise<CrmCustomerProfile | null> {
  const variants = phoneVariants(customerPhone);
  if (variants.length === 0) return null;

  // metadata/notes_summary bazı ortamlarda henüz yok; şema eksikse çekirdek alanlara düş.
  let selectColumns =
    "customer_name, total_visits, last_visit_at, notes_summary, metadata";
  let { data, error } = await supabase
    .from("crm_customers")
    .select(selectColumns)
    .eq("tenant_id", tenantId)
    .in("customer_phone", variants)
    .maybeSingle();

  if (error) {
    selectColumns = "customer_name, total_visits, last_visit_at";
    const fallback = await supabase
      .from("crm_customers")
      .select(selectColumns)
      .eq("tenant_id", tenantId)
      .in("customer_phone", variants)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error || !data) return null;

  const row = data as {
    customer_name?: string | null;
    total_visits?: number | null;
    last_visit_at?: string | null;
    notes_summary?: string | null;
    metadata?: unknown;
  };

  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    customer_name: row.customer_name?.trim() || null,
    total_visits: row.total_visits ?? 0,
    last_visit_at: row.last_visit_at || null,
    notes_summary: row.notes_summary?.trim() || null,
    metadata,
  };
}

/**
 * Panelde doldurulan CRM kartını prompt'a kısa ve güvenli biçimde çevirir.
 * Sağlık detaylarını müşteriye geri okutmaması için tek satırlık uyarı ekler.
 */
export function formatCrmProfileForPrompt(
  profile: CrmCustomerProfile | null | undefined
): string {
  if (!profile) return "";

  const bits: string[] = [];
  if (profile.total_visits > 0) {
    bits.push(`${profile.total_visits} ziyaret`);
  }

  const metaBits = Object.entries(profile.metadata)
    .filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === "object") return false;
      return String(value).trim().length > 0;
    })
    .slice(0, 8)
    .map(([key, value]) => {
      const label = PROFILE_LABELS[key] || key;
      return `${label}: ${String(value).trim().slice(0, 48)}`;
    });
  if (metaBits.length > 0) bits.push(metaBits.join("; "));

  if (profile.notes_summary) {
    bits.push(`özet: ${profile.notes_summary.slice(0, 140)}`);
  }

  if (bits.length === 0) return "";
  return `CRM kartı: ${bits.join(" · ")}. Doğal kullan; hassasiyet/sağlık detayını müşteriye geri okuma.`;
}

/**
 * Randevu oluşturulduğunda müşteriyi CRM'e kaydeder veya günceller.
 * İlk randevuda customer_name ile kayıt; sonraki randevularda mevcut kaydı günceller.
 */
export async function upsertCrmCustomer(
  tenantId: string,
  customerPhone: string,
  customerName?: string | null
): Promise<string | null> {
  const normalized =
    normalizePhoneE164(customerPhone) ||
    (normalizePhoneDigits(customerPhone) ? `+${normalizePhoneDigits(customerPhone)}` : null);
  if (!normalized) return null;

  try {
    const { data } = await supabase
      .from("crm_customers")
      .upsert(
        {
          tenant_id: tenantId,
          customer_phone: normalized,
          ...(customerName?.trim() ? { customer_name: customerName.trim() } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,customer_phone" }
      )
      .select("id")
      .maybeSingle();
    return data?.id || null;
  } catch {
    // CRM upsert başarısız olsa da randevu akışı devam etmeli
    return null;
  }
}
