/**
 * dayjs + timezone: Saat dilimi güvenli tarih/saat işlemleri.
 * Sunucu UTC'de çalışsa bile işlemler Europe/Istanbul'a göre yapılır.
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";
dayjs.tz.setDefault(APP_TIMEZONE);

/**
 * Bugünün tarihi (YYYY-MM-DD) - Europe/Istanbul
 */
export function todayStr(): string {
  return dayjs().tz(APP_TIMEZONE).format("YYYY-MM-DD");
}

/**
 * Şu anki saat (HH:mm) - Europe/Istanbul
 */
export function nowTimeStr(): string {
  return dayjs().tz(APP_TIMEZONE).format("HH:mm");
}

/**
 * Tarih string'ini timezone'a göre formatlar
 */
export function formatDateTr(dateStr: string): string {
  const d = dayjs.tz(dateStr, APP_TIMEZONE);
  if (!d.isValid()) return dateStr;
  return d.format("D MMMM YYYY");
}

/**
 * Date objesini YYYY-MM-DD'ye çevirir (timezone'a göre)
 */
export function toLocalDateStr(d: Date): string {
  return dayjs(d).tz(APP_TIMEZONE).format("YYYY-MM-DD");
}

/**
 * Date objesini HH:mm'ye çevirir (timezone'a göre)
 */
export function toLocalTimeStr(d: Date): string {
  return dayjs(d).tz(APP_TIMEZONE).format("HH:mm");
}
