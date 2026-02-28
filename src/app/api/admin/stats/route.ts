import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      tenants: 0,
      businessTypes: 0,
      appointmentsToday: 0,
      appointmentsTotal: 0,
      activeTenants: 0,
    });
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
    ]);

    return NextResponse.json({
      tenants: tenantsCount ?? 0,
      businessTypes: businessTypesCount ?? 0,
      appointmentsToday: appointmentsTodayCount ?? 0,
      appointmentsTotal: appointmentsTotalCount ?? 0,
      activeTenants: activeTenantsCount ?? 0,
    });
  } catch (err) {
    console.error("[admin stats]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası" },
      { status: 500 }
    );
  }
}
