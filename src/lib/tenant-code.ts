/**
 * tenant_code parse: Mesajdan AHMET01, HASAN02 gibi kodu çıkarır.
 * Desteklenen formatlar:
 *   "Kod: AHMET01"   → AHMET01
 *   "#AHMET01"        → AHMET01
 *   "AHMET01"         → AHMET01 (fallback)
 */
const TENANT_CODE_REGEX = /(?:Kod|kod|code|CODE)\s*[:：]?\s*([A-Za-z0-9]{3,10})/i;
const HASHTAG_CODE_REGEX = /#([A-Za-z0-9]{3,10})\b/;
const FALLBACK_CODE_REGEX = /\b([A-Z][A-Z0-9]{2,9})\b/;

export function parseTenantCodeFromMessage(message: string): string | null {
  const trimmed = message.trim();
  let match = trimmed.match(TENANT_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  match = trimmed.match(HASHTAG_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  match = trimmed.match(FALLBACK_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  return null;
}
