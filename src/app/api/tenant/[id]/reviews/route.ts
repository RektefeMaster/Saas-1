/**
 * Yorum/değerlendirme API
 * GET: Ortalama puan + yorum listesi
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantReviews } from "@/services/review.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getTenantReviews(id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[reviews GET]", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}
