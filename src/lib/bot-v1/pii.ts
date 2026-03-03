const TC_REGEX = /\b\d{11}\b/g;
const IBAN_REGEX = /\bTR\d{2}[0-9A-Z]{22}\b/gi;
const CARD_LIKE_REGEX = /\b(?:\d[ -]?){13,19}\b/g;

function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function maskSensitivePII(text: string): string {
  let out = text || "";
  out = out.replace(TC_REGEX, "***");
  out = out.replace(IBAN_REGEX, "***");
  out = out.replace(CARD_LIKE_REGEX, (candidate) => {
    return luhnCheck(candidate) ? "***" : candidate;
  });
  return out;
}

export function extractSafeEntities(text: string): {
  customer_name?: string;
  phone?: string;
} {
  const result: { customer_name?: string; phone?: string } = {};
  const nameMatch = text.match(
    /(?:adim|adım|ismim|isim)\s*(?:[:\-]|\s)?\s*([A-Za-zÇĞİÖŞÜçğıöşü]{2,}(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]{2,}){0,2})/i
  );
  if (nameMatch?.[1]) {
    result.customer_name = nameMatch[1].trim();
  }
  const phoneMatch = text.match(/(?:\+?90)?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/);
  if (phoneMatch?.[0]) {
    const digits = phoneMatch[0].replace(/\D/g, "");
    result.phone = digits.startsWith("90") ? `+${digits}` : `+90${digits}`;
  }
  return result;
}
