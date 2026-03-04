import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;

    const { data, error } = await supabase
      .from("campaign_messages")
      .delete()
      .eq("id", campaignId)
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
