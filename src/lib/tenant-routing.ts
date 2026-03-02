import { supabase } from "@/lib/supabase";
import {
  parseTenantCodeFromMessage,
  sanitizeIncomingCustomerMessage,
} from "@/lib/tenant-code";

export type RoutingReason =
  | "marker"
  | "name"
  | "session"
  | "nlp"
  | "default"
  | "none";

export type IntentDomain = "haircare" | "carcare";

interface TenantSummary {
  id: string;
  name: string;
  status?: string | null;
}

interface TenantProfile extends TenantSummary {
  businessTypeName?: string;
  businessTypeSlug?: string;
  serviceTexts: string[];
}

interface RoutingInput {
  customerPhone: string;
  rawMessage: string;
  previousTenantId: string | null;
}

export interface RoutingDecision {
  tenantId: string | null;
  tenantName: string | null;
  reason: RoutingReason;
  normalizedMessage: string;
  intentDomain: IntentDomain | null;
  tenantCode: string | null;
}

export interface TenantSwitchLogInput {
  customerPhone: string;
  previousTenantId: string | null;
  nextTenantId: string;
  switchReason: Exclude<RoutingReason, "none">;
  intentDomain?: IntentDomain | null;
  tenantCode?: string | null;
  messagePreview?: string;
}

const DOMAIN_KEYWORDS: Record<IntentDomain, Array<{ term: string; weight: number }>> = {
  haircare: [
    { term: "berber", weight: 3 },
    { term: "kuafor", weight: 3 },
    { term: "sac", weight: 2 },
    { term: "sakal", weight: 2 },
    { term: "tras", weight: 2 },
    { term: "fön", weight: 1 },
    { term: "fon", weight: 1 },
    { term: "boya", weight: 1 },
    { term: "cilt", weight: 1 },
  ],
  carcare: [
    { term: "oto", weight: 2 },
    { term: "araba", weight: 2 },
    { term: "arac", weight: 2 },
    { term: "yikama", weight: 2 },
    { term: "pasta cila", weight: 4 },
    { term: "cila", weight: 2 },
    { term: "detayli", weight: 2 },
    { term: "seramik", weight: 2 },
    { term: "koltuk yikama", weight: 2 },
  ],
};

let switchLogSchemaAvailable: boolean | null = null;

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalize(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function scoreTenantNameMatch(message: string, tenantName: string): number {
  const messageNorm = normalizeText(message);
  const messageCanonical = canonicalize(messageNorm);
  const tenantNorm = normalizeText(tenantName);
  const tenantCanonical = canonicalize(tenantNorm);

  if (!tenantCanonical || tenantCanonical.length < 3) return 0;

  let score = 0;

  // Strongest signal: full business name is present in message.
  if (messageCanonical.includes(tenantCanonical)) {
    score += 140 + Math.min(40, tenantCanonical.length);
  }

  const tokenSet = tenantNorm
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  if (tokenSet.length > 0) {
    const matched = tokenSet.filter((t) => messageNorm.includes(t));
    score += matched.length * 12;
    if (matched.length === tokenSet.length) score += 35;
    if (matched.length >= 2) score += 20;
  }

  return score;
}

function normalizeTenantStatus(status: string | null | undefined): string {
  return (status || "").toLocaleLowerCase("tr-TR").trim();
}

function isTenantRoutable(status: string | null | undefined): boolean {
  const normalized = normalizeTenantStatus(status);
  if (!normalized) return true;
  if (normalized === "active" || normalized === "aktif") return true;
  if (normalized === "enabled" || normalized === "on") return true;
  return false;
}

async function getTenantSummaryByNameMention(message: string): Promise<TenantSummary | null> {
  const canonicalMessage = canonicalize(message);
  if (!canonicalMessage || canonicalMessage.length < 3) return null;

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, status")
    .is("deleted_at", null)
    .limit(800);

  if (error || !data || data.length === 0) return null;

  let best: TenantSummary | null = null;
  let bestScore = 0;

  for (const tenant of data) {
    if (!isTenantRoutable(tenant.status)) continue;
    const score = scoreTenantNameMatch(message, tenant.name);
    if (score > bestScore) {
      bestScore = score;
      best = { id: tenant.id, name: tenant.name, status: tenant.status };
      continue;
    }
    if (score > 0 && score === bestScore && best) {
      // Tie-break: prefer longer business name match.
      if (canonicalize(tenant.name).length > canonicalize(best.name).length) {
        best = { id: tenant.id, name: tenant.name, status: tenant.status };
      }
    }
  }

  // Lower threshold allows natural phrases like "merhaba <işletme adı>" while avoiding noise.
  return bestScore >= 45 ? best : null;
}

function scoreDomain(text: string, domain: IntentDomain): number {
  const normalized = normalizeText(text);
  return DOMAIN_KEYWORDS[domain].reduce((acc, { term, weight }) => {
    if (!normalized) return acc;
    return normalized.includes(term) ? acc + weight : acc;
  }, 0);
}

function detectIntentDomain(message: string): IntentDomain | null {
  const hairScore = scoreDomain(message, "haircare");
  const carScore = scoreDomain(message, "carcare");
  const maxScore = Math.max(hairScore, carScore);
  if (maxScore < 2) return null;
  if (hairScore === carScore) return null;
  return hairScore > carScore ? "haircare" : "carcare";
}

function inferTenantDomain(profile: TenantProfile): IntentDomain | null {
  const profileText = [
    profile.name,
    profile.businessTypeName || "",
    profile.businessTypeSlug || "",
    ...profile.serviceTexts,
  ].join(" ");
  return detectIntentDomain(profileText);
}

function isMissingTenantSwitchTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("tenant_switch_logs") && m.includes("schema cache")) ||
    (m.includes("tenant_switch_logs") && m.includes("does not exist")) ||
    (m.includes("tenant_switch_logs") && m.includes("relation"))
  );
}

