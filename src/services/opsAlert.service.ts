import { supabase } from "@/lib/supabase";

export type OpsAlertType = "delay" | "cancellation" | "no_show" | "system";
export type OpsAlertSeverity = "low" | "medium" | "high";
export type OpsAlertStatus = "open" | "resolved";

export interface OpsAlert {
  id: string;
  tenant_id: string;
  type: OpsAlertType;
  severity: OpsAlertSeverity;
  customer_phone: string | null;
  message: string;
  meta: Record<string, unknown>;
  dedupe_key: string | null;
  status: OpsAlertStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateOpsAlertInput {
  tenantId: string;
  type: OpsAlertType;
  severity?: OpsAlertSeverity;
  customerPhone?: string | null;
  message: string;
  meta?: Record<string, unknown>;
  dedupeKey?: string;
}

export async function createOpsAlert(input: CreateOpsAlertInput): Promise<void> {
  const payload = {
    tenant_id: input.tenantId,
    type: input.type,
    severity: input.severity || "medium",
    customer_phone: input.customerPhone || null,
    message: input.message,
    meta: input.meta || {},
    dedupe_key: input.dedupeKey || null,
    status: "open",
  };

  const { error } = await supabase.from("ops_alerts").insert(payload);
  if (!error) return;

  // duplicate dedupe key -> ignore safely
  if (error.code === "23505") return;
  throw new Error(error.message);
}

export async function listOpsAlerts(
  tenantId: string,
  status: OpsAlertStatus = "open",
  limit = 20
): Promise<OpsAlert[]> {
  const { data, error } = await supabase
    .from("ops_alerts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));

  if (error) throw new Error(error.message);
  return (data || []) as OpsAlert[];
}

export async function resolveOpsAlert(
  tenantId: string,
  alertId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("ops_alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", alertId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Uyarı bulunamadı" };
  }
  return { ok: true };
}
