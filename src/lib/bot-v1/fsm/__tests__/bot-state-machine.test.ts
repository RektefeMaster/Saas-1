import { describe, it, expect } from "vitest";
import { canTransition, getValidNextStep } from "../bot-state-machine";

describe("canTransition", () => {
  it("INIT -> tenant_bulundu geçişine izin verir", () => {
    expect(canTransition("INIT", "tenant_bulundu")).toBe(true);
  });

  it("INIT -> devam geçişine izin verir", () => {
    expect(canTransition("INIT", "devam")).toBe(true);
  });

  it("devam -> tarih_saat_bekleniyor geçişine izin verir", () => {
    expect(canTransition("devam", "tarih_saat_bekleniyor")).toBe(true);
  });

  it("devam -> saat_secimi_bekleniyor geçişine izin verir", () => {
    expect(canTransition("devam", "saat_secimi_bekleniyor")).toBe(true);
  });

  it("COMPLETED -> INIT geçişine izin verir", () => {
    expect(canTransition("COMPLETED", "INIT")).toBe(true);
  });

  it("COMPLETED -> COLLECTING_FIELDS geçişine izin vermez", () => {
    expect(canTransition("COMPLETED", "COLLECTING_FIELDS")).toBe(false);
  });

  it("tarih_saat_bekleniyor -> saat_secimi_bekleniyor geçişine izin verir", () => {
    expect(canTransition("tarih_saat_bekleniyor", "saat_secimi_bekleniyor")).toBe(true);
  });

  it("saat_secimi_bekleniyor -> EXECUTING geçişine izin verir", () => {
    expect(canTransition("saat_secimi_bekleniyor", "EXECUTING")).toBe(true);
  });
});

describe("getValidNextStep", () => {
  it("geçerli geçişte desired step döner", () => {
    expect(getValidNextStep("INIT", "tenant_bulundu")).toBe("tenant_bulundu");
    expect(getValidNextStep("devam", "tarih_saat_bekleniyor")).toBe("tarih_saat_bekleniyor");
  });

  it("geçersiz geçişte mevcut step korunur", () => {
    expect(getValidNextStep("COMPLETED", "COLLECTING_FIELDS")).toBe("COMPLETED");
  });
});
