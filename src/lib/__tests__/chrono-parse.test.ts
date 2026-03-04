import { describe, it, expect } from "vitest";
import { parseNaturalDateTime, parseNaturalDate } from "../chrono-parse";

describe("parseNaturalDateTime", () => {
  it("boş veya geçersiz giriş için null döner", () => {
    expect(parseNaturalDateTime("")).toBeNull();
    expect(parseNaturalDateTime("   ")).toBeNull();
    expect(parseNaturalDateTime(null as unknown as string)).toBeNull();
  });

  it("tarih ve saat içeren metni ayrıştırır", () => {
    const ref = new Date("2025-03-04T12:00:00");
    const result = parseNaturalDateTime("yarın saat 15:00", ref);
    expect(result).not.toBeNull();
    expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result!.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("ParsedDateTime yapısını döner", () => {
    const ref = new Date("2025-03-04T12:00:00");
    const result = parseNaturalDateTime("5 Mart 2025 14:30", ref);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("time");
    expect(result).toHaveProperty("raw");
    expect(result!.raw).toBeInstanceOf(Date);
  });
});

describe("parseNaturalDate", () => {
  it("sadece tarih çıkarır", () => {
    const ref = new Date("2025-03-04T12:00:00");
    const result = parseNaturalDate("5 March 2025", ref);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("date");
    expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result!.date).toBe("2025-03-05");
  });

  it("ayrıştırılamazsa null döner", () => {
    expect(parseNaturalDate("xyz123")).toBeNull();
  });
});
