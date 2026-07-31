/**
 * Approved + effective knowledge only. Draft never used by bot.
 * Prices must NOT come from this table — use services.
 */

import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export type KnowledgeEntry = {
  id: string;
  title: string;
  body: string;
  category: string;
  version: number;
};

export async function listApprovedKnowledgeForBot(
  tenantId: string,
  limit = 20
): Promise<KnowledgeEntry[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tenant_knowledge_entries")
    .select("id, title, body, category, version, effective_from, effective_until, status")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "tenant_knowledge_entries") return [];
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
  const lines = entries.map(
    (e) => `- [${e.category}] ${e.title}: ${e.body.slice(0, 400)}`
  );
  return [
    "ONAYLI İŞLETME BİLGİSİ (yalnızca bunlara dayan; fiyat için get_services kullan):",
    ...lines,
  ].join("\n");
}
