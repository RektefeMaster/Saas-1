import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));

    let query = supabase
      .from("campaign_messages")
      .select("id, tenant_id, message_text, channel, recipient_count, success_count, filter_tags, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tenantIds = [...new Set((data || []).map((r) => r.tenant_id))];
    const { data: tenants } = tenantIds.length > 0
      ? await supabase.from("tenants").select("id, name, tenant_code").in("id", tenantIds)
      : { data: [] };

    const tenantMap = new Map((tenants || []).map((t) => [t.id, t]));

    const enriched = (data || []).map((row) => ({
      ...row,
      tenant_name: tenantMap.get(row.tenant_id)?.name ?? null,
      tenant_code: tenantMap.get(row.tenant_id)?.tenant_code ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Geçmiş alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
