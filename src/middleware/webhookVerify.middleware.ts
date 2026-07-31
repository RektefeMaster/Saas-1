// Meta WhatsApp webhook imza doğrulama (x-hub-signature-256).
import crypto from "crypto";

/** Next.js Route Handler'da: raw body Buffer + header + secret ile doğrulama */
export function verifyWebhookSignatureBody(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");
  return expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);
}

export function getWebhookSecret(): string | undefined {
  return process.env.WHATSAPP_WEBHOOK_SECRET || undefined;
}
