import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

function parseAddDuration(body: { add?: string; action?: string; subscription_plan?: string }): string {
  const action = body.action?.toLowerCase();
  if (action === "1w") return "7d";
  if (action === "1m") return "30d";
  return (body.add || "30d").trim().toLowerCase();
}

function parseDurationMs(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^(\d+)\s*(m|h|d|w|mo)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2];
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  if (unit === "d") return amount * 24 * 60 * 60 * 1000;
  if (unit === "w") return amount * 7 * 24 * 60 * 60 * 1000;
  if (unit === "mo") return amount * 30 * 24 * 60 * 60 * 1000;
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    add?: string;
    action?: string;
    subscription_plan?: string;
  };
  const addStr = parseAddDuration(body);

  const addMs = parseDurationMs(addStr);
  if (addMs == null || addMs <= 0) {
    return NextResponse.json(
      { error: "Geçersiz süre. Örnek: 7d, 30d, 90d, 1w, 1mo" },
      { status: 400 }
    );
  }

  const { data: tenant, error: fetchErr } = await supabase
    .from("tenants")
    .select("id, subscription_end_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !tenant) {
    return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
  }

  const now = new Date();
  const currentEnd = tenant.subscription_end_at
    ? new Date(tenant.subscription_end_at)
    : now;
  const baseTime = currentEnd > now ? currentEnd : now;
  const newEnd = new Date(baseTime.getTime() + addMs);

  const updatePayload: Record<string, unknown> = {
    subscription_end_at: newEnd.toISOString(),
    updated_at: now.toISOString(),
  };
  if (body.subscription_plan != null) updatePayload.subscription_plan = body.subscription_plan;

  const { data: updated, error } = await supabase
    .from("tenants")
    .update(updatePayload)
    .eq("id", id)
    .select("id, subscription_end_at")
    .single();

  if (error) {
    const missing = extractMissingSchemaColumn(error);
    if (missing?.table === "tenants") {
      return NextResponse.json(
        { error: "subscription_end_at kolonu mevcut değil. Migration 027 çalıştırın." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    subscription_end_at: updated?.subscription_end_at,
    subscription_plan: body.subscription_plan,
    added: addStr,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(request, { params });
}
