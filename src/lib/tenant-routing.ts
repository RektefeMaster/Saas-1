import { supabase } from "@/lib/supabase";
import {
  parseTenantCodeFromMessage,
  sanitizeIncomingCustomerMessage,
} from "@/lib/tenant-code";

export type RoutingReason =
  | "marker"
  | "session"
  | "nlp"
  | "default"
  | "none";

export type IntentDomain = "haircare" | "carcare";

interface TenantSummary {
  id: string;
  name: string;
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
    .select("id, name")
    .eq("id", tenantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
  return data;
}

async function getTenantSummaryByCode(tenantCode: string): Promise<TenantSummary | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("tenant_code", tenantCode.toUpperCase())
    .eq("status", "active")
    .is("deleted_at", null)
    .single();
  if (error || !data) return null;
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
      .select("id, name, business_type_id")
      .in("id", uniqueIds)
      .eq("status", "active")
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
    const bt = businessTypeMap.get(t.business_type_id);
    profiles.set(t.id, {
      id: t.id,
      name: t.name,
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
