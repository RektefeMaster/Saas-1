import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { getAtRiskCustomers } from "@/services/commandCenter.service";

export interface ReactivationCandidate {
  customer_phone: string;
  total_visits: number;
  last_visit_at: string | null;
  days_since_last_visit: number;
  risk_level: "low" | "medium" | "high";
  score: number;
}

function computeRisk(days: number, visits: number): {
  risk_level: "low" | "medium" | "high";
  score: number;
} {
  const score = Math.min(100, Math.round(days * 0.9 + visits * 3));
  if (days >= 90) return { risk_level: "high", score };
  if (days >= 50) return { risk_level: "medium", score };
  return { risk_level: "low", score };
}

export async function listReactivationCandidates(
  tenantId: string,
  days = 45,
  limit = 20
): Promise<ReactivationCandidate[]> {
  const base = await getAtRiskCustomers(tenantId, days, limit);

  const candidates = base.map((row) => {
    const risk = computeRisk(row.days_since_last_visit, row.total_visits);
    return {
      ...row,
      ...risk,
    };
  });

  // Keep retention_segments updated when table exists.
  const upserts = candidates.map((c) => ({
    tenant_id: tenantId,
    customer_phone: c.customer_phone,
    segment_key: c.days_since_last_visit >= 90 ? "churned" : "at_risk",
    score: c.score,
    risk_level: c.risk_level,
    metadata: {
      total_visits: c.total_visits,
      days_since_last_visit: c.days_since_last_visit,
      source: "reactivation_candidates",
    },
    updated_at: new Date().toISOString(),
  }));

  if (upserts.length > 0) {
    const upsertRes = await supabase
      .from("retention_segments")
      .upsert(upserts, {
        onConflict: "tenant_id,customer_phone,segment_key",
      });

    if (upsertRes.error) {
      const missing = extractMissingSchemaTable(upsertRes.error);
      if (missing !== "retention_segments") {
        throw new Error(upsertRes.error.message);
      }
    }
  }

  return candidates;
}

export async function queueReactivationCampaign(input: {
  tenantId: string;
  phones: string[];
  title?: string;
  note?: string;
  remindAt?: string;
  channel?: "panel" | "whatsapp" | "both";
}) {
  const remindAt = input.remindAt || new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const title = input.title?.trim() || "Geri kazanım mesaji";
  const note = input.note?.trim() || "Uzun suredir gorusmedik, size ozel bir uygunluk sunmak isteriz.";
  const channel = input.channel || "both";

  const rows = [...new Set(input.phones)]
    .filter(Boolean)
    .map((phone) => ({
      tenant_id: input.tenantId,
      customer_phone: phone,
      title,
      note,
      remind_at: remindAt,
      channel,
      status: "pending",
    }));

  if (rows.length === 0) {
    return { queued: 0 };
  }

  const reminderRes = await supabase
    .from("crm_reminders")
    .insert(rows)
    .select("id");

  if (reminderRes.error) {
    const missing = extractMissingSchemaTable(reminderRes.error);
    if (missing === "crm_reminders") {
      throw new Error("CRM reminders tablosu eksik. Migration 010 uygulanmali.");
    }
    throw new Error(reminderRes.error.message);
  }

  const ruleRes = await supabase
    .from("automation_rules")
    .upsert(
      {
        tenant_id: input.tenantId,
        rule_type: "reactivation",
        status: "active",
        config: {
          channel,
          title,
        },
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,rule_type" }
    );

  if (ruleRes.error) {
    const missing = extractMissingSchemaTable(ruleRes.error);
    if (missing !== "automation_rules") {
      throw new Error(ruleRes.error.message);
    }
  }

  return {
    queued: (reminderRes.data || []).length,
    remind_at: remindAt,
    channel,
  };
}
