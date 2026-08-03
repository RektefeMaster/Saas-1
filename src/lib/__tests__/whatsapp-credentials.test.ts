// @vitest-environment node
/**
 * Gönderim kimlik bilgisinin çözümü ("anahtarlık").
 *
 * En kritik garanti: hiçbir işletmenin kendi kaydı yokken davranış BUGÜNKÜYLE
 * aynı kalmalı — ortak numara kullanılır. Kayıt eklendiğinde gönderim sessizce
 * o işletmenin numarasına geçer.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TenantChannelAccount } from "@/services/tenantChannelAccount.service";

const accounts = new Map<string, TenantChannelAccount>();
let lookupCalls = 0;
let lookupShouldThrow = false;

vi.mock("@/services/tenantChannelAccount.service", () => ({
  getTenantChannelAccount: async (tenantId: string | null | undefined) => {
    lookupCalls += 1;
    if (lookupShouldThrow) throw new Error("tablo yok");
    return (tenantId && accounts.get(tenantId)) || null;
  },
}));

vi.mock("@/lib/redis", () => ({
  // Runtime override yok: env'e düşsün.
  getRuntimeWhatsAppConfig: async () => null,
}));

const { resolveWhatsAppCredentials, invalidateWhatsAppCredentialsCache } =
  await import("@/lib/whatsapp");

function makeAccount(over: Partial<TenantChannelAccount>): TenantChannelAccount {
  return {
    id: "acc-1",
    tenantId: "tenant-1",
    channel: "whatsapp",
    externalAccountId: "999888777",
    accountHandle: "+905550001122",
    status: "active",
    tokenExpiresAt: null,
    accessToken: "EAAtenantToken",
    ...over,
  };
}

describe("resolveWhatsAppCredentials", () => {
  beforeEach(() => {
    accounts.clear();
    lookupCalls = 0;
    lookupShouldThrow = false;
    invalidateWhatsAppCredentialsCache();
    process.env.WHATSAPP_PHONE_NUMBER_ID = "shared-phone-id";
    process.env.WHATSAPP_ACCESS_TOKEN = "EAAsharedToken";
  });

  it("tenant verilmezse ortak numarayı kullanır", async () => {
    const creds = await resolveWhatsAppCredentials();
    expect(creds.phoneId).toBe("shared-phone-id");
    expect(creds.source).toBe("env");
    // Defter hiç sorgulanmamalı: bugünkü sıcak yola ek gecikme eklenmiyor.
    expect(lookupCalls).toBe(0);
  });

  it("işletmenin kendi kaydı yoksa ortak numaraya düşer", async () => {
    const creds = await resolveWhatsAppCredentials("tenant-1");
    expect(creds.phoneId).toBe("shared-phone-id");
    expect(creds.source).toBe("env");
  });

  it("işletmenin kendi numarası varsa onu kullanır", async () => {
    accounts.set("tenant-1", makeAccount({}));
    const creds = await resolveWhatsAppCredentials("tenant-1");
    expect(creds.phoneId).toBe("999888777");
    expect(creds.token).toBe("EAAtenantToken");
    expect(creds.source).toBe("tenant");
  });

  it("bir işletmenin numarası diğerine sızmaz", async () => {
    accounts.set("tenant-1", makeAccount({}));
    accounts.set(
      "tenant-2",
      makeAccount({
        tenantId: "tenant-2",
        externalAccountId: "111222333",
        accessToken: "EAAotherToken",
      })
    );

    const first = await resolveWhatsAppCredentials("tenant-1");
    const second = await resolveWhatsAppCredentials("tenant-2");

    expect(first.phoneId).toBe("999888777");
    expect(second.phoneId).toBe("111222333");
  });

  it("token çözülemiyorsa ortak numaraya düşer (yarım kimlikle göndermez)", async () => {
    accounts.set("tenant-1", makeAccount({ accessToken: null }));
    const creds = await resolveWhatsAppCredentials("tenant-1");
    expect(creds.phoneId).toBe("shared-phone-id");
    expect(creds.source).toBe("env");
  });

  it("hesap aktif değilse ortak numaraya düşer ve sessiz kalmaz", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    accounts.set("tenant-1", makeAccount({ status: "token_expired" }));

    const creds = await resolveWhatsAppCredentials("tenant-1");

    expect(creds.phoneId).toBe("shared-phone-id");
    // Kayıt var ama kullanılamıyor: bu bir arıza, loga düşmeli.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("hiç kayıt yokken uyarı üretmez (normal durum, arıza değil)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await resolveWhatsAppCredentials("tenant-1");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("defter okunamazsa gönderim durmaz, ortak numaraya düşer", async () => {
    lookupShouldThrow = true;
    const creds = await resolveWhatsAppCredentials("tenant-1");
    expect(creds.phoneId).toBe("shared-phone-id");
    expect(creds.source).toBe("env");
  });

  it("çözülen kimlik önbelleğe alınır", async () => {
    accounts.set("tenant-1", makeAccount({}));
    await resolveWhatsAppCredentials("tenant-1");
    await resolveWhatsAppCredentials("tenant-1");
    expect(lookupCalls).toBe(1);
  });
});
