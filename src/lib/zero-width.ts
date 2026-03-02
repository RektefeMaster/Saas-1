// Zero-width tenant marker
// 0 -> U+200B (ZWSP), 1 -> U+200C (ZWNJ), separator -> U+200D (ZWJ)

const ZERO = "\u200B";
const ONE = "\u200C";
const SEP = "\u200D";

function toBinary(value: string): string {
  return value
    .split("")
    .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
}

function fromBinary(value: string): string {
  if (value.length % 8 !== 0) return "";
  const chars: string[] = [];
  for (let i = 0; i < value.length; i += 8) {
    const byte = value.slice(i, i + 8);
    const code = parseInt(byte, 2);
    if (!Number.isFinite(code)) return "";
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

export function encodeTenantMarker(tenantCode: string): string {
  const normalized = tenantCode.trim().toUpperCase();
  if (!normalized) return "";
  const bits = toBinary(normalized);
  const encoded = bits.replace(/0/g, ZERO).replace(/1/g, ONE);
  return `${SEP}${encoded}${SEP}`;
}

export function decodeTenantMarker(message: string): string | null {
  const escapedSep = SEP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escapedSep}([${ZERO}${ONE}]+)${escapedSep}`);
  const match = message.match(re);
  if (!match) return null;
  const payload = match[1];
  const bits = payload.replace(new RegExp(ZERO, "g"), "0").replace(new RegExp(ONE, "g"), "1");
  const decoded = fromBinary(bits).trim().toUpperCase();
  return /^[A-Z0-9]{3,12}$/.test(decoded) ? decoded : null;
}

export function stripZeroWidthMarkers(message: string): string {
  const escapedSep = SEP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const markerRe = new RegExp(`${escapedSep}[${ZERO}${ONE}]+${escapedSep}`, "g");
  return message.replace(markerRe, "").replace(/[\u200B\u200C\u200D]/g, "");
}

