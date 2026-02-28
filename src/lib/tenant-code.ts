/**
 * tenant_code parse: Mesajdan AHMET01, HASAN02 gibi kodu çıkarır.
 * Örnek: "Merhaba, [Kuaför Ahmet] için randevu. Kod: AHMET01" -> AHMET01
 */
const TENANT_CODE_REGEX = /(?:Kod|kod|code|CODE)\s*[:：]?\s*([A-Za-z0-9]{3,10})/i;
const FALLBACK_CODE_REGEX = /\b([A-Z][A-Z0-9]{2,9})\b/; // AHMET01, HASAN02 formatı

export function parseTenantCodeFromMessage(message: string): string | null {
  const trimmed = message.trim();
  let match = trimmed.match(TENANT_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  match = trimmed.match(FALLBACK_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  return null;
}
