/**
 * Bulanık hizmet eşleştirme – fuse.js ile Türkçe informal ifadeleri
 * fiyat listesindeki hizmetlere eşleştirir.
 */

import { supabase } from "../../../supabase";
import { fuzzySearchBest } from "@/lib/fuse-search";

const SCORE_THRESHOLD = 0.5; // 0 = perfect match, 1 = no match. Altında kabul edilir.

export interface MatchServiceResult {
  ok: true;
  service_slug: string;
  service_name: string;
  confidence: number;
}

export interface MatchServiceNoMatch {
  ok: false;
  services_list: Array<{ name: string; slug: string }>;
  message: string;
}

export type MatchServiceOutput = MatchServiceResult | MatchServiceNoMatch;

export async function matchServiceToSlug(
  tenantId: string,
  userText: string
): Promise<MatchServiceOutput> {
  const trimmed = (userText || "").trim();
  if (!trimmed) {
    const services = await fetchServices(tenantId);
    return {
      ok: false,
      services_list: services.map((s) => ({ name: s.name, slug: s.slug })),
      message: "Hangi hizmet için randevu almak istiyorsunuz?",
    };
  }

  const services = await fetchServices(tenantId);
  if (services.length === 0) {
    return {
      ok: false,
      services_list: [],
      message: "Şu an hizmet listesi boş. Lütfen işletmeyle iletişime geçin.",
    };
  }

  const best = fuzzySearchBest(services, trimmed, ["name", "slug", "searchText"], SCORE_THRESHOLD);

  if (!best) {
    return {
      ok: false,
      services_list: services.map((s) => ({ name: s.name, slug: s.slug })),
      message:
        "Eşleşen hizmet bulunamadı. Şu hizmetlerimiz var: " +
        services.map((s) => s.name).join(", ") +
        ". Hangisiyle devam edelim?",
    };
  }

  const { item, score } = best;
  const confidence = 1 - score; // 0-1 arası, yüksek = güvenli eşleşme

  return {
    ok: true,
    service_slug: item.slug,
    service_name: item.name,
    confidence: Math.round(confidence * 100) / 100,
  };
}

async function fetchServices(
  tenantId: string
): Promise<Array<{ name: string; slug: string; searchText: string }>> {
  let res = await supabase
    .from("services")
    .select("name, slug, description")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (res.error) {
    res = await supabase
      .from("services")
      .select("name, slug, description")
      .eq("tenant_id", tenantId);
  }
  if (res.error) return [];
  return (res.data || []).map(toSearchItem);
}

function toSearchItem(row: {
  name: string;
  slug: string;
  description?: string | null;
}): { name: string; slug: string; searchText: string } {
  const name = String(row.name || "").trim();
  const slug = String(row.slug || "").trim();
  const desc = String(row.description || "").trim();
  const searchText = [name, slug, desc].filter(Boolean).join(" ");
  return { name, slug, searchText };
}
