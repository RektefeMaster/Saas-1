import {
  BUSINESS_SCOPE_KEYWORDS,
  OFFTOPIC_KEYWORDS,
  ABUSIVE_KEYWORDS,
  GREETING_KEYWORDS,
  SMALLTALK_KEYWORDS,
  NEGOTIATION_KEYWORDS,
} from "./constants";

export function normalizeIncomingText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

export function capEmojiUsage(text: string, maxCount = 1): string {
  const emojiRegex = /[\p{Extended_Pictographic}]/gu;
  let seen = 0;
  return text.replace(emojiRegex, (emoji) => {
    seen += 1;
    return seen <= maxCount ? emoji : "";
  });
}

export function normalizeAssistantReply(reply: string): string {
  let text = (reply || "").trim();
  if (!text) return "";
  text = text.replace(/\n{3,}/g, "\n\n");
  text = capEmojiUsage(text, 1);
  if (/yanlis anladin|yanlış anladın|oyle bir sey demedim|öyle bir şey demedim/i.test(text)) {
    text =
      "Az önce net anlatamadıysam kusura bakma. Şimdi randevu, fiyat veya müsaitlik konusunda net şekilde yardımcı olayım.";
  }
  return text.trim();
}

export function normalizeHalfHourRequest(message: string): string {
  const halfMatch = message.match(
    /(?:^|\s)(\d{1,2})\s*(?:buçuk|bucuk|b[uıi]?[cç]?[uoö]?[uıi]?k)\b/i
  );
  if (!halfMatch) return message;
  const rawHour = Number(halfMatch[1]);
  if (!Number.isFinite(rawHour) || rawHour < 0 || rawHour > 23) return message;
  let hour = rawHour;
  if (hour >= 1 && hour <= 7) hour += 12;
  const replacement = `${String(hour).padStart(2, "0")}:30`;
  return message.replace(halfMatch[0], ` ${replacement}`);
}
