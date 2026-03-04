import { describe, it, expect } from "vitest";
import { normalizePhoneE164, normalizePhoneDigits } from "../phone";

describe("normalizePhoneE164", () => {
  it("0506... formatını E.164'e çevirir", () => {
    expect(normalizePhoneE164("05061234567")).toBe("+905061234567");
  });

  it("506... formatını E.164'e çevirir", () => {
    expect(normalizePhoneE164("5061234567")).toBe("+905061234567");
  });

  it("90506... formatını E.164'e çevirir", () => {
    expect(normalizePhoneE164("905061234567")).toBe("+905061234567");
  });

  it("+90 ile başlayan formatı olduğu gibi döner", () => {
    expect(normalizePhoneE164("+905061234567")).toBe("+905061234567");
  });

  it("geçersiz numara için null döner", () => {
    expect(normalizePhoneE164("123")).toBeNull();
    expect(normalizePhoneE164("abc")).toBeNull();
    expect(normalizePhoneE164("")).toBeNull();
  });

  it("null/undefined için null döner", () => {
    expect(normalizePhoneE164(null)).toBeNull();
    expect(normalizePhoneE164(undefined)).toBeNull();
  });
});

describe("normalizePhoneDigits", () => {
  it("E.164 döndürülebilirse sadece rakamları döner", () => {
    expect(normalizePhoneDigits("05061234567")).toBe("905061234567");
  });

  it("geçersiz numarada sadece rakamları döner (fallback)", () => {
    expect(normalizePhoneDigits("0506123")).toMatch(/\d+/);
  });
});
