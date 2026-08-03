/**
 * Canlı bot konuşma motoru.
 * GERÇEK olan: processMessage, prompt üretimi, sektör kuralları, tool tanımları,
 * tool executor, FSM, guardrail'ler ve GERÇEK OpenAI modeli.
 * SAHTE olan: yalnızca veri katmanı (Supabase/Redis) ve WhatsApp gönderimi.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

/** .env'i vitest'e elle yükler (OPENAI_API_KEY için). */
export function loadEnv(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!process.env[k]) process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env yoksa sorun değil */
  }
  // Upstash'e ASLA gitme: oturumlar bellek içi sahte redis'te tutulur.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  // Langfuse tracing testleri yavaşlatmasın.
  delete process.env.LANGFUSE_SECRET_KEY;
  delete process.env.LANGFUSE_PUBLIC_KEY;
}

export type Turn = { user: string; bot: string };

export type Scenario = {
  level: "normal" | "orta" | "zor" | "olağanüstü";
  name: string;
  /** Müşteri mesajları sırayla gönderilir. */
  messages: string[];
  /** Beklenen davranış kontrolü. Sorun varsa açıklama döndür, yoksa null. */
  expect: (turns: Turn[], ctx: ScenarioContext) => string | null;
};

export type ScenarioContext = {
  appointments: Record<string, unknown>[];
  store: Record<string, Record<string, unknown>[]>;
};

// ── Kontrol yardımcıları ────────────────────────────────────────────────────

export const all = (t: Turn[]) => t.map((x) => x.bot).join("\n");
export const last = (t: Turn[]) => t[t.length - 1]?.bot ?? "";

export function mentions(text: string, ...words: string[]): boolean {
  const n = text.toLocaleLowerCase("tr-TR");
  return words.some((w) => n.includes(w.toLocaleLowerCase("tr-TR")));
}

/** Bot cevabı bir fiyat sayısı içeriyor mu? */
export function hasPrice(text: string): boolean {
  return /(?<![\d.,])\d[\d.,]*\s*(?:tl|try|₺)/i.test(text);
}

/** Metinde geçen tüm TL tutarları. */
export function pricesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![\d.,])(\d[\d.,]*)\s*(?:tl|try|₺)/gi)) {
    const raw = m[1];
    let normalized = raw;
    if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, "");
    const n = Number(normalized);
    if (Number.isFinite(n)) out.push(Math.round(n));
  }
  return out;
}

export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** UTC ISO damgasını Europe/Istanbul yerel "HH:MM" biçimine çevirir. */
export function localHHMM(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
