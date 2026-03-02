import { decodeTenantMarker, stripZeroWidthMarkers } from "./zero-width";

/**
 * tenant_code parse: Mesajdan AHMET01, HASAN02 gibi kodu çıkarır.
 * Desteklenen formatlar:
 *   "Kod: AHMET01"   → AHMET01
 *   "#AHMET01"        → AHMET01
 *   "AHMET01"         → AHMET01 (fallback)
 */
const TENANT_CODE_REGEX = /(?:Kod|kod|code|CODE)\s*[:：]?\s*([A-Za-z0-9]{3,10})/i;
const HASHTAG_CODE_REGEX = /#([A-Za-z0-9]{3,10})\b/;
// Fallback sadece en az bir rakam içeren kodlarda çalışır (örn: AHMET01).
// Böylece "MERHABA" gibi kelimeler yanlışlıkla tenant kodu sayılmaz.
const FALLBACK_CODE_REGEX = /\b([A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*)\b/;

export function parseTenantCodeFromMessage(message: string): string | null {
  const invisibleCode = decodeTenantMarker(message);
  if (invisibleCode) return invisibleCode;

  const trimmed = stripZeroWidthMarkers(message).trim();
  let match = trimmed.match(TENANT_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  match = trimmed.match(HASHTAG_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  match = trimmed.match(FALLBACK_CODE_REGEX);
  if (match) return match[1].toUpperCase();

  return null;
}

export function sanitizeIncomingCustomerMessage(
  message: string,
  extractedCode?: string | null
): string {
  const cleaned = stripZeroWidthMarkers(message);
  const code = (extractedCode || parseTenantCodeFromMessage(cleaned) || "").trim();
  let normalized = cleaned;
  if (code) {
    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized
      .replace(new RegExp(`(?:Kod|kod|code|CODE)\\s*[:：]?\\s*${escapedCode}\\b`, "g"), "")
      .replace(new RegExp(`#${escapedCode}\\b`, "g"), "")
      .trim();
  }
  return normalized.replace(/\s+/g, " ").trim();
}
