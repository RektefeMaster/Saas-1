/**
 * Müşteri geçmişi servisi
 * get_customer_history: Son randevuları LLM prompt'a özet olarak eklemek için
 */

import { supabase } from "@/lib/supabase";
import { phoneVariants } from "@/lib/phone";

const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";

export interface HistoryItem {
  date: string;
  service: string | null;
  status: string;
}

export interface UpcomingAppointment {
  id: string;
  /** YYYY-MM-DD (tenant timezone) */
  date: string;
  /** HH:mm (tenant timezone) */
  time: string;
  /** "yarın 1 Ağustos" gibi okunabilir tarih */
  dateLabel: string;
  service: string | null;
}

/**
 * Müşterinin son 5 randevusunu döndürür.
 * LLM'e gönderilecek özet için kullanılır.
 *
 * @param tenantId - Tenant ID
 * @param customerPhone - Müşteri telefonu
 * @returns HistoryItem[] (max 5)
 *
 * @example
 * const history = await getCustomerHistory(tenantId, "+905551234567");
 * // Özet: "Saç boyama (3 Ocak), Saç kesimi (15 Aralık)"
 */
export async function getCustomerHistory(
  tenantId: string,
  customerPhone: string
): Promise<HistoryItem[]> {
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .single();
    const tz = (tenant?.timezone as string)?.trim() || APP_TIMEZONE;

    const { data, error } = await supabase
      .from("appointments")
      .select("slot_start, service_slug, status")
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .order("slot_start", { ascending: false })
      .limit(5);

    if (error) return [];

    return (data ?? []).map((a) => ({
      date: new Date(a.slot_start).toLocaleDateString("tr-TR", {
        timeZone: tz,
      }),
      service: a.service_slug || null,
      status: a.status,
    }));
  } catch {
    return [];
  }
}

/**
 * Geçmişi LLM prompt'una eklenecek kısa metne dönüştürür.
 *
 * @param history - getCustomerHistory sonucu
 * @returns Özet metin (boş veya "Müşteri geçmişi: X, Y, Z")
 */
export function formatHistoryForPrompt(history: HistoryItem[]): string {
  if (!history.length) return "";
  const lines = history
    .filter((h) => h.status !== "cancelled")
    .map((h) => `${h.service || "Randevu"} (${h.date})`);
  if (!lines.length) return "";
  return `Müşteri geçmişi: ${lines.join(", ")}`;
}

/**
 * Müşterinin GELECEKTEKİ aktif randevuları.
 *
 * Neden ayrı: `getCustomerHistory` tarih sırasıyla son 5 kaydı döndürüyor ve
 * prompt'a sadece gün olarak giriyordu (saat yok). Bot bu yüzden az önce
 * oluşturduğu randevuyu hatırlamıyor, müşteri "yarın 15'te başkasının randevusu
 * var" dediğinde "evet dolu" diye onaylıyordu — halbuki o slot müşterinin
 * kendi randevusuydu.
 */
export async function getCustomerUpcomingAppointments(
  tenantId: string,
  customerPhone: string,
  limit = 5
): Promise<UpcomingAppointment[]> {
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .single();
    const tz = (tenant?.timezone as string)?.trim() || APP_TIMEZONE;

    const variants = phoneVariants(customerPhone);
    let query = supabase
      .from("appointments")
      .select("id, slot_start, service_slug, status")
      .eq("tenant_id", tenantId)
      // Küçük geriye tolerans: "az önce aldığım randevu" hâlâ görünsün.
      .gte("slot_start", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .in("status", ["confirmed", "pending"])
      .order("slot_start", { ascending: true })
      .limit(limit);
    query =
      variants.length > 0
        ? query.in("customer_phone", variants)
        : query.eq("customer_phone", customerPhone);

    const { data, error } = await query;
    if (error || !data) return [];

    const dateFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const labelFmt = new Intl.DateTimeFormat("tr-TR", {
      timeZone: tz,
      day: "numeric",
      month: "long",
      weekday: "long",
    });

    const todayStr = dateFmt.format(new Date());
    return data.map((row) => {
      const slot = new Date(row.slot_start);
      const date = dateFmt.format(slot);
      const dayDiff = Math.round(
        (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${todayStr}T12:00:00Z`)) /
          86_400_000
      );
      const prefix = dayDiff === 0 ? "bugün " : dayDiff === 1 ? "yarın " : "";
      return {
        id: String(row.id),
        date,
        time: timeFmt.format(slot),
        dateLabel: `${prefix}${labelFmt.format(slot)}`,
        service: (row.service_slug as string | null) || null,
      };
    });
  } catch {
    return [];
  }
}

/** Prompt'a girecek kısa blok. Randevu yoksa boş string. */
export function formatUpcomingForPrompt(items: UpcomingAppointment[]): string {
  if (!items.length) return "";
  const lines = items.map(
    (item) =>
      `- ${item.dateLabel} saat ${item.time}${item.service ? ` (${item.service})` : ""}`
  );
  return `Müşterinin MEVCUT randevuları:\n${lines.join("\n")}`;
}
