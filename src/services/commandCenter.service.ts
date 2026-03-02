import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import type {
  CommandCenterAction,
  CommandCenterKpis,
  CommandCenterSnapshot,
} from "@/types/master-crm.types";
import { detectBlueprintSlug } from "@/services/blueprint.service";

interface AtRiskCustomer {
  customer_phone: string;
  total_visits: number;
  last_visit_at: string | null;
  days_since_last_visit: number;
}

function round(value: number, precision = 2): number {
  const p = 10 ** precision;
  return Math.round((value + Number.EPSILON) * p) / p;
}

function diffDays(dateIso: string): number {
  const now = Date.now();
  const d = new Date(dateIso).getTime();
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, Math.floor((now - d) / (24 * 60 * 60 * 1000)));
}

function toIso(date: Date): string {
  return date.toISOString();
}

async function listAtRiskCustomers(
  tenantId: string,
  minDays = 45,
  limit = 50
): Promise<AtRiskCustomer[]> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - minDays);

  const crmRes = await supabase
    .from("crm_customers")
    .select("customer_phone, total_visits, last_visit_at")
    .eq("tenant_id", tenantId)
    .not("last_visit_at", "is", null)
    .lte("last_visit_at", threshold.toISOString())
    .order("last_visit_at", { ascending: true })
    .limit(Math.max(limit, 200));

  if (!crmRes.error) {
    return (crmRes.data || [])
      .map((row) => ({
        customer_phone: row.customer_phone,
        total_visits: row.total_visits || 0,
        last_visit_at: row.last_visit_at,
        days_since_last_visit: row.last_visit_at ? diffDays(row.last_visit_at) : 0,
      }))
      .filter((row) => row.total_visits >= 2)
      .slice(0, limit);
  }

  const missing = extractMissingSchemaTable(crmRes.error);
  if (missing !== "crm_customers") {
    throw new Error(crmRes.error.message);
  }

  const aptRes = await supabase
    .from("appointments")
    .select("customer_phone, slot_start, status")
    .eq("tenant_id", tenantId)
    .in("status", ["confirmed", "completed", "no_show"])
    .order("slot_start", { ascending: false })
    .limit(1500);

  if (aptRes.error) throw new Error(aptRes.error.message);

  const map = new Map<string, { visits: number; last: string }>();
  for (const row of aptRes.data || []) {
    const key = row.customer_phone;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { visits: 1, last: row.slot_start });
    } else {
      prev.visits += 1;
      if (new Date(row.slot_start).getTime() > new Date(prev.last).getTime()) {
        prev.last = row.slot_start;
      }
    }
  }

  return Array.from(map.entries())
    .map(([customer_phone, value]) => ({
      customer_phone,
      total_visits: value.visits,
      last_visit_at: value.last,
      days_since_last_visit: diffDays(value.last),
    }))
    .filter((row) => row.total_visits >= 2 && row.days_since_last_visit >= minDays)
    .sort((a, b) => b.days_since_last_visit - a.days_since_last_visit)
    .slice(0, limit);
}

async function getRevenueSummary(tenantId: string, startIso: string, endIso: string) {
  const revenueRes = await supabase
    .from("revenue_events")
    .select("net_amount, source, meta")
    .eq("tenant_id", tenantId)
    .gte("event_at", startIso)
    .lte("event_at", endIso);

  if (!revenueRes.error) {
    const rows = revenueRes.data || [];
    const monthlyRevenue = rows.reduce((sum, row) => sum + Number(row.net_amount || 0), 0);
    const aiRevenue = rows.reduce((sum, row) => {
      const aiAssisted =
        row.source === "appointment" ||
        ((row.meta as Record<string, unknown> | null)?.ai_assisted === true);
      return aiAssisted ? sum + Number(row.net_amount || 0) : sum;
    }, 0);
    return {
      monthlyRevenue,
      aiRevenue,
      source: "ledger" as const,
    };
  }

  const missing = extractMissingSchemaTable(revenueRes.error);
  if (missing !== "revenue_events") {
    throw new Error(revenueRes.error.message);
  }

  const [aptRes, serviceRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("service_slug, status")
      .eq("tenant_id", tenantId)
      .gte("slot_start", startIso)
      .lte("slot_start", endIso)
      .in("status", ["confirmed", "completed"]),
    supabase
      .from("services")
      .select("slug, price")
      .eq("tenant_id", tenantId),
  ]);

  if (aptRes.error) throw new Error(aptRes.error.message);
  if (serviceRes.error) throw new Error(serviceRes.error.message);

  const priceMap = new Map<string, number>();
  for (const svc of serviceRes.data || []) {
    priceMap.set(svc.slug, Number(svc.price || 0));
  }

  let estimated = 0;
  for (const apt of aptRes.data || []) {
    estimated += Number(priceMap.get(apt.service_slug || "") || 0);
  }

  return {
    monthlyRevenue: estimated,
    aiRevenue: estimated * 0.7,
    source: "estimated" as const,
  };
}

