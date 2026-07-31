/**
 * Lead takibi: konuşmuş ama randevu almamış kişiler.
 *
 * TASARIM KARARI — otomatik gönderim varsayılan olarak KAPALIDIR.
 * Müşteriye kendiliğinden mesaj atmak geri dönüşü olmayan, dışa dönük bir
 * eylemdir. Varsayılan davranış: aday, işletmenin panelinde hatırlatma olarak
 * belirir ve gönderim kararını insan verir. İşletme `config_override` içinde
 * `lead_followup_auto_send: true` derse otomatik WhatsApp gönderimi açılır.
 *
 * Opt-out ("DUR" yazanlar) her iki modda da mutlaka elenir.
 */

import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { filterOptedOutPhones, appendOptOutFooter } from "@/services/marketingConsent.service";

export interface LeadFollowUpCandidate {
  customer_phone: string;
  customer_name: string | null;
  last_contact_at: string | null;
  days_since_contact: number;
}

/** Bu kadar gün sessiz kalan lead takip edilir. */
const DEFAULT_QUIET_DAYS = 3;
/** Bundan eski leadler artık takip edilmez (bayat). */
const MAX_QUIET_DAYS = 30;

function daysBetween(from: string | null): number {
  if (!from) return Number.POSITIVE_INFINITY;
  const ts = new Date(from).getTime();
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

/**
 * Randevusuz, belirli süredir sessiz ve daha önce takip edilmemiş leadleri getirir.
 */
export async function listLeadFollowUpCandidates(
  tenantId: string,
  options?: { quietDays?: number; limit?: number }
): Promise<LeadFollowUpCandidate[]> {
  const quietDays = Math.max(1, options?.quietDays ?? DEFAULT_QUIET_DAYS);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));

  const until = new Date(Date.now() - quietDays * 24 * 60 * 60 * 1000).toISOString();
  const since = new Date(Date.now() - MAX_QUIET_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("crm_customers")
    .select("customer_phone, customer_name, last_contact_at, bot_memory")
    .eq("tenant_id", tenantId)
    .eq("lifecycle_stage", "lead")
    .eq("marketing_opt_out", false)
    .lte("last_contact_at", until)
    .gte("last_contact_at", since)
    .order("last_contact_at", { ascending: true })
    .limit(limit);

  if (error) {
    // Migration 034/035 uygulanmadıysa özellik yok say.
    if (extractMissingSchemaTable(error) || /does not exist|schema cache/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  const candidates = (data || [])
    .filter((row) => {
      const memory = (row.bot_memory as Record<string, unknown> | null) || {};
      // Aynı lead için tekrar tekrar takip mesajı atma.
      return !memory.followed_up_at;
    })
    .map((row) => ({
      customer_phone: String(row.customer_phone),
      customer_name: (row.customer_name as string | null) || null,
      last_contact_at: (row.last_contact_at as string | null) || null,
      days_since_contact: daysBetween(row.last_contact_at as string | null),
    }));

  // Opt-out sütunu okunamamış olabilir; ikinci bir güvenlik süzgeci.
  const consent = await filterOptedOutPhones(
    tenantId,
    candidates.map((c) => c.customer_phone)
  );
  const allowed = new Set(consent.allowed);
  return candidates.filter((c) => allowed.has(c.customer_phone));
}

export function buildLeadFollowUpMessage(
  tenantName: string,
  candidate: LeadFollowUpCandidate
): string {
  const name = candidate.customer_name?.trim();
  const hitap = name ? `${name}, merhaba` : "Merhaba";
  return appendOptOutFooter(
    `${hitap}! ${tenantName} olarak geçen görüşmemizde randevu netleştiremedik. ` +
      `Hâlâ ilgileniyorsan uygun bir saat bulalım, tek mesaj yeterli.`
  );
}

/** Aynı lead'e tekrar takip mesajı gitmesin diye işaretler. */
export async function markLeadFollowedUp(
  tenantId: string,
  customerPhone: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from("crm_customers")
      .select("bot_memory")
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .maybeSingle();
    const memory = (data?.bot_memory as Record<string, unknown> | null) || {};
    await supabase
      .from("crm_customers")
      .update({
        bot_memory: { ...memory, followed_up_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone);
  } catch (err) {
    console.warn("[leadFollowUp] mark failed:", err);
  }
}

/** Panelde görünecek hatırlatma olarak kuyruğa alır (otomatik gönderim yok). */
export async function queueLeadFollowUpReminders(
  tenantId: string,
  candidates: LeadFollowUpCandidate[]
): Promise<number> {
  if (candidates.length === 0) return 0;
  const rows = candidates.map((c) => ({
    tenant_id: tenantId,
    customer_phone: c.customer_phone,
    title: "Lead takibi",
    note: `${c.days_since_contact} gündür sessiz, randevu almadı. Aramak veya mesaj atmak ister misiniz?`,
    remind_at: new Date().toISOString(),
    channel: "panel",
    status: "pending",
  }));
  const { data, error } = await supabase.from("crm_reminders").insert(rows).select("id");
  if (error) {
    console.warn("[leadFollowUp] queue failed:", error.message);
    return 0;
  }
  return (data || []).length;
}

export function isAutoSendEnabled(configOverride: Record<string, unknown> | null): boolean {
  return (configOverride || {}).lead_followup_auto_send === true;
}
