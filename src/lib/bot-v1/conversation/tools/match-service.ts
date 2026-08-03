/**
 * Bulanık hizmet eşleştirme – fuse.js ile Türkçe informal ifadeleri
 * fiyat listesindeki hizmetlere eşleştirir.
 */

import { supabase } from "../../../supabase";
import { fuzzySearchBest } from "@/lib/fuse-search";

const SCORE_THRESHOLD = 0.5; // 0 = perfect match, 1 = no match. Altında kabul edilir.
const SERVICES_CACHE_TTL_MS = 3 * 60 * 1000;
const servicesCache = new Map<
  string,
  {
    expiry: number;
    rows: Array<{ name: string; slug: string; searchText: string; normalized: string }>;
  }
>();

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

  // Sorgu da indekslenen metinle aynı şekilde ASCII'ye indirgenir; aksi halde
  // "koltuk altı" ile "koltuk alti" birbirini tam yakalayamıyordu.
  const best = fuzzySearchBest(
    services,
    normalizeTr(trimmed),
    ["name", "slug", "searchText", "normalized"],
    SCORE_THRESHOLD
  );

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

/** Türkçe karakterleri ASCII'ye indirger; sorgu ve indeks aynı alfabede olur. */
function normalizeTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

async function fetchServices(
  tenantId: string
): Promise<Array<{ name: string; slug: string; searchText: string; normalized: string }>> {
  const cached = servicesCache.get(tenantId);
  if (cached && cached.expiry > Date.now()) return cached.rows;

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
  const rows = (res.data || []).map(toSearchItem);
  servicesCache.set(tenantId, {
    rows,
    expiry: Date.now() + SERVICES_CACHE_TTL_MS,
  });
  return rows;
}

function toSearchItem(row: {
  name: string;
  slug: string;
  description?: string | null;
}): { name: string; slug: string; searchText: string; normalized: string } {
  const name = String(row.name || "").trim();
  const slug = String(row.slug || "").trim();
  const desc = String(row.description || "").trim();
  const searchText = [name, slug, desc].filter(Boolean).join(" ");
  return { name, slug, searchText, normalized: normalizeTr(searchText) };
}
