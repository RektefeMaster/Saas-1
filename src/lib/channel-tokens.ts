/**
 * Kanal erişim tokenlarının şifrelenmesi (AES-256-GCM).
 *
 * Bu tokenlar müşteri kimlik bilgisidir: sızması, işletmenin tüm mesajlarına
 * erişim demektir. Bu yüzden DB'ye yalnızca şifreli yazılır ve hiçbir log/hata
 * mesajına düz metin geçmez.
 *
 * Anahtar: CHANNEL_TOKEN_KEY (64 hex veya base64, 32 bayt).
 * Tanımlı değilse şifreleme yapılamaz; çağıran taraf token saklamayı reddeder.
 * Medya şifrelemesiyle (MEDIA_ENCRYPTION_KEY) aynı format, ayrı anahtar.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = 1;

function parseKey(raw: string): Buffer | null {
  try {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      const hex = Buffer.from(raw, "hex");
      if (hex.length === 32) return hex;
    }
    const b64 = Buffer.from(raw, "base64");
    if (b64.length === 32) return b64;
  } catch {
    return null;
  }
  return null;
}

function getChannelTokenKey(): Buffer | null {
  const raw = (process.env.CHANNEL_TOKEN_KEY || "").trim();
  if (!raw) return null;
  return parseKey(raw);
}

export function isChannelTokenEncryptionConfigured(): boolean {
  return getChannelTokenKey() !== null;
}

/**
 * Düz tokeni şifreler. Anahtar yoksa null döner — çağıran taraf bunu
 * "token saklanamaz" olarak ele almalı, düz metne düşmemeli.
 */
export function encryptChannelToken(plainToken: string): string | null {
  const key = getChannelTokenKey();
  if (!key) return null;
  const token = (plainToken || "").trim();
  if (!token) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: VERSION,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
  });
}

/**
 * Şifreli tokeni çözer. Anahtar yoksa, format bozuksa veya doğrulama
 * etiketi tutmazsa null döner — hata mesajı token içeriği sızdırmaz.
 */
export function decryptChannelToken(stored: string | null | undefined): string | null {
  const key = getChannelTokenKey();
  if (!key || !stored) return null;

  try {
    const parsed = JSON.parse(stored) as {
      v?: number;
      iv?: string;
      tag?: string;
      ciphertext?: string;
    };
    if (parsed.v !== VERSION || !parsed.iv || !parsed.tag || !parsed.ciphertext) {
      return null;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parsed.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.ciphertext, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8") || null;
  } catch {
    // Bozuk kayıt veya yanlış anahtar. Detay loglanmaz: içerik sırdır.
    return null;
  }
}
