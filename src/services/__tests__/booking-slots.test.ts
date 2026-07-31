/**
 * Hizmet süresine göre slot hesabı.
 * Senaryolar doğrudan işletmenin anlattığı vakalar:
 *  - 12:00'de alınan 1 saatlik saç kesiminden sonra ilk uygun saat 13:00
 *  - 17:00'de alınan 2,5 saatlik işlemden sonra ilk uygun saat 19:30
 *  - iptal edilen randevunun bloğu tamamen serbest kalır
 */
import { describe, it, expect } from "vitest";
import { computeOpenSlots, minutesToTime, timeToMinutes } from "../booking.service";

/** "12:00" + süre → dolu aralık. buffer verilirse iki yana uygulanır. */
function busyBlock(start: string, durationMinutes: number, bufferMinutes = 0) {
  const s = timeToMinutes(start);
  return {
    start: s - bufferMinutes,
    end: s + durationMinutes + bufferMinutes,
  };
}

function slots(params: {
  duration: number;
  busy?: Array<{ start: number; end: number }>;
  step?: number;
  open?: [string, string];
}) {
  const [openAt, closeAt] = params.open ?? ["09:00", "21:00"];
  return computeOpenSlots({
    workStart: timeToMinutes(openAt),
    workEnd: timeToMinutes(closeAt),
    stepMinutes: params.step ?? 30,
    durationMinutes: params.duration,
    busy: params.busy ?? [],
  });
}

describe("1 saatlik hizmet — 12:00 dolu", () => {
  const busy = [busyBlock("12:00", 60)];

  it("12:00 ve 12:30 kapanır, 13:00 açılır", () => {
    const open = slots({ duration: 60, busy });
    expect(open).not.toContain("12:00");
    expect(open).not.toContain("12:30");
    expect(open).toContain("13:00");
  });

  it("11:30 de kapanır: 1 saatlik işlem 12:00'ye taşardı", () => {
    expect(slots({ duration: 60, busy })).not.toContain("11:30");
    // 11:00 biter 12:00'de — sınıra değmek çakışma değil.
    expect(slots({ duration: 60, busy })).toContain("11:00");
  });

  it("30 dk'lık kısa hizmet 11:30'a sığar", () => {
    const open = slots({ duration: 30, busy });
    expect(open).toContain("11:30");
    expect(open).not.toContain("12:00");
    expect(open).not.toContain("12:30");
    expect(open).toContain("13:00");
  });
});

describe("2,5 saatlik hizmet — 17:00'de randevu alındı", () => {
  const busy = [busyBlock("17:00", 150)];

  it("17:00-19:30 arası tamamen kapanır, 19:30 ilk uygun saattir", () => {
    // Kapanış 22:00: 19:30 + 150dk tam sığar.
    const open = slots({ duration: 150, busy, open: ["09:00", "22:00"] });
    for (const t of ["17:00", "17:30", "18:00", "18:30", "19:00"]) {
      expect(open).not.toContain(t);
    }
    expect(open).toContain("19:30");
  });

  it("kapanış erkense 19:30 da verilmez (işlem kapanışı aşamaz)", () => {
    // 21:00 kapanışta 19:30 + 150dk = 22:00 → sunulmamalı.
    const open = slots({ duration: 150, busy, open: ["09:00", "21:00"] });
    expect(open).not.toContain("19:30");
  });

  it("uzun işlem kapanış saatini aşamaz", () => {
    const open = slots({ duration: 150, open: ["09:00", "18:00"] });
    expect(open).toContain("15:30"); // 15:30 + 150dk = 18:00
    expect(open).not.toContain("16:00"); // 18:30'a taşardı
  });

  it("aynı takvimde 30 dk'lık hizmet için 19:30 öncesi hâlâ dolu, sonrası açık", () => {
    const open = slots({ duration: 30, busy });
    expect(open).not.toContain("18:00");
    expect(open).toContain("19:30");
    expect(open).toContain("16:30"); // 17:00'de biter, çakışmaz
  });
});

describe("iptal sonrası blok serbest kalır", () => {
  it("dolu aralık listeden çıkınca tüm saatler geri açılır", () => {
    const withBooking = slots({ duration: 150, busy: [busyBlock("17:00", 150)] });
    const afterCancel = slots({ duration: 150, busy: [] });
    expect(withBooking).not.toContain("17:00");
    expect(afterCancel).toContain("17:00");
    expect(afterCancel).toContain("18:00");
  });
});

describe("randevular arası boşluk (buffer)", () => {
  it("15 dk buffer bir sonraki randevuyu yapışık başlatmaz", () => {
    const busy = [busyBlock("12:00", 60, 15)]; // 11:45 - 13:15
    const open = slots({ duration: 30, busy });
    expect(open).not.toContain("13:00"); // buffer içinde
    expect(open).toContain("13:30");
    expect(open).not.toContain("11:30"); // 12:00'ye kadar sürer, buffer'a girer
  });

  it("buffer 0 iken arka arkaya randevu mümkün", () => {
    const busy = [busyBlock("12:00", 60, 0)];
    expect(slots({ duration: 30, busy })).toContain("13:00");
  });
});

describe("çoklu dolu blok", () => {
  it("boşluğa ancak sığan hizmet yerleşir", () => {
    // 12:00-13:00 ve 14:00-15:00 dolu → arada 13:00-14:00 (60 dk) boş
    const busy = [busyBlock("12:00", 60), busyBlock("14:00", 60)];
    expect(slots({ duration: 60, busy })).toContain("13:00");
    // 90 dk'lık işlem bu boşluğa sığmaz
    expect(slots({ duration: 90, busy })).not.toContain("13:00");
    expect(slots({ duration: 90, busy })).toContain("15:00");
  });
});

describe("yardımcılar", () => {
  it("dakika/saat dönüşümü tutarlı", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(timeToMinutes("17:00") + 150)).toBe("19:30");
  });
});
