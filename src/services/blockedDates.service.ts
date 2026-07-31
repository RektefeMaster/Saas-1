/**
 * Tatil / izin günleri servisi
 * blocked_dates: Esnafın kapalı olduğu tarih aralıkları
 */

import { supabase } from "@/lib/supabase";

export type BlockedDateCheck =
  | { ok: true; blocked: boolean }
  | { ok: false; error: string };

/**
 * Verilen tarihin tenant için bloklu (tatil/izin) olup olmadığını kontrol eder.
 * DB hatalarında "blocked=true" uydurmak yerine hard error döner (yanlış tatil yayılımı engellenir).
 */
export async function checkBlockedDateDetailed(
  tenantId: string,
  dateStr: string
): Promise<BlockedDateCheck> {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return { ok: true, blocked: false };
    }

    const { data, error } = await supabase
      .from("blocked_dates")
      .select("id")
      .eq("tenant_id", tenantId)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .limit(1);

    if (error) {
      console.error("[blockedDates] check error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, blocked: (data?.length ?? 0) > 0 };
  } catch (err) {
    console.error("[blockedDates] check exception:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "blocked_dates_check_failed",
    };
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
    .order("start_date", { ascending: false })
    .limit(100);
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
