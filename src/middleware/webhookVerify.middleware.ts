import crypto from "crypto";

/**
 * Meta WhatsApp webhook isteğinin x-hub-signature-256 imzasını doğrular.
 * Ham (raw) payload ve WHATSAPP_WEBHOOK_SECRET kullanılmalıdır.
 * Doğrulama başarısızsa sahte istek olarak reddedin (401).
 */
export function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    return false;
  }
  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
  if (expected.length !== signature.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

export function getWebhookSecret(): string {
  return process.env.WHATSAPP_WEBHOOK_SECRET || "";
}
