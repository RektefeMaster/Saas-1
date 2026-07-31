/**
 * Meta Developer Console → WhatsApp → Webhooks → "Test" butonu,
 * dokümantasyondaki sabit örnek payload'ı gönderir. Gerçek bir müşteri
 * mesajı değildir; AI/Inngest/WhatsApp send zincirine sokmak 401/131047
 * ve claim retry fırtınası üretir.
 *
 * @see https://developers.facebook.com/docs/whatsapp/sample-app-endpoints/
 */
const META_SAMPLE_FROM_DIGITS = "16315551181";
const META_SAMPLE_MESSAGE_IDS = new Set(["ABGGFlA5Fpa"]);
const META_SAMPLE_PHONE_NUMBER_IDS = new Set(["123456123"]);
const META_SAMPLE_DISPLAY_PHONES = new Set(["16505551111"]);

export function isMetaSampleWhatsAppInbound(input: {
  phone?: string | null;
  messageId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
}): boolean {
  const digits = (input.phone || "").replace(/\D/g, "");
  if (digits === META_SAMPLE_FROM_DIGITS || digits.endsWith(META_SAMPLE_FROM_DIGITS)) {
    return true;
  }
  const messageId = (input.messageId || "").trim();
  if (messageId && META_SAMPLE_MESSAGE_IDS.has(messageId)) return true;

  const phoneNumberId = (input.phoneNumberId || "").trim();
  if (phoneNumberId && META_SAMPLE_PHONE_NUMBER_IDS.has(phoneNumberId)) return true;

  const display = (input.displayPhoneNumber || "").replace(/\D/g, "");
  if (display && META_SAMPLE_DISPLAY_PHONES.has(display)) return true;

  return false;
}
