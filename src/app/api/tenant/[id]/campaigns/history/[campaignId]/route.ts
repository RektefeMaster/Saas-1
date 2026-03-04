import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  try {
    const { id: tenantId, campaignId } = await params;

    const { data, error } = await supabase
      .from("campaign_messages")
      .delete()
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .is("sent_by_admin_id", null)
      .select("id")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Silinemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
