import { describe, it, expect, vi, beforeEach } from "vitest";

const reserveAppointment = vi.fn();
vi.mock("@/services/booking.service", () => ({
  reserveAppointment: (...args: unknown[]) => reserveAppointment(...args),
}));

import { createWeeklySeries, MAX_SERIES_OCCURRENCES } from "../appointmentSeries.service";

const BASE = {
  tenantId: "t1",
  customerPhone: "+905551112233",
  // 2026-08-03 Pazartesi → dayOfWeek 1
  today: "2026-08-01",
  dayOfWeek: 1,
  time: "15:00",
  serviceSlug: "sac-kesimi",
  customerName: "Ayşe",
  advanceBookingDays: 60,
};

beforeEach(() => {
  reserveAppointment.mockReset();
  reserveAppointment.mockResolvedValue({ ok: true, id: "a1" });
});

describe("createWeeklySeries", () => {
  it("haftalık gerçek randevular üretir (görünmez blok değil)", async () => {
    const res = await createWeeklySeries({ ...BASE, occurrences: 4 });
    expect(res.created.map((o) => o.date)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
    ]);
    expect(res.skipped).toHaveLength(0);
    expect(reserveAppointment).toHaveBeenCalledTimes(4);
    // Her randevu hizmetiyle açılır → süre doğru hesaplanır.
    expect(reserveAppointment.mock.calls[0][0]).toMatchObject({
      serviceSlug: "sac-kesimi",
      time: "15:00",
    });
  });

  it("ilk randevu bugünden sonraki ilk o güne düşer", async () => {
    // 2026-08-03 Pazartesi'de "pazartesi" istenirse bir sonraki haftaya gider.
    const res = await createWeeklySeries({
      ...BASE,
      today: "2026-08-03",
      occurrences: 1,
    });
    expect(res.created[0].date).toBe("2026-08-10");
  });

  it("dolu hafta atlanır, seri iptal olmaz", async () => {
    reserveAppointment
      .mockResolvedValueOnce({ ok: true, id: "a1" })
      .mockResolvedValueOnce({ ok: false, error: "SLOT_TAKEN" })
      .mockResolvedValueOnce({ ok: true, id: "a3" });

    const res = await createWeeklySeries({ ...BASE, occurrences: 3 });
    expect(res.created.map((o) => o.date)).toEqual(["2026-08-03", "2026-08-17"]);
    expect(res.skipped).toEqual([{ date: "2026-08-10", reason: "o saat dolu" }]);
  });

  it("kapalı gün gerekçesi okunabilir metne çevrilir", async () => {
    reserveAppointment.mockResolvedValue({ ok: false, error: "CLOSED_DAY" });
    const res = await createWeeklySeries({ ...BASE, occurrences: 2 });
    expect(res.created).toHaveLength(0);
    expect(res.skipped.every((s) => s.reason === "kapalı gün")).toBe(true);
  });

  it("ileri rezervasyon sınırını aşan haftalar açılmaz", async () => {
    const res = await createWeeklySeries({
      ...BASE,
      occurrences: 4,
      advanceBookingDays: 10, // 2026-08-11'e kadar
    });
    expect(res.created.map((o) => o.date)).toEqual(["2026-08-03", "2026-08-10"]);
    expect(res.skipped.map((s) => s.reason)).toEqual([
      "ileri rezervasyon sınırı",
      "ileri rezervasyon sınırı",
    ]);
    // Sınır aşan haftalar için DB'ye hiç gidilmez.
    expect(reserveAppointment).toHaveBeenCalledTimes(2);
  });

  it("hafta sayısı üst sınırla kırpılır", async () => {
    const res = await createWeeklySeries({ ...BASE, occurrences: 99 });
    expect(res.created.length + res.skipped.length).toBe(MAX_SERIES_OCCURRENCES);
  });

  it("ay sınırını doğru geçer", async () => {
    // 2026-08-31 Pazartesi; sonraki 2026-09-07.
    const res = await createWeeklySeries({
      ...BASE,
      today: "2026-08-30",
      occurrences: 2,
    });
    expect(res.created.map((o) => o.date)).toEqual(["2026-08-31", "2026-09-07"]);
  });
});
