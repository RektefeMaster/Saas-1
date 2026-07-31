/**
 * Pazarlama izni / opt-out.
 *
 * Ayrım kritik:
 * - PAZARLAMA mesajı (kampanya, geri kazanım) → opt-out'a saygı duyar.
 * - İŞLEMSEL mesaj (randevu onayı, hatırlatma, iptal) → opt-out'tan etkilenmez;
 *   müşterinin kendi aldığı randevunun hatırlatması reklam değildir.
 *
 * Migration 035 uygulanmadıysa fonksiyonlar güvenli tarafa düşer:
 * opt-out okunamıyorsa "çıkmamış" kabul edilmez — gönderim engellenir mi?
 * Hayır: kolon yoksa özellik hiç yoktur, eski davranış korunur (gönderilir).
 * Kolon varsa ve okuma hata verirse gönderim ENGELLENİR (güvenli taraf).
 */

import { supabase } from "@/lib/supabase";
import { normalizePhoneE164, normalizePhoneDigits } from "@/lib/phone";

/** Müşterinin listeden çıkmak için yazabileceği kelimeler. */
const OPT_OUT_KEYWORDS = new Set([
  "dur",
  "stop",
  "cikis",
  "çıkış",
  "cik",
  "iptal listesi",
  "listeden cikar",
  "listeden çıkar",
  "mesaj istemiyorum",
  "reklam istemiyorum",
  "kampanya istemiyorum",
  "abonelikten cik",
  "unsubscribe",
]);

/** Tekrar mesaj almak isteyenler. */
const OPT_IN_KEYWORDS = new Set([
  "basla",
  "başla",
  "start",
  "devam mesaj",
  "kampanya istiyorum",
  "abone ol",
]);

function normalize(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ConsentIntent = "opt_out" | "opt_in" | null;

/**
 * Mesaj bir opt-out/opt-in talebi mi?
 * Yalnızca TAM eşleşme kabul edilir: "durum ne?" veya "iptal" gibi cümleler
 * yanlışlıkla müşteriyi listeden çıkarmamalı.
 */
export function detectConsentIntent(message: string): ConsentIntent {
  const text = normalize(message);
  if (!text) return null;
  if (OPT_OUT_KEYWORDS.has(text)) return "opt_out";
  if (OPT_IN_KEYWORDS.has(text)) return "opt_in";
  return null;
}

function normalizePhone(customerPhone: string): string | null {
  return (
    normalizePhoneE164(customerPhone) ||
    (normalizePhoneDigits(customerPhone) ? `+${normalizePhoneDigits(customerPhone)}` : null)
  );
}

function isSchemaMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "42883" ||
    error.code === "42703" ||
    error.code === "PGRST202" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

export async function setMarketingOptOut(
  tenantId: string,
  customerPhone: string,
  optOut: boolean,
  source = "whatsapp_keyword"
): Promise<{ ok: boolean; error?: string }> {
  const normalized = normalizePhone(customerPhone);
  if (!normalized) return { ok: false, error: "invalid_phone" };
  try {
    const { error } = await supabase.rpc("crm_set_marketing_opt_out", {
      p_tenant_id: tenantId,
      p_customer_phone: normalized,
      p_opt_out: optOut,
      p_source: source,
    });
    if (!error) return { ok: true };
    if (isSchemaMissing(error)) return { ok: false, error: "migration_missing" };
    return { ok: false, error: error.message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Kampanya alıcılarından listeden çıkmış olanları eler.
 * Kolon yoksa (migration uygulanmadıysa) liste olduğu gibi döner.
 */
export async function filterOptedOutPhones(
  tenantId: string,
  phones: string[]
): Promise<{ allowed: string[]; blocked: string[]; degraded: boolean }> {
  const unique = [...new Set(phones.filter(Boolean))];
  if (unique.length === 0) return { allowed: [], blocked: [], degraded: false };

  const normalizedMap = new Map<string, string>();
  for (const phone of unique) {
    const normalized = normalizePhone(phone);
    if (normalized) normalizedMap.set(normalized, phone);
  }
  if (normalizedMap.size === 0) {
    return { allowed: unique, blocked: [], degraded: false };
  }

  const { data, error } = await supabase
    .from("crm_customers")
    .select("customer_phone")
    .eq("tenant_id", tenantId)
    .eq("marketing_opt_out", true)
    .in("customer_phone", [...normalizedMap.keys()]);

  if (error) {
    if (isSchemaMissing(error)) {
      // Özellik henüz yok → eski davranış.
      return { allowed: unique, blocked: [], degraded: true };
    }
    // Kolon var ama sorgu patladı → güvenli taraf: gönderme.
    throw new Error(`opt_out_check_failed:${error.message}`);
  }

  const optedOut = new Set((data || []).map((row) => String(row.customer_phone)));
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const [normalized, original] of normalizedMap) {
    if (optedOut.has(normalized)) blocked.push(original);
    else allowed.push(original);
  }
  return { allowed, blocked, degraded: false };
}

/** Kampanya metnine çıkış talimatı ekler (yoksa). */
export function appendOptOutFooter(messageText: string): string {
  const normalized = normalize(messageText);
  if (normalized.includes("dur yaz") || normalized.includes("cikmak icin")) {
    return messageText;
  }
  return `${messageText}\n\nMesaj almak istemiyorsan "DUR" yaz.`;
}
