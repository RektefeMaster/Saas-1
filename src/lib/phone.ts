/**
 * libphonenumber-js ile E.164 telefon normalizasyonu.
 * 0506..., 506..., 90506... → +90506XXX XX XX
 * CRM çöplüğünü önler, tek müşteri kaydı garantisi.
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "TR";

/**
 * Telefonu E.164 formatına çevirir. Geçersizse null döner.
 */
export function normalizePhoneE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string | null {
  if (input == null || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;

  return parsed.format("E.164");
}

/**
 * E.164 veya sadece rakamlar (karşılaştırma için).
 * E.164 döndürülemezse sadece rakamları döndürür (fallback).
 */
export function normalizePhoneDigits(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string {
  const e164 = normalizePhoneE164(input, defaultCountry);
  if (e164) return e164.replace(/\D/g, "");
  if (input == null || typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

/**
 * Lookup-compatible phone variants without rewriting stored history.
 * Covers +905…, 905…, and digits-only forms used across WA / CRM / hold.
 */
export function phoneVariants(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string[] {
  const variants = new Set<string>();
  if (input == null || typeof input !== "string") return [];
  const trimmed = input.trim();
  if (trimmed) variants.add(trimmed);

  const e164 = normalizePhoneE164(trimmed, defaultCountry);
  if (e164) {
    variants.add(e164);
    variants.add(e164.replace(/\D/g, ""));
    if (e164.startsWith("+")) variants.add(e164.slice(1));
  }

  const digits = normalizePhoneDigits(trimmed, defaultCountry);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }

  return [...variants].filter(Boolean);
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const av = phoneVariants(a);
  const bv = new Set(phoneVariants(b));
  return av.some((v) => bv.has(v));
}

/**
 * WhatsApp conversation identity: canonical digits-only E.164 without '+'.
 * Webhook, backfill and conversation upsert MUST use the same function.
 */
export function normalizeWhatsAppIdentity(
  input: string | null | undefined
): string | null {
  const e164 = normalizePhoneE164(input);
  if (!e164) return null;
  return e164.replace(/\D/g, "") || null;
}
