import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  const empty = {
    tenants: 0,
    businessTypes: 0,
    appointmentsToday: 0,
    appointmentsTotal: 0,
    activeTenants: 0,
    crmCustomers: 0,
    campaignMessages: 0,
    services: 0,
    staff: 0,
    reviews: 0,
    recentAppointments: [] as Array<{ id: string; tenant_id: string; slot_start: string; status: string; tenant_name?: string }>,
    recentCampaigns: [] as Array<{ id: string; tenant_id: string; success_count: number; recipient_count: number; created_at: string; tenant_name?: string }>,
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json(empty);
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const [
      { count: tenantsCount },
      { count: businessTypesCount },
      { count: appointmentsTodayCount },
      { count: appointmentsTotalCount },
      { count: activeTenantsCount },
      { count: crmCustomersCount },
      { count: campaignMessagesCount },
      { count: servicesCount },
      { count: staffCount },
      { count: reviewsCount },
    ] = await Promise.all([
      supabase.from("tenants").select("*", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("business_types").select("*", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("slot_start", `${today}T00:00:00`)
        .lt("slot_start", `${tomorrow}T00:00:00`)
        .neq("status", "cancelled"),
      supabase.from("appointments").select("*", { count: "exact", head: true }).neq("status", "cancelled"),
      supabase.from("tenants").select("*", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
      supabase.from("crm_customers").select("*", { count: "exact", head: true }),
      supabase.from("campaign_messages").select("*", { count: "exact", head: true }),
      supabase.from("services").select("*", { count: "exact", head: true }),
      supabase.from("staff").select("*", { count: "exact", head: true }),
      supabase.from("reviews").select("*", { count: "exact", head: true }),
    ]);

    // Son randevular (son 10)
    const { data: recentAppts } = await supabase
      .from("appointments")
      .select("id, tenant_id, slot_start, status")
      .neq("status", "cancelled")
      .order("slot_start", { ascending: false })
      .limit(10);

    // Son kampanyalar (son 5)
    const { data: recentCamps } = await supabase
      .from("campaign_messages")
      .select("id, tenant_id, success_count, recipient_count, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    // Tenant isimlerini çek
    const tenantIds = new Set<string>();
    (recentAppts ?? []).forEach((a) => tenantIds.add(a.tenant_id));
    (recentCamps ?? []).forEach((c) => tenantIds.add(c.tenant_id));
    const tenantIdList = Array.from(tenantIds);
    const tenantMap = new Map<string, string>();
    if (tenantIdList.length > 0) {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name")
        .in("id", tenantIdList);
      (tenants ?? []).forEach((t) => tenantMap.set(t.id, t.name));
    }

    const recentAppointments = (recentAppts ?? []).map((a) => ({
      id: a.id,
      tenant_id: a.tenant_id,
      slot_start: a.slot_start,
      status: a.status,
      tenant_name: tenantMap.get(a.tenant_id),
    }));
    const recentCampaigns = (recentCamps ?? []).map((c) => ({
      id: c.id,
      tenant_id: c.tenant_id,
      success_count: c.success_count,
      recipient_count: c.recipient_count,
      created_at: c.created_at,
      tenant_name: tenantMap.get(c.tenant_id),
    }));

    return NextResponse.json({
      tenants: tenantsCount ?? 0,
      businessTypes: businessTypesCount ?? 0,
      appointmentsToday: appointmentsTodayCount ?? 0,
      appointmentsTotal: appointmentsTotalCount ?? 0,
      activeTenants: activeTenantsCount ?? 0,
      crmCustomers: crmCustomersCount ?? 0,
      campaignMessages: campaignMessagesCount ?? 0,
      services: servicesCount ?? 0,
      staff: staffCount ?? 0,
      reviews: reviewsCount ?? 0,
      recentAppointments,
      recentCampaigns,
    });
  } catch (err) {
    console.error("[admin stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
