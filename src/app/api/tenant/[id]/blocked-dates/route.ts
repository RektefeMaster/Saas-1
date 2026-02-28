/**
 * Tatil/izin yönetimi API
 * GET: Listele | POST: Ekle
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listBlockedDates,
  addBlockedDate,
} from "@/services/blockedDates.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await listBlockedDates(id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[blocked-dates GET]", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { start_date, end_date, reason } = body;

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: "start_date ve end_date gerekli" },
        { status: 400 }
      );
    }

    const result = await addBlockedDate(id, start_date, end_date, reason);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ id: result.id });
  } catch (err) {
    console.error("[blocked-dates POST]", err);
    return NextResponse.json({ error: "Eklenemedi" }, { status: 500 });
  }
}
