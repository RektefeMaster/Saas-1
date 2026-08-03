import { supabase } from "@/lib/supabase";
import {
  parseTenantCodeFromMessage,
  sanitizeIncomingCustomerMessage,
} from "@/lib/tenant-code";
import { normalizePhoneDigits } from "@/lib/phone";

export type RoutingReason =
  | "marker"
  | "name"
  | "session"
  | "customer_history"
  | "nlp"
  | "default"
  /** Mesajın ulaştığı kanal hesabından çözüldü — tahmin yok. */
  | "channel_account"
  /** Birden fazla benzer isimli işletme eşleşti; müşteriye soruldu. */
  | "ambiguous"
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
  /**
   * Müşteri "hangi işletme?" sorusuna listeden seçerek cevap verdiyse, seçilen
   * işletmenin kodu. Mesaj metninden çıkarılamaz (metin işletme adıdır ve zaten
   * belirsizdir), bu yüzden ayrı taşınır ve marker ile aynı önceliği alır.
   */
  tenantCodeHint?: string | null;
}

export interface TenantCandidate {
  id: string;
  name: string;
  tenantCode: string | null;
  /**
   * İşletmenin kendi telefonu. Adlar birebir aynı olduğunda listede tek ayırt
   * edici bilgi budur; WhatsApp satır başlığını 24 karaktere kırptığı için
   * yalnızca isim göstermek iki satırı ayırt edilemez hale getirebilir.
   */
  contactPhone: string | null;
}

export interface RoutingDecision {
  tenantId: string | null;
  tenantName: string | null;
  reason: RoutingReason;
  normalizedMessage: string;
  intentDomain: IntentDomain | null;
  tenantCode: string | null;
  /**
   * reason === "ambiguous" olduğunda birbirine yakın puan alan işletmeler.
   * Çağıran taraf tahmin etmek yerine müşteriye sormalıdır.
   */
  candidates?: TenantCandidate[];
}

