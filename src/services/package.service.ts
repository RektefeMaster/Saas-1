import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { normalizePhoneE164, normalizePhoneDigits } from "@/lib/phone";

function normalizePhoneForQuery(input: string): string {
  const e164 = normalizePhoneE164(input);
  if (e164) return e164;
  return normalizePhoneDigits(input) || input.replace(/\s+/g, "").trim();
}

interface PackageRelRow {
  id?: string;
  name?: string;
  service_slug?: string;
}

interface CustomerPackageRow {
  id: string;
  package_id: string;
  remaining_sessions: number;
  total_sessions: number;
  expires_at: string | null;
  packages?: PackageRelRow | PackageRelRow[] | null;
}

export interface ActiveCustomerPackage {
  customerPackageId: string;
  packageId: string;
  packageName: string;
  serviceSlug: string;
  remainingSessions: number;
  totalSessions: number;
  expiresAt: string | null;
}

function toPackageRel(input: unknown): PackageRelRow | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const first = input[0];
    return first && typeof first === "object" ? (first as PackageRelRow) : null;
  }
  if (typeof input === "object") return input as PackageRelRow;
  return null;
}

export async function checkCustomerPackage(
  tenantId: string,
  customerPhone: string,
  serviceSlug: string
): Promise<ActiveCustomerPackage | null> {
  const normalizedPhone = normalizePhoneForQuery(customerPhone);
  if (!normalizedPhone || !serviceSlug?.trim()) return null;

  const nowIso = new Date().toISOString();
  const result = await supabase
    .from("customer_packages")
    .select(
      "id, package_id, remaining_sessions, total_sessions, expires_at, packages!inner(id, name, service_slug, is_active)"
    )
    .eq("tenant_id", tenantId)
    .eq("customer_phone", normalizedPhone)
    .eq("status", "active")
    .gt("remaining_sessions", 0)
    .eq("packages.service_slug", serviceSlug)
    .eq("packages.is_active", true)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order("purchased_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "customer_packages" || missingTable === "packages") {
      return null;
    }
    throw new Error(result.error.message);
  }

  const row = result.data as CustomerPackageRow | null;
  if (!row) return null;

  const pkg = toPackageRel(row.packages);
  return {
    customerPackageId: row.id,
    packageId: row.package_id,
    packageName: pkg?.name || "Paket",
    serviceSlug: pkg?.service_slug || serviceSlug,
    remainingSessions: Number(row.remaining_sessions || 0),
    totalSessions: Number(row.total_sessions || 0),
    expiresAt: row.expires_at || null,
  };
}

interface ConsumeRpcRow {
  id: string;
  remaining_sessions: number;
  status: string;
}

export async function consumeCustomerPackageSession(customerPackageId: string): Promise<{
  ok: boolean;
  remainingSessions?: number;
  status?: string;
  error?: string;
}> {
  const rpcResult = await supabase.rpc("consume_customer_package_session", {
    p_customer_package_id: customerPackageId,
  });

  if (!rpcResult.error) {
    const rows = (rpcResult.data || []) as ConsumeRpcRow[];
    const first = rows[0];
    if (!first) {
      return { ok: false, error: "NO_ACTIVE_PACKAGE_SESSION" };
    }
    return {
      ok: true,
      remainingSessions: Number(first.remaining_sessions || 0),
      status: first.status || "active",
    };
  }

  if (rpcResult.error.code !== "42883") {
    return { ok: false, error: rpcResult.error.message };
  }

  const read = await supabase
    .from("customer_packages")
    .select("id, remaining_sessions, status, expires_at")
    .eq("id", customerPackageId)
    .eq("status", "active")
    .gt("remaining_sessions", 0)
    .maybeSingle();

  if (read.error || !read.data) {
    return { ok: false, error: read.error?.message || "NO_ACTIVE_PACKAGE_SESSION" };
  }

  const expiresAt = read.data.expires_at ? new Date(read.data.expires_at) : null;
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "PACKAGE_EXPIRED" };
  }

  const nextRemaining = Number(read.data.remaining_sessions || 0) - 1;
  const nextStatus = nextRemaining <= 0 ? "completed" : "active";
  const update = await supabase
    .from("customer_packages")
    .update({
      remaining_sessions: Math.max(0, nextRemaining),
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerPackageId)
    .eq("status", "active")
    .gt("remaining_sessions", 0)
    .select("remaining_sessions, status")
    .maybeSingle();

  if (update.error || !update.data) {
    return { ok: false, error: update.error?.message || "NO_ACTIVE_PACKAGE_SESSION" };
  }

  return {
    ok: true,
    remainingSessions: Number(update.data.remaining_sessions || 0),
    status: update.data.status || nextStatus,
  };
}
