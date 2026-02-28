/**
 * Yorum / değerlendirme servisi
 * submit_review, getReviews
 */

import { supabase } from "@/lib/supabase";

/**
 * Randevu için değerlendirme kaydeder.
 *
 * @param tenantId - Tenant ID
 * @param appointmentId - Randevu ID
 * @param customerPhone - Müşteri telefonu
 * @param rating - 1-5 arası puan
 * @param comment - Opsiyonel yorum
 */
export async function submitReview(
  tenantId: string,
  appointmentId: string,
  customerPhone: string,
  rating: number,
  comment?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (rating < 1 || rating > 5) {
      return { ok: false, error: "Puan 1-5 arası olmalı" };
    }

    const { error } = await supabase.from("reviews").insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      customer_phone: customerPhone,
      rating,
      comment: comment || null,
    });

    return { ok: !error, error: error?.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kaydedilemedi";
    return { ok: false, error: msg };
  }
}

/**
 * Randevunun değerlendirmesi var mı kontrol eder.
 */
export async function hasReview(appointmentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("appointment_id", appointmentId)
    .limit(1);
  return !error && (data?.length ?? 0) > 0;
}

/**
 * Tenant'ın tüm yorumlarını ve ortalama puanı döndürür.
 */
export async function getTenantReviews(tenantId: string) {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, appointment_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return { avgRating: 0, totalCount: 0, reviews: [] };

  const list = reviews ?? [];
  const sum = list.reduce((s, r) => s + (r.rating || 0), 0);
  const avgRating = list.length ? Math.round((sum / list.length) * 10) / 10 : 0;

  const aptIds = [...new Set(list.map((r) => r.appointment_id))];
  const { data: apts } = await supabase
    .from("appointments")
    .select("id, slot_start")
    .in("id", aptIds);
  const aptMap = new Map((apts ?? []).map((a) => [a.id, a.slot_start]));

  return {
    avgRating,
    totalCount: list.length,
    reviews: list.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      appointment_date: aptMap.get(r.appointment_id),
    })),
  };
}
