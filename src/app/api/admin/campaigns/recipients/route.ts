import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id");
    const tagsParam = searchParams.get("tags");

    if (!tenantId) {
      return NextResponse.json({ error: "tenant_id gerekli" }, { status: 400 });
    }

    const filterTags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const { data: crmList } = await supabase
      .from("crm_customers")
      .select("customer_phone, customer_name, tags")
      .eq("tenant_id", tenantId);

    let crmPhones = crmList || [];
    if (filterTags.length > 0) {
      crmPhones = crmPhones.filter((r) =>
        (r.tags || []).some((t: string) => filterTags.includes(t))
      );
    }

    const { data: aptData } = await supabase
      .from("appointments")
      .select("customer_phone")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled");

    const allPhones = new Map<string, { name?: string; tags?: string[] }>();
    for (const r of crmPhones) {
      allPhones.set(r.customer_phone, {
        name: r.customer_name || undefined,
        tags: r.tags || [],
      });
    }
    for (const a of aptData || []) {
      if (!allPhones.has(a.customer_phone)) {
        allPhones.set(a.customer_phone, {});
      }
    }

    const recipients = Array.from(allPhones.entries()).map(([phone, meta]) => ({
      phone,
      ...meta,
    }));

    return NextResponse.json({
      count: recipients.length,
      recipients: recipients.slice(0, 500),
      all_tags: [...new Set((crmList || []).flatMap((r) => r.tags || []))],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Alıcılar alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