async function getTenantSummaryById(tenantId: string): Promise<TenantSummary | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, status")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
  if (!isTenantRoutable(data.status)) return null;
  return data;
}

async function getTenantSummaryByCode(tenantCode: string): Promise<TenantSummary | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, status")
    .eq("tenant_code", tenantCode.toUpperCase())
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
  if (!isTenantRoutable(data.status)) return null;
  return data;
}

async function getRecentCustomerTenantIds(
  customerPhone: string,
  limit = 12
): Promise<string[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("tenant_id, updated_at")
    .eq("customer_phone", customerPhone)
    .order("updated_at", { ascending: false })
    .limit(120);
  if (error || !data || data.length === 0) return [];

  const unique: string[] = [];
  for (const row of data) {
    if (!row.tenant_id) continue;
    if (!unique.includes(row.tenant_id)) unique.push(row.tenant_id);
    if (unique.length >= limit) break;
  }
  return unique;
}

async function getTenantProfiles(tenantIds: string[]): Promise<Map<string, TenantProfile>> {
  const uniqueIds = [...new Set(tenantIds)];
  if (uniqueIds.length === 0) return new Map();

  const [tenantsRes, servicesRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, business_type_id, status")
      .in("id", uniqueIds)
      .is("deleted_at", null),
    supabase.from("services").select("tenant_id, name, slug").in("tenant_id", uniqueIds),
  ]);

  const tenantRows = tenantsRes.data || [];
  const serviceRows = servicesRes.data || [];
  const typeIds = [...new Set(tenantRows.map((t) => t.business_type_id).filter(Boolean))];

  const businessTypeMap = new Map<string, { name: string; slug: string }>();
  if (typeIds.length > 0) {
    const { data: typeRows } = await supabase
      .from("business_types")
      .select("id, name, slug")
      .in("id", typeIds);
    for (const bt of typeRows || []) {
      businessTypeMap.set(bt.id, { name: bt.name, slug: bt.slug });
    }
  }

  const servicesByTenant = new Map<string, string[]>();
  for (const svc of serviceRows) {
    const arr = servicesByTenant.get(svc.tenant_id) || [];
    arr.push(`${svc.name || ""} ${svc.slug || ""}`.trim());
    servicesByTenant.set(svc.tenant_id, arr);
  }

  const profiles = new Map<string, TenantProfile>();
  for (const t of tenantRows) {
    if (!isTenantRoutable(t.status)) continue;
    const bt = businessTypeMap.get(t.business_type_id);
    profiles.set(t.id, {
      id: t.id,
      name: t.name,
      status: t.status,
      businessTypeName: bt?.name,
      businessTypeSlug: bt?.slug,
      serviceTexts: servicesByTenant.get(t.id) || [],
    });
  }
  return profiles;
}

