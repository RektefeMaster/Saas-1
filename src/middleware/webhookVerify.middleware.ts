/**
 * [YENİ] Meta WhatsApp webhook imza doğrulama middleware.
 * Her webhook isteğinde x-hub-signature-256 header kontrol edilir.
 * Express kullanıyorsanız: router.post("/webhook", express.raw({ type: "*/*" }), verifyWebhookSignature, handler)
 * Next.js: Route Handler içinde raw body alıp verifyWebhookSignatureBody ile aynı kontrolü yapın.
 */
import crypto from "crypto";

/** Express-benzeri tip (proje Express kullanmıyorsa sadece verifyWebhookSignatureBody kullanılabilir) */
export interface WebhookVerifyRequest {
  headers: { "x-hub-signature-256"?: string };
  body?: Buffer | string | Record<string, unknown>;
}

export function verifyWebhookSignature(
  req: WebhookVerifyRequest,
  res: { status: (n: number) => { json: (o: object) => void }; return?: void },
  next: () => void
): void {
  const signature = req.headers["x-hub-signature-256"];
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook] WHATSAPP_WEBHOOK_SECRET tanımlanmamış");
    res.status(500).json({ error: "Sunucu yapılandırma hatası" });
    return;
  }

  if (!signature) {
    console.warn("[webhook] İmza header eksik");
    res.status(401).json({ error: "İmza gerekli" });
    return;
  }

  const body = req.body;
  const raw = Buffer.isBuffer(body)
    ? body
    : typeof body === "string"
      ? Buffer.from(body, "utf8")
      : Buffer.from(JSON.stringify(body ?? {}));
  const valid = verifyWebhookSignatureBody(raw, signature, secret);
  if (!valid) {
    console.warn("[webhook] İmza doğrulama başarısız");
    res.status(401).json({ error: "Geçersiz imza" });
    return;
  }

  next();
}

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