async function getFillRatePct(tenantId: string): Promise<number> {
  const now = new Date();
  const until = new Date();
  until.setDate(until.getDate() + 7);

  const [tenantRes, slotsRes, appointmentsRes] = await Promise.all([
    supabase.from("tenants").select("config_override").eq("id", tenantId).single(),
    supabase
      .from("availability_slots")
      .select("day_of_week, start_time, end_time")
      .eq("tenant_id", tenantId),
    supabase
      .from("appointments")
      .select("id")
      .eq("tenant_id", tenantId)
      .neq("status", "cancelled")
      .gte("slot_start", now.toISOString())
      .lte("slot_start", until.toISOString()),
  ]);

  if (appointmentsRes.error) throw new Error(appointmentsRes.error.message);
  if (slotsRes.error) throw new Error(slotsRes.error.message);

  const override = (tenantRes.data?.config_override || {}) as Record<string, unknown>;
  const slotDuration = Math.max(5, Number(override.slot_duration_minutes || 30));

  const slots = slotsRes.data || [];
  const hasConfiguredSlots = slots.length > 0;

  let possibleSlots = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dow = d.getDay();

    if (!hasConfiguredSlots) {
      if (dow === 0) continue;
      possibleSlots += Math.floor((9 * 60) / slotDuration);
      continue;
    }

    const day = slots.find((s) => s.day_of_week === dow);
    if (!day) continue;
    const [sh, sm] = day.start_time.split(":").map(Number);
    const [eh, em] = day.end_time.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    if (diff > 0) {
      possibleSlots += Math.floor(diff / slotDuration);
    }
  }

  const booked = (appointmentsRes.data || []).length;
  if (possibleSlots <= 0) return 0;
  return round((booked / possibleSlots) * 100, 1);
}

