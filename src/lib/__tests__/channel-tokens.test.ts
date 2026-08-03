// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptChannelToken,
  decryptChannelToken,
  isChannelTokenEncryptionConfigured,
} from "@/lib/channel-tokens";

const KEY_A = "a".repeat(64); // 32 bayt hex
const KEY_B = "b".repeat(64);
const ORIGINAL = process.env.CHANNEL_TOKEN_KEY;

describe("channel-tokens", () => {
  beforeEach(() => {
    process.env.CHANNEL_TOKEN_KEY = KEY_A;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.CHANNEL_TOKEN_KEY;
    else process.env.CHANNEL_TOKEN_KEY = ORIGINAL;
  });

  it("şifreleyip geri çözer", () => {
    const token = "EAAG1234567890abcdefTOKEN";
    const stored = encryptChannelToken(token);

    expect(stored).toBeTruthy();
    // Depolanan değer tokeni düz metin olarak içermemeli.
    expect(stored).not.toContain(token);
    expect(decryptChannelToken(stored)).toBe(token);
  });

  it("aynı token her seferinde farklı şifreli metin üretir (rastgele IV)", () => {
    const a = encryptChannelToken("ayni-token");
    const b = encryptChannelToken("ayni-token");
    expect(a).not.toBe(b);
    expect(decryptChannelToken(a)).toBe("ayni-token");
    expect(decryptChannelToken(b)).toBe("ayni-token");
  });

  it("yanlış anahtarla çözemez ve patlamaz", () => {
    const stored = encryptChannelToken("gizli-token");
    process.env.CHANNEL_TOKEN_KEY = KEY_B;
    expect(decryptChannelToken(stored)).toBeNull();
  });

  it("içeriği değiştirilmiş kayıt reddedilir", () => {
    const stored = encryptChannelToken("gizli-token")!;
    const parsed = JSON.parse(stored) as { ciphertext: string };
    const tampered = JSON.stringify({
      ...parsed,
      ciphertext: Buffer.from("baskabirsey").toString("base64"),
    });
    expect(decryptChannelToken(tampered)).toBeNull();
  });

  it("anahtar yokken şifreleme yapmaz — düz metne düşmez", () => {
    delete process.env.CHANNEL_TOKEN_KEY;
    expect(isChannelTokenEncryptionConfigured()).toBe(false);
    expect(encryptChannelToken("gizli-token")).toBeNull();
  });

  it("bozuk kayıtlarda null döner", () => {
    expect(decryptChannelToken(null)).toBeNull();
    expect(decryptChannelToken("")).toBeNull();
    expect(decryptChannelToken("json degil")).toBeNull();
    expect(decryptChannelToken('{"v":1}')).toBeNull();
  });
});
