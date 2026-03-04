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