export async function getCommandCenterSnapshot(
  tenantId: string
): Promise<CommandCenterSnapshot> {
  const now = new Date();
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [tenantRes, appointmentsRes, reviewsRes, alertsRes, atRiskCustomers] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, business_type_id")
        .eq("id", tenantId)
        .single(),
      supabase
        .from("appointments")
        .select("status")
        .eq("tenant_id", tenantId)
        .gte("slot_start", monthStart.toISOString())
        .lte("slot_start", now.toISOString()),
      supabase
        .from("reviews")
        .select("rating")
        .eq("tenant_id", tenantId)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", now.toISOString()),
      supabase
        .from("ops_alerts")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "open"),
      listAtRiskCustomers(tenantId, 45, 100),
    ]);

  if (tenantRes.error || !tenantRes.data) {
    throw new Error(tenantRes.error?.message || "Tenant bulunamadi");
  }

  const btRes = await supabase
    .from("business_types")
    .select("slug, name")
    .eq("id", tenantRes.data.business_type_id)
    .maybeSingle();

  const blueprintSlug = detectBlueprintSlug(btRes.data?.slug, btRes.data?.name);

  if (appointmentsRes.error) throw new Error(appointmentsRes.error.message);

  let avgRating = 0;
  if (!reviewsRes.error) {
    const ratings = (reviewsRes.data || []).map((r) => Number(r.rating || 0)).filter((r) => r > 0);
    if (ratings.length > 0) {
      avgRating = round(ratings.reduce((a, b) => a + b, 0) / ratings.length, 1);
    }
  } else if (extractMissingSchemaTable(reviewsRes.error) !== "reviews") {
    throw new Error(reviewsRes.error.message);
  }

  let openOpsAlerts = 0;
  if (!alertsRes.error) {
    openOpsAlerts = (alertsRes.data || []).length;
  } else if (extractMissingSchemaTable(alertsRes.error) !== "ops_alerts") {
    throw new Error(alertsRes.error.message);
  }

  const statuses = appointmentsRes.data || [];
  const monthlyAppointments = statuses.length;
  const noShowCount = statuses.filter((a) => a.status === "no_show").length;
  const completedCount = statuses.filter((a) => a.status === "completed").length;
  const cancelledCount = statuses.filter((a) => a.status === "cancelled").length;

  const noShowRatePct =
    completedCount + noShowCount > 0
      ? round((noShowCount / (completedCount + noShowCount)) * 100, 1)
      : 0;

  const cancellationRatePct =
    monthlyAppointments > 0 ? round((cancelledCount / monthlyAppointments) * 100, 1) : 0;

  const fillRatePct = await getFillRatePct(tenantId);

  const revenue = await getRevenueSummary(
    tenantId,
    toIso(monthStart),
    toIso(now)
  );

  const avgTicketTry =
    completedCount > 0 ? round(revenue.monthlyRevenue / completedCount, 2) : 0;

  const kpis: CommandCenterKpis = {
    monthly_revenue_try: round(revenue.monthlyRevenue, 2),
    monthly_appointments: monthlyAppointments,
    no_show_rate_pct: noShowRatePct,
    cancellation_rate_pct: cancellationRatePct,
    fill_rate_pct: fillRatePct,
    avg_ticket_try: avgTicketTry,
    at_risk_customers: atRiskCustomers.length,
    open_ops_alerts: openOpsAlerts,
    avg_rating: avgRating,
    north_star_ai_revenue_try: round(revenue.aiRevenue, 2),
  };

  const actions: CommandCenterAction[] = [];

  if (atRiskCustomers.length > 0) {
    actions.push({
      id: "reactivation",
      title: "Musteri geri kazanimi",
      description: `${atRiskCustomers.length} musteri yeniden kazanilmaya aday.`,
      severity: "high",
      cta_label: "Kampanyayi hazirla",
      cta_endpoint: `/api/tenant/${tenantId}/automation/reactivation`,
      estimated_impact_try: round(atRiskCustomers.length * Math.max(avgTicketTry, 300) * 0.2, 2),
    });
  }

  if (fillRatePct < 60) {
    actions.push({
      id: "slot_fill",
      title: "Bos saatleri doldur",
      description: `Doluluk orani %${fillRatePct}. Bekleme listesi ve hatirlatma ile artis firsati var.`,
      severity: "medium",
      cta_label: "Slot doldurma kurali",
      cta_endpoint: `/api/tenant/${tenantId}/automation/reactivation`,
      estimated_impact_try: round(Math.max(avgTicketTry, 250) * 6, 2),
    });
  }

  if (noShowRatePct >= 8) {
    actions.push({
      id: "no_show_mitigation",
      title: "No-show azalt",
      description: `No-show orani %${noShowRatePct}. Cift hatirlatma ve onay akislarini acin.`,
      severity: "high",
      cta_label: "No-show otomasyonu",
      cta_endpoint: `/api/tenant/${tenantId}/automation/reactivation`,
      estimated_impact_try: round(Math.max(avgTicketTry, 250) * 4, 2),
    });
  }

  if (avgRating > 0 && avgRating < 4.2) {
    actions.push({
      id: "reputation_recovery",
      title: "Itibar iyilestirme",
      description: `Ortalama puan ${avgRating}. Memnuniyet takibi ve kurtarma akislarini hizlandirin.`,
      severity: "medium",
      cta_label: "Itibar ozeti",
      cta_endpoint: `/api/tenant/${tenantId}/reputation/summary`,
      estimated_impact_try: round(Math.max(avgTicketTry, 250) * 2, 2),
    });
  }

  if (openOpsAlerts > 0) {
    actions.push({
      id: "ops_alerts",
      title: "Operasyon uyarilari",
      description: `${openOpsAlerts} acik operasyon uyarisi var.`,
      severity: openOpsAlerts > 3 ? "high" : "medium",
      cta_label: "Uyarilari kapat",
      cta_endpoint: `/api/tenant/${tenantId}/ops-alerts`,
      estimated_impact_try: 0,
    });
  }

  return {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    blueprint_slug: blueprintSlug,
    kpis,
    actions,
  };
}

export async function getAtRiskCustomers(
  tenantId: string,
  minDays = 45,
  limit = 20
): Promise<AtRiskCustomer[]> {
  return listAtRiskCustomers(tenantId, minDays, limit);
}
