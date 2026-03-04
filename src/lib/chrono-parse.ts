/**
 * chrono-node ile doğal dil tarih ayrıştırma.
 * "Haftaya cuma 3'te", "Yarın akşamüstü" → YYYY-MM-DD, HH:MM
 * LLM'e yük bindirmeden kesin tarih/saat çıkarımı.
 */
import * as chrono from "chrono-node";
import dayjs from "dayjs";
import { APP_TIMEZONE } from "./dayjs-utils";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(APP_TIMEZONE);

export interface ParsedDateTime {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  raw: Date;
}

/**
 * Doğal dil metninden tarih/saat çıkarır.
 * @param text - Müşteri mesajı ("haftaya cuma 3'te", "yarın öğleden sonra")
 * @param referenceDate - Referans tarih (varsayılan: bugün, Europe/Istanbul)
 */
export function parseNaturalDateTime(
  text: string,
  referenceDate?: Date
): ParsedDateTime | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const ref = referenceDate
    ? dayjs(referenceDate).tz(APP_TIMEZONE).toDate()
    : dayjs().tz(APP_TIMEZONE).toDate();

  const results = chrono.parse(trimmed, ref, { forwardDate: true });
  const first = results[0];
  if (!first) return null;

  const d = first.date();
  const dateStr = dayjs(d).tz(APP_TIMEZONE).format("YYYY-MM-DD");
  const timeStr = dayjs(d).tz(APP_TIMEZONE).format("HH:mm");

  return { date: dateStr, time: timeStr, raw: d };
}

/**
 * Sadece tarih çıkarır (saat yoksa bugünün varsayılan saati kullanılır).
 */
export function parseNaturalDate(
  text: string,
  referenceDate?: Date
): { date: string } | null {
  const parsed = parseNaturalDateTime(text, referenceDate);
  if (!parsed) return null;
  return { date: parsed.date };
}
