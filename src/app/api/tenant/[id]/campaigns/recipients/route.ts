import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const { searchParams } = new URL(request.url);
    const tagsParam = searchParams.get("tags");
    const filterTags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const { data: crmList } = await supabase
      .from("crm_customers")
      .select("customer_phone, customer_name, tags")
      .eq("tenant_id", tenantId);

    let crmPhones = crmList || [];
    if (filterTags.length > 0) {
      crmPhones = crmPhones.filter((row) =>
        (row.tags || []).some((tag: string) => filterTags.includes(tag))
      );
    }

    const { data: aptData } = await supabase
      .from("appointments")
      .select("customer_phone")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled");

    const allPhones = new Map<string, { name?: string; tags?: string[] }>();
    for (const row of crmPhones) {
      allPhones.set(row.customer_phone, {
        name: row.customer_name || undefined,
        tags: row.tags || [],
      });
    }
    for (const apt of aptData || []) {
      if (!allPhones.has(apt.customer_phone)) {
        allPhones.set(apt.customer_phone, {});
      }
    }

    const recipients = Array.from(allPhones.entries()).map(([phone, meta]) => ({
      phone,
      ...meta,
    }));

    return NextResponse.json({
      count: recipients.length,
      recipients: recipients.slice(0, 500),
      all_tags: [...new Set((crmList || []).flatMap((row) => row.tags || []))],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Alıcılar alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
