/**
 * Approved + effective knowledge only. Draft never used by bot.
 * Prices must NOT come from this table — use services.
 */

import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

const TABLE = "tenant_knowledge_entries";

/** Bot promptuna giren kayıt sayısı. Her kayıt ~400 karakter → maliyet sınırı. */
export const BOT_KNOWLEDGE_LIMIT = 10;
/** Panelden onaylanabilecek en fazla kayıt; prompt şişmesini kalıcı olarak durdurur. */
export const MAX_APPROVED_ENTRIES = 15;
/** Prompt'a giren gövde uzunluğu; panelde sayaç bu sınırı gösterir. */
export const KNOWLEDGE_BODY_PROMPT_CHARS = 400;

const TITLE_MAX = 120;
const BODY_MAX = 2000;

export const KNOWLEDGE_CATEGORIES = ["faq", "policy", "campaign", "other"] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_STATUSES = ["draft", "approved", "archived"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export type KnowledgeEntry = {
  id: string;
  title: string;
  body: string;
  category: string;
  version: number;
};

/** Panelin gördüğü tam kayıt (bot yalnızca KnowledgeEntry alanlarını görür). */
export type KnowledgeEntryDetail = KnowledgeEntry & {
  status: KnowledgeStatus;
  effective_from: string | null;
  effective_until: string | null;
  approved_at: string | null;
  updated_at: string;
};

export type KnowledgeWriteInput = {
  title: string;
  body: string;
  category?: string;
  effective_from?: string | null;
  effective_until?: string | null;
};

export type KnowledgeResult<T> =
  | { ok: true; data: T; warning?: string }
  | { ok: false; error: string; status: number };

const PANEL_COLUMNS =
  "id, title, body, category, status, version, effective_from, effective_until, approved_at, updated_at";

/**
 * Fiyat bu tabloya yazılmamalı — tek doğru kaynak `services`. Engellemek yerine
 * uyarıyoruz: "500 TL'ye kadar indirim" gibi cümleler bazen meşru olabiliyor.
 */
const PRICE_LIKE_RE =
  /(?:₺|\$|€|\bTL\b|\bLira\b|\bUSD\b|\bEUR\b)\s*\d|\d[\d.,]*\s*(?:₺|\$|€|\bTL\b|\blira\b)/i;

export function detectPriceLikeContent(body: string): boolean {
  return PRICE_LIKE_RE.test(body);
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Panel `<input type="date">` gönderiyor. "10 Ağustos'a kadar geçerli" diyen
 * kullanıcı o günün sonunu kastediyor; ham tarih 00:00 olarak yazılsa kampanya
 * bir gün erken biterdi. Bozuk tarih DB'ye gidip 500 üretmesin diye burada elenir.
 */
function normalizeEffectiveDate(
  value: string | null | undefined,
  endOfDay = false
): { value: string | null } | { error: string } {
  if (!value) return { value: null };
  const normalized = endOfDay && DATE_ONLY_RE.test(value) ? `${value}T23:59:59.999Z` : value;
  if (Number.isNaN(new Date(normalized).getTime())) {
    return { error: "Geçersiz tarih" };
  }
  return { value: normalized };
}

function isMissingTable(error: { message?: string | null }): boolean {
  return extractMissingSchemaTable(error) === TABLE;
}

const MISSING_TABLE_ERROR = {
  ok: false as const,
  error: "Bilgi bankası hazır değil. Migration 042 uygulanmalı.",
  status: 503,
};

export async function listApprovedKnowledgeForBot(
  tenantId: string,
  limit = BOT_KNOWLEDGE_LIMIT
): Promise<KnowledgeEntry[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, title, body, category, version, effective_from, effective_until, status")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === TABLE) return [];
    console.error("[knowledge] list failed", error.message);
    return [];
  }

  return (data || [])
    .filter((row) => {
      if (row.effective_from && row.effective_from > now) return false;
      if (row.effective_until && row.effective_until < now) return false;
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      version: row.version,
    }));
}

export function formatKnowledgeForPrompt(entries: KnowledgeEntry[]): string {
  if (!entries.length) return "";
  // Panel çok satırlı metin yazdırabiliyor; prompt'ta kayıt başına tek satır
  // olmalı, yoksa liste biçimi bozulur ve karakter bütçesi yanıltıcı olur.
  const lines = entries.map(
    (e) =>
      `- [${e.category}] ${e.title}: ${e.body
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, KNOWLEDGE_BODY_PROMPT_CHARS)}`
  );
  return [
    "ONAYLI İŞLETME BİLGİSİ (yalnızca bunlara dayan; fiyat için get_services kullan):",
    ...lines,
  ].join("\n");
}

export async function listKnowledgeForPanel(
  tenantId: string,
  status?: KnowledgeStatus
): Promise<KnowledgeResult<{ entries: KnowledgeEntryDetail[]; approvedCount: number }>> {
  let query = supabase
    .from(TABLE)
    .select(PANEL_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return MISSING_TABLE_ERROR;
    console.error("[knowledge] panel list failed", error.message);
    return { ok: false, error: "Bilgi kayıtları alınamadı", status: 500 };
  }

  // Sayım listeden türetilmiyor: liste 200 ile sınırlı ve filtrelenebiliyor,
  // tavan kontrolü ise her zaman gerçek toplamı görmeli.
  const approvedCount = await countApproved(tenantId);
  return { ok: true, data: { entries: (data || []) as KnowledgeEntryDetail[], approvedCount } };
}

async function countApproved(tenantId: string): Promise<number> {
  const { count } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "approved");
  return count ?? 0;
}

