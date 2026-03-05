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
 * "Geç" / skip seçimini kaydeder (rating olmadan).
 */
export async function submitReviewSkipped(
  tenantId: string,
  appointmentId: string,
  customerPhone: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("reviews").insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      customer_phone: customerPhone,
      rating: null,
      skipped: true,
    });

    return { ok: !error, error: error?.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kaydedilemedi";
    return { ok: false, error: msg };
  }
}

/**
 * Randevunun değerlendirmesi var mı kontrol eder (rating veya skipped).
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
 * Müşteri belirtilen hizmet için daha önce puan verdi mi?
 * (Aynı appointment hariç tutulabilir.)
 */
export async function hasCustomerRatedService(
  tenantId: string,
  customerPhone: string,
  serviceSlug: string | null | undefined,
  excludeAppointmentId?: string
): Promise<boolean> {
  const slug = String(serviceSlug || "").trim();
  if (!slug) return false;

  const { data: appointments, error: aptError } = await supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .eq("service_slug", slug)
    .limit(200);
  if (aptError || !appointments || appointments.length === 0) return false;

  const appointmentIds = appointments
    .map((row) => String(row.id || "").trim())
    .filter((id) => id && id !== excludeAppointmentId);
  if (appointmentIds.length === 0) return false;

  const { data: reviews, error: reviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .not("rating", "is", null)
    .in("appointment_id", appointmentIds)
    .limit(1);

  if (reviewError) return false;
  return (reviews?.length ?? 0) > 0;
}

/**
 * Tenant'ın tüm yorumlarını ve ortalama puanı döndürür.
 */
export async function getTenantReviews(tenantId: string) {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, appointment_id, skipped")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return { avgRating: 0, totalCount: 0, reviews: [] };

  const list = reviews ?? [];
  const rated = list.filter((r) => r.rating != null && r.rating >= 1 && r.rating <= 5);
  const sum = rated.reduce((s, r) => s + (r.rating || 0), 0);
  const avgRating = rated.length ? Math.round((sum / rated.length) * 10) / 10 : 0;

  const aptIds = [...new Set(list.map((r) => r.appointment_id))];
  const { data: apts } = await supabase
    .from("appointments")
    .select("id, slot_start")
    .in("id", aptIds);
  const aptMap = new Map((apts ?? []).map((a) => [a.id, a.slot_start]));

  const ratedList = list.filter((r) => r.rating != null && r.rating >= 1 && r.rating <= 5);
  return {
    avgRating,
    totalCount: ratedList.length,
    skippedCount: list.filter((r) => r.skipped === true).length,
    reviews: ratedList.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      appointment_date: aptMap.get(r.appointment_id),
    })),
  };
}
