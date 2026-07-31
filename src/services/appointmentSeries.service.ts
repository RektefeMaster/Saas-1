/**
 * Tekrarlayan randevu (haftalık seri).
 *
 * Eski tasarım `recurring_appointments` tablosuna bir kural yazıyordu: slot her
 * hafta kapanıyordu ama ortada randevu kaydı olmadığı için işletme müşterinin
 * geleceğini takvimde göremiyor, kimse de iptal edemiyordu.
 *
 * Yeni tasarım: seri, N adet GERÇEK randevu satırı üretir. Böylece her hafta
 * takvimde görünür, panelden ve bottan tek tek iptal edilebilir, hatırlatma ve
 * no-show akışları olduğu gibi çalışır. Ayrı bir tekrarlama motoru yoktur.
 */

import { reserveAppointment } from "@/services/booking.service";

/** Tek çağrıda üretilecek maksimum randevu; takvimi kilitlememek için sınırlı. */
export const MAX_SERIES_OCCURRENCES = 12;
const DEFAULT_SERIES_OCCURRENCES = 4;

export interface SeriesOccurrence {
  date: string;
  time: string;
}

export interface SeriesSkip {
  date: string;
  reason: string;
}

export interface CreateWeeklySeriesInput {
  tenantId: string;
  customerPhone: string;
  /** 0=Pazar .. 6=Cumartesi */
  dayOfWeek: number;
  /** HH:MM */
  time: string;
  serviceSlug: string;
  customerName?: string | null;
  staffId?: string | null;
  occurrences?: number;
  /** İşletmenin ileri rezervasyon sınırı (gün). */
  advanceBookingDays: number;
  /** Bugünün tarihi (YYYY-MM-DD, tenant timezone). */
  today: string;
}

export interface CreateWeeklySeriesResult {
  created: SeriesOccurrence[];
  skipped: SeriesSkip[];
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

function dayOfWeekOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Verilen günden sonraki ilk `dayOfWeek` tarihini bulur (bugün dahil değil). */
function firstOccurrence(today: string, dayOfWeek: number): string {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(today, i);
    if (dayOfWeekOf(candidate) === dayOfWeek) return candidate;
  }
  return addDays(today, 7);
}

const ERROR_LABELS: Record<string, string> = {
  SLOT_TAKEN: "o saat dolu",
  CLOSED_DAY: "kapalı gün",
  BLOCKED_DAY: "tatil/kapalı tarih",
  NO_SCHEDULE: "çalışma saati tanımsız",
  AVAILABILITY_CHECK_FAILED: "müsaitlik kontrol edilemedi",
  SLOT_PROCESSING: "aynı slot işleniyor",
  CUSTOMER_BLOCKED: "müşteri engelli",
};

/**
 * Haftalık seriyi gerçek randevu satırları olarak oluşturur.
 * Dolu/kapalı haftalar atlanır ve `skipped` içinde gerekçesiyle döner;
 * tek bir hafta doluysa seri tamamen iptal edilmez.
 */
export async function createWeeklySeries(
  input: CreateWeeklySeriesInput
): Promise<CreateWeeklySeriesResult> {
  const occurrences = Math.min(
    MAX_SERIES_OCCURRENCES,
    Math.max(1, input.occurrences ?? DEFAULT_SERIES_OCCURRENCES)
  );
  const maxDate = addDays(input.today, Math.max(0, input.advanceBookingDays));

  const created: SeriesOccurrence[] = [];
  const skipped: SeriesSkip[] = [];

  let date = firstOccurrence(input.today, input.dayOfWeek);
  for (let i = 0; i < occurrences; i++, date = addDays(date, 7)) {
    if (date > maxDate) {
      skipped.push({ date, reason: "ileri rezervasyon sınırı" });
      continue;
    }

    const result = await reserveAppointment({
      tenantId: input.tenantId,
      customerPhone: input.customerPhone,
      date,
      time: input.time,
      staffId: input.staffId || null,
      serviceSlug: input.serviceSlug,
      extraData: {
        ...(input.customerName ? { customer_name: input.customerName } : {}),
        series: { day_of_week: input.dayOfWeek, time: input.time },
      },
    });

    if (result.ok) {
      created.push({ date, time: input.time });
      continue;
    }
    skipped.push({
      date,
      reason: ERROR_LABELS[result.error || ""] || result.error || "oluşturulamadı",
    });
  }

  return { created, skipped };
}
