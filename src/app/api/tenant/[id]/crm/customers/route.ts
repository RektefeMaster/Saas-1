import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { fuzzySearch } from "@/lib/fuse-search";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  // Müşteri adı/telefon/etiket içeren liste: proxy'ye ek olarak burada da doğrula.
  const auth = await requireTenantApiAccess(request, tenantId);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().toLowerCase();

  let data: Record<string, unknown>[] = [];
  {
    const withPipeline = await supabase
      .from("crm_customers")
      .select(
        "id, tenant_id, customer_phone, customer_name, tags, notes_summary, last_visit_at, total_visits, pipeline_stage, lead_score, lead_score_breakdown, lifecycle_stage, created_at, updated_at"
      )
      .eq("tenant_id", tenantId)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (!withPipeline.error) {
      data = (withPipeline.data ?? []) as Record<string, unknown>[];
    } else if (/pipeline_stage|lead_score/i.test(withPipeline.error.message)) {
      // Migration 040 henüz yoksa çekirdek kolonlara düş.
      const core = await supabase
        .from("crm_customers")
        .select(
          "id, tenant_id, customer_phone, customer_name, tags, notes_summary, last_visit_at, total_visits, created_at, updated_at"
        )
        .eq("tenant_id", tenantId)
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (core.error) {
        const missingTable = extractMissingSchemaTable(core.error);
        if (missingTable !== "crm_customers") {
          return NextResponse.json({ error: core.error.message }, { status: 500 });
        }
        data = [];
      } else {
        data = (core.data ?? []) as Record<string, unknown>[];
      }
    } else {
      const missingTable = extractMissingSchemaTable(withPipeline.error);
      if (missingTable !== "crm_customers") {
        return NextResponse.json({ error: withPipeline.error.message }, { status: 500 });
      }
      data = [];
    }
  }

  const crmRows = data ?? [];
  let list = query
    ? fuzzySearch({
        list: crmRows,
        query,
        keys: ["customer_phone", "customer_name", "tags"],
        threshold: 0.4,
      })
    : crmRows;

  // Randevulardan türetilen yedek liste yalnızca CRM tablosu gerçekten boşken
  // devreye girer. Eskiden "arama sonucu boş" durumunda da tetikleniyordu:
  // kayıtlı müşterisi olan işletmede her sonuçsuz aramada gereksiz 300 satırlık
  // randevu taraması yapılıyor ve liste beklenmedik kayıtlarla doluyordu.
  if (crmRows.length === 0) {
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
