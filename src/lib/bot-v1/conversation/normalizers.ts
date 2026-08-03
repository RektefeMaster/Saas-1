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

/**
 * WhatsApp kendi biçimlendirmesini kullanır: kalın `*metin*`, italik `_metin_`.
 * Model standart Markdown üretince (`**metin**`, `### Başlık`, `[a](b)`)
 * müşteri ekranında ham yıldızlar ve köşeli parantezler görünüyordu.
 */
function toWhatsAppFormatting(input: string): string {
  return (
    input
      // **kalın** → *kalın*  (üç yıldızlı `***x***` de tek yıldıza iner)
      .replace(/\*{2,3}([^*\n]+)\*{2,3}/g, "*$1*")
      // __italik__ → _italik_
      .replace(/_{2}([^_\n]+)_{2}/g, "_$1_")
      // [metin](url) → metin (url)
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
      // Markdown başlıkları WhatsApp'ta anlamsız
      .replace(/^#{1,6}\s+/gm, "")
      // Yatay çizgi
      .replace(/^\s*([-*_])\1{2,}\s*$/gm, "")
  );
}

export function normalizeAssistantReply(reply: string): string {
  let text = (reply || "").trim();
  if (!text) return "";
  text = toWhatsAppFormatting(text);
  text = text.replace(/\n{3,}/g, "\n\n");
  text = capEmojiUsage(text, 1);
  if (/yanlis anladin|yanlış anladın|oyle bir sey demedim|öyle bir şey demedim/i.test(text)) {
    text =
      "Az önce net anlatamadıysam kusura bakma. Şimdi randevu, fiyat veya müsaitlik konusunda net şekilde yardımcı olayım.";
  }
  return text.trim();
}

export function normalizeHalfHourRequest(message: string): string {
  // Sondaki ek serbest: "3 buçukta", "3 buçuğa" da yakalanmalı. Eskiden `\b`
  // yüzünden yalnızca ek almamış "3 buçuk" biçimi dönüştürülüyordu.
  const halfMatch = message.match(
    /(?:^|\s)(\d{1,2})\s*(?:buçu[kğ]|bucu[kg]|b[uıi]?[cç]?[uoö]?[uıi]?[kğg])\p{L}*/iu
  );
  if (!halfMatch) return message;
  const rawHour = Number(halfMatch[1]);
  if (!Number.isFinite(rawHour) || rawHour < 0 || rawHour > 23) return message;
  let hour = rawHour;
  if (hour >= 1 && hour <= 7) hour += 12;
  const replacement = `${String(hour).padStart(2, "0")}:30`;
  return message.replace(halfMatch[0], ` ${replacement}`);
}
