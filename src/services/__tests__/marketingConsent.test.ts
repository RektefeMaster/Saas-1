import { describe, it, expect } from "vitest";
import {
  detectConsentIntent,
  appendOptOutFooter,
} from "@/services/marketingConsent.service";

describe("detectConsentIntent", () => {
  it("çıkış kelimelerini tanır", () => {
    for (const msg of ["DUR", "dur", "stop", "çıkış", "unsubscribe", "reklam istemiyorum"]) {
      expect(detectConsentIntent(msg), msg).toBe("opt_out");
    }
  });

  it("tekrar açma kelimelerini tanır", () => {
    for (const msg of ["BAŞLA", "start", "abone ol"]) {
      expect(detectConsentIntent(msg), msg).toBe("opt_in");
    }
  });

  it("benzeyen normal cümleleri YANLIŞLIKLA opt-out saymaz", () => {
    // En kritik risk: müşteriyi istemeden listeden çıkarmak.
    for (const msg of [
      "durum ne?",
      "randevumu iptal et",
      "durakta bekliyorum",
      "stop demek istemedim, devam",
      "başlangıç saati kaç?",
    ]) {
      expect(detectConsentIntent(msg), msg).toBeNull();
    }
  });

  it("boş mesajda null döner", () => {
    expect(detectConsentIntent("")).toBeNull();
    expect(detectConsentIntent("   ")).toBeNull();
  });
});

describe("appendOptOutFooter", () => {
  it("çıkış talimatı ekler", () => {
    expect(appendOptOutFooter("Kampanya var!")).toContain('"DUR" yaz');
  });

  it("zaten varsa tekrar eklemez", () => {
    const withFooter = appendOptOutFooter("Kampanya var!");
    expect(appendOptOutFooter(withFooter)).toBe(withFooter);
  });
});
