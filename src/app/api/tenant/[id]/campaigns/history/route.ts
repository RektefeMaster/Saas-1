import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const { data, error } = await supabase
      .from("campaign_messages")
      .select("id, message_text, channel, recipient_count, success_count, filter_tags, created_at")
      .eq("tenant_id", tenantId)
      .is("sent_by_admin_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Geçmiş alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