function normalizeWriteInput(
  input: KnowledgeWriteInput
): { title: string; body: string; category: KnowledgeCategory } | { error: string } {
  const title = (input.title || "").trim();
  const body = (input.body || "").trim();
  if (!title || !body) return { error: "Başlık ve metin zorunlu" };
  if (title.length > TITLE_MAX) return { error: `Başlık en fazla ${TITLE_MAX} karakter` };
  if (body.length > BODY_MAX) return { error: `Metin en fazla ${BODY_MAX} karakter` };

  const category = (input.category || "faq") as KnowledgeCategory;
  if (!KNOWLEDGE_CATEGORIES.includes(category)) {
    return { error: "Geçersiz kategori" };
  }
  return { title, body, category };
}

/** Yeni kayıt her zaman draft doğar; yayınlamak ayrı bir karar (approve). */
export async function createKnowledgeEntry(
  tenantId: string,
  input: KnowledgeWriteInput
): Promise<KnowledgeResult<KnowledgeEntryDetail>> {
  const normalized = normalizeWriteInput(input);
  if ("error" in normalized) return { ok: false, error: normalized.error, status: 400 };

  const from = normalizeEffectiveDate(input.effective_from);
  if ("error" in from) return { ok: false, error: from.error, status: 400 };
  const until = normalizeEffectiveDate(input.effective_until, true);
  if ("error" in until) return { ok: false, error: until.error, status: 400 };

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      tenant_id: tenantId,
      title: normalized.title,
      body: normalized.body,
      category: normalized.category,
      status: "draft",
      effective_from: from.value,
      effective_until: until.value,
    })
    .select(PANEL_COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error)) return MISSING_TABLE_ERROR;
    console.error("[knowledge] create failed", error.message);
    return { ok: false, error: "Kayıt oluşturulamadı", status: 500 };
  }

  return {
    ok: true,
    data: data as KnowledgeEntryDetail,
    warning: detectPriceLikeContent(normalized.body)
      ? "Metinde fiyat geçiyor olabilir. Fiyat bilgisi hizmet listesinden gelmeli."
      : undefined,
  };
}

export async function updateKnowledgeEntry(
  tenantId: string,
  entryId: string,
  patch: Partial<KnowledgeWriteInput> & { status?: KnowledgeStatus },
  actorUserId?: string
): Promise<KnowledgeResult<KnowledgeEntryDetail>> {
  const { data: existing, error: readError } = await supabase
    .from(TABLE)
    .select("id, title, body, category, status, version")
    .eq("tenant_id", tenantId)
    .eq("id", entryId)
    .maybeSingle();

  if (readError) {
    if (isMissingTable(readError)) return MISSING_TABLE_ERROR;
    console.error("[knowledge] read failed", readError.message);
    return { ok: false, error: "Kayıt okunamadı", status: 500 };
  }
  if (!existing) return { ok: false, error: "Kayıt bulunamadı", status: 404 };

  const nextStatus = patch.status ?? (existing.status as KnowledgeStatus);
  if (patch.status && !KNOWLEDGE_STATUSES.includes(patch.status)) {
    return { ok: false, error: "Geçersiz durum", status: 400 };
  }

  const normalized = normalizeWriteInput({
    title: patch.title ?? existing.title,
    body: patch.body ?? existing.body,
    category: patch.category ?? existing.category,
  });
  if ("error" in normalized) return { ok: false, error: normalized.error, status: 400 };

  // Onaylı kayıt sayısı prompt maliyetini doğrudan belirliyor; sınır burada.
  if (nextStatus === "approved" && existing.status !== "approved") {
    const approvedCount = await countApproved(tenantId);
    if (approvedCount >= MAX_APPROVED_ENTRIES) {
      return {
        ok: false,
        error: `En fazla ${MAX_APPROVED_ENTRIES} onaylı kayıt olabilir. Önce birini arşivleyin.`,
        status: 400,
      };
    }
  }

  const contentChanged =
    normalized.title !== existing.title ||
    normalized.body !== existing.body ||
    normalized.category !== existing.category;

  const update: Record<string, unknown> = {
    title: normalized.title,
    body: normalized.body,
    category: normalized.category,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (contentChanged) update.version = (existing.version || 1) + 1;

  if (patch.effective_from !== undefined) {
    const from = normalizeEffectiveDate(patch.effective_from);
    if ("error" in from) return { ok: false, error: from.error, status: 400 };
    update.effective_from = from.value;
  }
  if (patch.effective_until !== undefined) {
    const until = normalizeEffectiveDate(patch.effective_until, true);
    if ("error" in until) return { ok: false, error: until.error, status: 400 };
    update.effective_until = until.value;
  }

  if (nextStatus === "approved") {
    update.approved_at = new Date().toISOString();
    update.approved_by = actorUserId || null;
  } else if (existing.status === "approved") {
    // Yayından kalkan kayıt onay izini taşımamalı.
    update.approved_at = null;
    update.approved_by = null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", entryId)
    .select(PANEL_COLUMNS)
    .single();

  if (error) {
    if (isMissingTable(error)) return MISSING_TABLE_ERROR;
    console.error("[knowledge] update failed", error.message);
    return { ok: false, error: "Kayıt güncellenemedi", status: 500 };
  }

  return {
    ok: true,
    data: data as KnowledgeEntryDetail,
    warning: detectPriceLikeContent(normalized.body)
      ? "Metinde fiyat geçiyor olabilir. Fiyat bilgisi hizmet listesinden gelmeli."
      : undefined,
  };
}