export interface TenantSwitchLogInput {
  customerPhone: string;
  previousTenantId: string | null;
  nextTenantId: string;
  // "ambiguous" hiç tenant seçmez, dolayısıyla bir geçiş de üretmez.
  switchReason: Exclude<RoutingReason, "none" | "ambiguous">;
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

const TENANT_NAME_LIST_TTL_MS = 5 * 60 * 1000;
let tenantNameListCache: {
  expiry: number;
  rows: Array<{
    id: string;
    name: string;
    status: string | null;
    tenantCode: string | null;
    contactPhone: string | null;
  }>;
} | null = null;

/**
 * İsim eşleşmesinde ikinci adayın puanı birincinin bu oranına ulaşırsa karar
 * "belirsiz" sayılır. Yanlış işletmeye yönlendirmek, bir soru sormaktan çok
 * daha pahalıdır: başka bir işletmenin müşteri konuşması sızar.
 */
const AMBIGUITY_SCORE_RATIO = 0.9;
/** Müşteriye sorarken gösterilecek en fazla aday sayısı. */
const MAX_AMBIGUOUS_CANDIDATES = 5;

const BOOKING_STOPWORDS = new Set([
  "randevu",
  "musait",
  "müsait",
  "iptal",
  "yarin",
  "yarın",
  "bugun",
  "bugün",
  "saat",
  "tarih",
  "merhaba",
  "selam",
  "evet",
  "hayir",
  "hayır",
  "tamam",
  "lütfen",
  "lutfen",
  "istiyorum",
  "alabilir",
  "var",
  "mi",
  "mı",
  "mu",
  "mü",
  "icin",
  "için",
  "hafta",
  "pazartesi",
  "sali",
  "salı",
  "carsamba",
  "çarşamba",
  "persembe",
  "perşembe",
  "cuma",
  "cumartesi",
  "pazar",
]);

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

/** True when message may contain a business name worth scanning for. */
function looksLikeBusinessNameMention(message: string): boolean {
  const norm = normalizeText(message);
  if (!norm || norm.length < 4) return false;

  const tokens = norm
    .split(/[^a-z0-9çğıöşü]+/i)
    .map((t) => t.trim())
    .filter(Boolean);

  const residual = tokens.filter((t) => {
    if (t.length < 4) return false;
    if (/^\d+$/.test(t)) return false;
    if (BOOKING_STOPWORDS.has(t)) return false;
    return true;
  });

  return residual.length >= 1;
}

async function getCachedTenantNameRows(): Promise<
  Array<{
    id: string;
    name: string;
    status: string | null;
    tenantCode: string | null;
    contactPhone: string | null;
  }>
> {
  if (tenantNameListCache && tenantNameListCache.expiry > Date.now()) {
    return tenantNameListCache.rows;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, status, tenant_code, contact_phone")
    .is("deleted_at", null)
    .limit(800);

  if (error || !data) {
    return tenantNameListCache?.rows || [];
  }

  const rows = data.map((t) => {
    const row = t as {
      id: string;
      name: string;
      status?: string | null;
      tenant_code?: string | null;
      contact_phone?: string | null;
    };
    return {
      id: row.id,
      name: row.name,
      status: row.status ?? null,
      tenantCode: row.tenant_code ?? null,
      contactPhone: row.contact_phone ?? null,
    };
  });
  tenantNameListCache = {
    rows,
    expiry: Date.now() + TENANT_NAME_LIST_TTL_MS,
  };
  return rows;
}

type NameMatchResult =
  | { kind: "none" }
  | { kind: "match"; tenant: TenantSummary }
  | { kind: "ambiguous"; candidates: TenantCandidate[] };

/**
 * Mesajda geçen işletme adını eşleştirir.
 *
 * Eskiden en yüksek puanlı aday sessizce seçiliyordu; puanlar birbirine yakın
 * olduğunda (aynı/benzer isimli iki işletme) bu, konuşmanın yanlış işletmeye
 * düşmesi demekti. Artık yakın puanlı adaylar "belirsiz" olarak döner ve karar
 * müşteriye sorulur.
 */
async function matchTenantByNameMention(message: string): Promise<NameMatchResult> {
  const canonicalMessage = canonicalize(message);
  if (!canonicalMessage || canonicalMessage.length < 3) return { kind: "none" };
  if (!looksLikeBusinessNameMention(message)) return { kind: "none" };

  const data = await getCachedTenantNameRows();
  if (data.length === 0) return { kind: "none" };

  const scored: Array<{
    id: string;
    name: string;
    status: string | null;
    tenantCode: string | null;
    contactPhone: string | null;
    score: number;
  }> = [];

  for (const tenant of data) {
    if (!isTenantRoutable(tenant.status)) continue;
    const score = scoreTenantNameMatch(message, tenant.name);
    if (score >= 45) {
      scored.push({ ...tenant, score });
    }
  }

  if (scored.length === 0) return { kind: "none" };

  // Puan eşitliğinde daha uzun (daha spesifik) isim önce gelsin: eskiden de
  // eşitlik böyle çözülüyordu, davranış korunur.
  scored.sort(
    (a, b) => b.score - a.score || canonicalize(b.name).length - canonicalize(a.name).length
  );

  const best = scored[0];
  const rivals = scored.filter(
    (t) => t.id !== best.id && t.score >= best.score * AMBIGUITY_SCORE_RATIO
  );

  if (rivals.length > 0) {
    return {
      kind: "ambiguous",
      candidates: [best, ...rivals]
        .slice(0, MAX_AMBIGUOUS_CANDIDATES)
        .map((t) => ({
          id: t.id,
          name: t.name,
          tenantCode: t.tenantCode,
          contactPhone: t.contactPhone,
        })),
    };
  }

  return {
    kind: "match",
    tenant: { id: best.id, name: best.name, status: best.status },
  };
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
  const digits = normalizePhoneDigits(customerPhone);
  const candidates = [customerPhone];
  if (digits && digits !== customerPhone) candidates.push(digits);

  const { data, error } = await supabase
    .from("appointments")
    .select("tenant_id, updated_at")
    .in("customer_phone", candidates)
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

async function resolveStickyOrNlp(
  previousTenantId: string,
  customerPhone: string,
  intentDomain: IntentDomain | null,
  normalizedMessage: string,
  tenantCode: string | null
): Promise<RoutingDecision | null> {
  if (intentDomain) {
    const historyIds = await getRecentCustomerTenantIds(customerPhone, 12);
    const candidateOrder = [...new Set([previousTenantId, ...historyIds])];
    const profiles = await getTenantProfiles(candidateOrder);
    const previousDomain = profiles.get(previousTenantId)
      ? inferTenantDomain(profiles.get(previousTenantId)!)
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
  if (!previous) return null;
  return {
    tenantId: previous.id,
    tenantName: previous.name,
    reason: "session",
    normalizedMessage,
    intentDomain,
    tenantCode,
  };
}

export async function resolveTenantRouting(input: RoutingInput): Promise<RoutingDecision> {
  const { customerPhone, rawMessage, previousTenantId } = input;

  // Listeden seçim, mesaj içeriğinden çıkarılan her şeyi geçersiz kılar:
  // müşteri hangi işletmeyi kastettiğini açıkça söylemiştir.
  const hint = (input.tenantCodeHint || "").trim();
  if (hint) {
    const byHint = await getTenantSummaryByCode(hint);
    if (byHint) {
      return {
        tenantId: byHint.id,
        tenantName: byHint.name,
        reason: "marker",
        normalizedMessage: sanitizeIncomingCustomerMessage(rawMessage),
        intentDomain: null,
        tenantCode: hint.toUpperCase(),
      };
    }
  }

  const tenantCode = parseTenantCodeFromMessage(rawMessage);
  const sanitizedMessage = sanitizeIncomingCustomerMessage(rawMessage, tenantCode);
  const rawVisibleMessage = rawMessage
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedMessage = sanitizedMessage || rawVisibleMessage;
  const intentDomain = detectIntentDomain(normalizedMessage);
  const mayMentionBusiness = looksLikeBusinessNameMention(normalizedMessage);

  if (tenantCode) {
    const byCode = await getTenantSummaryByCode(tenantCode);
    if (byCode) {
      return {
        tenantId: byCode.id,
        tenantName: byCode.name,
        reason: "marker",
        normalizedMessage,
        intentDomain,
        tenantCode,
      };
    }
  }

  // Returning customers: sticky first unless message likely names a business.
  if (previousTenantId && !mayMentionBusiness) {
    const sticky = await resolveStickyOrNlp(
      previousTenantId,
      customerPhone,
      intentDomain,
      normalizedMessage,
      tenantCode
    );
    if (sticky) return sticky;
  }

  if (mayMentionBusiness) {
    const byName = await matchTenantByNameMention(normalizedMessage);

    if (byName.kind === "match") {
      return {
        tenantId: byName.tenant.id,
        tenantName: byName.tenant.name,
        reason: "name",
        normalizedMessage,
        intentDomain,
        tenantCode,
      };
    }

    if (byName.kind === "ambiguous") {
      // Adaylardan biri müşterinin hâlihazırda konuştuğu işletmeyse, soru
      // sormaya gerek yok: benzer isimler arasında doğru olan odur.
      const sticky = byName.candidates.find((c) => c.id === previousTenantId);
      if (sticky) {
        return {
          tenantId: sticky.id,
          tenantName: sticky.name,
          reason: "session",
          normalizedMessage,
          intentDomain,
          tenantCode,
        };
      }

      // Redis eşlemesi düşmüş olabilir; randevu geçmişi de ayırt edicidir.
      // Yalnızca TEK aday geçmişte varsa kullanılır — müşteri benzer isimli
      // işletmelerin ikisinden de hizmet aldıysa bu bir tahmin olurdu.
      const historyIds = await getRecentCustomerTenantIds(customerPhone, 12);
      const inHistory = byName.candidates.filter((c) => historyIds.includes(c.id));
      if (inHistory.length === 1) {
        return {
          tenantId: inHistory[0].id,
          tenantName: inHistory[0].name,
          reason: "customer_history",
          normalizedMessage,
          intentDomain,
          tenantCode,
        };
      }
      // Tahmin etme — sor. Yanlış eşleştirme başka bir işletmenin müşteri
      // konuşmasını sızdırır; bir soru sormak kıyasla ucuzdur.
      return {
        tenantId: null,
        tenantName: null,
        reason: "ambiguous",
        normalizedMessage,
        intentDomain,
        tenantCode,
        candidates: byName.candidates,
      };
    }
  }

  if (previousTenantId) {
    const sticky = await resolveStickyOrNlp(
      previousTenantId,
      customerPhone,
      intentDomain,
      normalizedMessage,
      tenantCode
    );
    if (sticky) return sticky;
  }

  if (!previousTenantId) {
    const historyIds = await getRecentCustomerTenantIds(customerPhone, 1);
    if (historyIds.length > 0) {
      const byHistory = await getTenantSummaryById(historyIds[0]);
      if (byHistory) {
        return {
          tenantId: byHistory.id,
          tenantName: byHistory.name,
          reason: "customer_history",
          normalizedMessage,
          intentDomain,
          tenantCode,
        };
      }
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
