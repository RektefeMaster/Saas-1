import { NextRequest, NextResponse } from "next/server";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { supabase } from "@/lib/supabase";
import { normalizePhoneDigits } from "@/lib/phone";

type Row = {
  id: number;
  direction: "inbound" | "outbound" | "system";
  message_text: string | null;
  message_type: string | null;
  stage: string | null;
  created_at: string;
};

function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tenantId = (params.get("tenant_id") || "").trim();
  const phoneDigits = normalizePhoneDigits(params.get("phone") || "");
  const hours = parseIntParam(params.get("hours"), 24, 1, 168);
  const limit = parseIntParam(params.get("limit"), 200, 1, 500);

  if (!tenantId || !phoneDigits) {
    return NextResponse.json(
      { error: "tenant_id ve phone zorunlu" },
      { status: 400 }
    );
  }

  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, direction, message_text, message_type, stage, created_at")
    .eq("tenant_id", tenantId)
    .eq("customer_phone_digits", phoneDigits)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "conversation_messages") {
      return NextResponse.json(
        { error: "conversation_messages tablosu bulunamadi" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = ((data || []) as Row[]).map((r) => ({
    id: r.id,
    direction: r.direction,
    message_text: r.message_text,
    message_type: r.message_type,
    stage: r.stage,
    created_at: r.created_at,
  }));

  return NextResponse.json({
    items,
    query: { tenant_id: tenantId, phone_digits: phoneDigits, hours, limit },
  });
}
