import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [reviewsRes, alertsRes, noShowRes] = await Promise.all([
      supabase
        .from("reviews")
        .select("rating")
        .eq("tenant_id", tenantId)
        .gte("created_at", ninetyDaysAgo.toISOString()),
      supabase
        .from("ops_alerts")
        .select("id, type")
        .eq("tenant_id", tenantId)
        .eq("status", "open"),
      supabase
        .from("appointments")
        .select("status")
        .eq("tenant_id", tenantId)
        .gte("slot_start", thirtyDaysAgo.toISOString())
        .in("status", ["completed", "no_show"]),
    ]);

    let ratings: number[] = [];
    if (!reviewsRes.error) {
      ratings = (reviewsRes.data || []).map((r) => Number(r.rating || 0)).filter((r) => r > 0);
    } else {
      const missing = extractMissingSchemaTable(reviewsRes.error);
      if (missing !== "reviews") {
        throw new Error(reviewsRes.error.message);
      }
    }

    let openAlertsByType: Record<string, number> = {};
    if (!alertsRes.error) {
      for (const alert of alertsRes.data || []) {
        openAlertsByType[alert.type] = (openAlertsByType[alert.type] || 0) + 1;
      }
    } else {
      const missing = extractMissingSchemaTable(alertsRes.error);
      if (missing !== "ops_alerts") {
        throw new Error(alertsRes.error.message);
      }
    }

    let noShowRate30d = 0;
    if (!noShowRes.error) {
      const rows = noShowRes.data || [];
      const noShowCount = rows.filter((row) => row.status === "no_show").length;
      noShowRate30d = rows.length > 0 ? round((noShowCount / rows.length) * 100, 1) : 0;
    } else {
      throw new Error(noShowRes.error.message);
    }

    const totalReviews = ratings.length;
    const avgRating =
      totalReviews > 0 ? round(ratings.reduce((sum, rating) => sum + rating, 0) / totalReviews, 1) : 0;

    const promoters = ratings.filter((rating) => rating >= 5).length;
    const passives = ratings.filter((rating) => rating === 4).length;
    const detractors = ratings.filter((rating) => rating <= 3).length;

    const reviewHealthScore =
      totalReviews > 0 ? round(((promoters - detractors) / totalReviews) * 100, 1) : 0;

    const actions: Array<{ title: string; priority: "high" | "medium" | "low"; note: string }> = [];

    if (avgRating > 0 && avgRating < 4.2) {
      actions.push({
        title: "Dusus yorumu kurtarma",
        priority: "high",
        note: "3 ve alt puan veren musteriler icin 24 saat icinde manuel geri donus yapin.",
      });
    }

    if (noShowRate30d >= 8) {
      actions.push({
        title: "No-show onleme",
        priority: "high",
        note: "Cift hatirlatma ve randevu onay adimi aktif edilmeli.",
      });
    }

    if ((openAlertsByType.cancellation || 0) > 2) {
      actions.push({
        title: "Iptal sebeplerini azalt",
        priority: "medium",
        note: "Son iptal notlarini inceleyip uygun saat politikasini guncelleyin.",
      });
    }

    if (actions.length === 0) {
      actions.push({
        title: "Iyi gidisati koru",
        priority: "low",
        note: "Memnun musterilerden yorum isteme otomasyonunu duzenli calistirin.",
      });
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      review_metrics: {
        avg_rating: avgRating,
        total_reviews: totalReviews,
        promoters,
        passives,
        detractors,
        review_health_score: reviewHealthScore,
      },
      ops_metrics: {
        no_show_rate_30d: noShowRate30d,
        open_alerts_by_type: openAlertsByType,
      },
      actions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reputation ozeti alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function round(value: number, precision = 2): number {
  const p = 10 ** precision;
  return Math.round((value + Number.EPSILON) * p) / p;
}
