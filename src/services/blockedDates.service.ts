/**
 * Tatil / izin günleri servisi
 * blocked_dates: Esnafın kapalı olduğu tarih aralıkları
 */

import { supabase } from "@/lib/supabase";

/**
 * Verilen tarihin tenant için bloklu (tatil/izin) olup olmadığını kontrol eder.
 *
 * @param tenantId - Tenant ID
 * @param dateStr - YYYY-MM-DD formatında tarih
 * @returns true = bloklu, false = müsait
 *
 * @example
 * const blocked = await checkBlockedDate("tenant-id", "2025-01-15");
 * if (blocked) return "O tarihler kapalı";
 */
export async function checkBlockedDate(tenantId: string, dateStr: string): Promise<boolean> {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const { data, error } = await supabase
      .from("blocked_dates")
      .select("id")
      .eq("tenant_id", tenantId)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Tatil/izin ekler.
 *
 * @param tenantId - Tenant ID
 * @param startDate - YYYY-MM-DD
 * @param endDate - YYYY-MM-DD
 * @param reason - Opsiyonel açıklama
 */
export async function addBlockedDate(
  tenantId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("blocked_dates")
      .insert({
        tenant_id: tenantId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || null,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Eklenemedi";
    return { ok: false, error: msg };
  }
}

/**
 * Tenant'ın tüm bloklu tarihlerini listeler.
 */
export async function listBlockedDates(tenantId: string) {
  const { data, error } = await supabase
    .from("blocked_dates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });
  if (error) return [];
  return data ?? [];
}

/**
 * Bloklu tarihi siler.
 */
export async function deleteBlockedDate(
  tenantId: string,
  blockId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("blocked_dates")
    .delete()
    .eq("id", blockId)
    .eq("tenant_id", tenantId);
  return { ok: !error, error: error?.message };
}
