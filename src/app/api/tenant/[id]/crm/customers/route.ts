import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { fuzzySearch } from "@/lib/fuse-search";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  const result = await supabase
    .from("crm_customers")
    .select(
      "id, tenant_id, customer_phone, customer_name, tags, notes_summary, last_visit_at, total_visits, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  let data = result.data ?? [];
  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "crm_customers") {
      data = [];
    } else {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
  }

  let list = query
    ? fuzzySearch({
        list: data ?? [],
        query,
        keys: ["customer_phone", "customer_name", "tags"],
        threshold: 0.4,
      })
    : (data ?? []);

  if (list.length === 0) {
    const { data: fromAppointments } = await supabase
      .from("appointments")
      .select("customer_phone, slot_start")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .order("slot_start", { ascending: false })
      .limit(300);

    const fallbackMap = new Map<
      string,
      { customer_phone: string; customer_name: null; tags: string[]; notes_summary: null; last_visit_at: string; total_visits: number }
    >();

    for (const row of fromAppointments || []) {
      const key = row.customer_phone;
      const existing = fallbackMap.get(key);
      if (existing) {
        existing.total_visits += 1;
      } else {
        fallbackMap.set(key, {
          customer_phone: key,
          customer_name: null,
          tags: [],
          notes_summary: null,
          last_visit_at: row.slot_start,
          total_visits: 1,
        });
      }
    }

    const fallbackList = Array.from(fallbackMap.values());
    list = (query
      ? fuzzySearch({
          list: fallbackList,
          query,
          keys: ["customer_phone"],
          threshold: 0.4,
        })
      : fallbackList) as unknown as typeof list;
  }

  return NextResponse.json(list);
}