function pickBestNlpTenant(
  candidateOrder: string[],
  profiles: Map<string, TenantProfile>,
  requestedDomain: IntentDomain,
  excludeTenantId: string
): TenantSummary | null {
  const byId = new Map<string, TenantSummary>();
  for (const id of candidateOrder) {
    if (id === excludeTenantId) continue;
    const profile = profiles.get(id);
    if (!profile) continue;
    const domain = inferTenantDomain(profile);
    if (domain !== requestedDomain) continue;
    byId.set(id, { id: profile.id, name: profile.name });
  }
  for (const id of candidateOrder) {
    const picked = byId.get(id);
    if (picked) return picked;
  }
  return null;
}

export async function resolveTenantRouting(input: RoutingInput): Promise<RoutingDecision> {
  const { customerPhone, rawMessage, previousTenantId } = input;

  const tenantCode = parseTenantCodeFromMessage(rawMessage);
  const normalizedMessage =
    sanitizeIncomingCustomerMessage(rawMessage, tenantCode) || rawMessage;

  if (tenantCode) {
    const byCode = await getTenantSummaryByCode(tenantCode);
    if (byCode) {
      return {
        tenantId: byCode.id,
        tenantName: byCode.name,
        reason: "marker",
        normalizedMessage,
        intentDomain: detectIntentDomain(normalizedMessage),
        tenantCode,
      };
    }
  }

  const byName = await getTenantSummaryByNameMention(normalizedMessage);
  if (byName) {
    return {
      tenantId: byName.id,
      tenantName: byName.name,
      reason: "name",
      normalizedMessage,
      intentDomain: detectIntentDomain(normalizedMessage),
      tenantCode,
    };
  }

  const intentDomain = detectIntentDomain(normalizedMessage);
  if (previousTenantId) {
    if (intentDomain) {
      const historyIds = await getRecentCustomerTenantIds(customerPhone, 12);
      const candidateOrder = [
        ...new Set([previousTenantId, ...historyIds]),
      ];
      const profiles = await getTenantProfiles(candidateOrder);
      const previousProfile = profiles.get(previousTenantId);
      const previousDomain = previousProfile
        ? inferTenantDomain(previousProfile)
        : null;

      if (previousDomain && previousDomain !== intentDomain) {
        const nlpMatch = pickBestNlpTenant(
          candidateOrder,
          profiles,
          intentDomain,
          previousTenantId
        );
        if (nlpMatch) {
          return {
            tenantId: nlpMatch.id,
            tenantName: nlpMatch.name,
            reason: "nlp",
            normalizedMessage,
            intentDomain,
            tenantCode,
          };
        }
      }
    }

    const previous = await getTenantSummaryById(previousTenantId);
    if (previous) {
      return {
        tenantId: previous.id,
        tenantName: previous.name,
        reason: "session",
        normalizedMessage,
        intentDomain,
        tenantCode,
      };
    }
  }

  return {
    tenantId: null,
    tenantName: null,
    reason: "none",
    normalizedMessage,
    intentDomain,
    tenantCode,
  };
}

export async function logTenantSwitch(
  input: TenantSwitchLogInput
): Promise<void> {
  if (switchLogSchemaAvailable === false) return;
  const payload = {
    customer_phone: input.customerPhone,
    previous_tenant_id: input.previousTenantId,
    next_tenant_id: input.nextTenantId,
    switch_reason: input.switchReason,
    intent_domain: input.intentDomain || null,
    tenant_code: input.tenantCode || null,
    message_preview: (input.messagePreview || "").slice(0, 500),
  };
  const { error } = await supabase.from("tenant_switch_logs").insert(payload);
  if (!error) {
    switchLogSchemaAvailable = true;
    return;
  }
  const message = error.message || "";
  if (isMissingTenantSwitchTable(message)) {
    switchLogSchemaAvailable = false;
    console.warn(
      "[routing] tenant_switch_logs tablosu yok. migration 013 uygulanmalı."
    );
    return;
  }
  console.error("[routing] tenant switch log insert error:", message);
}
