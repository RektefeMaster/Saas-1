/**
 * Çalışma günü mantığı: hafta kalıbı DAYATILMAMALI.
 * Salı kapalı, Perşembe kapalı, Pazar açık — her kombinasyon geçerli olmalı.
 */
import { describe, it, expect } from "vitest";
import { resolveFallbackWorkingDays } from "../booking.service";

describe("resolveFallbackWorkingDays (takvim satırı YOKken)", () => {
  it("hiç ayar yoksa eski davranış korunur (geriye uyum)", () => {
    expect(resolveFallbackWorkingDays({})).toEqual([1, 2, 3, 4, 5, 6]);
    expect(resolveFallbackWorkingDays({ default_working_days: null })).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("boş dizi = hiçbir gün açık değil (sessizce varsayılana DÖNMEZ)", () => {
    // Kritik: sahibi tüm günleri kapattığında motor Pzt-Cmt'yi açmamalı.
    expect(resolveFallbackWorkingDays({ default_working_days: [] })).toEqual([]);
  });

  it("keyfi gün kombinasyonu aynen uygulanır", () => {
    // Salı (2) ve Perşembe (4) kapalı, Pazar (0) açık
    expect(
      resolveFallbackWorkingDays({ default_working_days: [0, 1, 3, 5, 6] })
    ).toEqual([0, 1, 3, 5, 6]);
    // Sadece hafta sonu çalışan işletme
    expect(resolveFallbackWorkingDays({ default_working_days: [6, 0] })).toEqual([
      6, 0,
    ]);
    // Tek gün çalışan işletme
    expect(resolveFallbackWorkingDays({ default_working_days: [3] })).toEqual([3]);
  });

  it("string gelen sayılar kabul edilir (JSON round-trip)", () => {
    expect(
      resolveFallbackWorkingDays({ default_working_days: ["1", "6"] })
    ).toEqual([1, 6]);
  });

  it("geçersiz içerik varsayılana düşer, sessizce 'her gün kapalı' yapmaz", () => {
    expect(
      resolveFallbackWorkingDays({ default_working_days: ["pazartesi"] })
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(resolveFallbackWorkingDays({ default_working_days: [9, -1] })).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(resolveFallbackWorkingDays({ default_working_days: "1,2" })).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("aralık dışı değerler ayıklanır, geçerliler korunur", () => {
    expect(
      resolveFallbackWorkingDays({ default_working_days: [1, 7, 2, 99] })
    ).toEqual([1, 2]);
  });
});
