// @vitest-environment node
/**
 * SEKTÖREL CANLI BOT TESTİ
 *
 * GERÇEK olan: processMessage, prompt üretimi, sektör kuralları, tool tanımları,
 * tool executor, FSM, guardrail'ler ve GERÇEK OpenAI modeli.
 * SAHTE olan: yalnızca veri katmanı (bellek içi Supabase/Redis) ve WhatsApp
 * gönderimi — canlı veritabanına tek satır yazılmaz.
 *
 * Konuşmalar EŞZAMANLI koşar. Her konuşmanın kendi veritabanı ve oturumu var;
 * izolasyon AsyncLocalStorage ile sağlanır (global mutable state olsaydı
 * eşzamanlı konuşmalar birbirinin randevusunu görürdü).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createFakeSupabase, type Store, type Row } from "./fake-supabase";
import { PROFILES, buildStore, type Profile } from "./profiles";
import { loadEnv, type Turn } from "./harness";
import {
  universalScenarios,
  regularCustomerScenarios,
  SECTOR_SCENARIOS,
  type Scenario,
} from "./scenarios";

loadEnv();

type ConvCtx = {
  store: Store;
  sessions: Map<string, unknown>;
  tenantCache: Map<string, unknown>;
  sent: { to: string; text: string }[];
};

const als = new AsyncLocalStorage<ConvCtx>();
/** Konuşma dışında (import anında) çağrılırsa kullanılacak boş bağlam. */
const fallback: ConvCtx = { store: {}, sessions: new Map(), tenantCache: new Map(), sent: [] };
const ctx = (): ConvCtx => als.getStore() ?? fallback;

vi.mock("@/lib/supabase", () => ({
  supabase: new Proxy({} as Record<string, unknown>, {
    get: (_t, prop) =>
      (createFakeSupabase(ctx().store) as unknown as Record<string, unknown>)[prop as string],
  }),
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/redis", () => ({
  getSession: async (t: string, p: string) => ctx().sessions.get(`${t}:${p}`) ?? null,
  setSession: async (t: string, p: string, s: unknown) => {
    ctx().sessions.set(`${t}:${p}`, s);
  },
  deleteSession: async (t: string, p: string) => {
    ctx().sessions.delete(`${t}:${p}`);
  },
  getTenantFromCache: async (id: string) => ctx().tenantCache.get(id) ?? null,
  setTenantCache: async (id: string, v: unknown) => {
    ctx().tenantCache.set(id, v);
  },
  acquireBookingDayLock: async () => "lock",
  acquireBookingSlotLock: async () => "lock",
  releaseBookingDayLock: async () => undefined,
  releaseBookingSlotLock: async () => undefined,
  setBookingSlotHold: async () => ({ ok: true }),
  clearBookingSlotHold: async () => undefined,
  getBookingHoldsForDate: async () => [],
  // Kod Map bekliyor; düz nesne dönmek getDailyAvailability'i sessizce çökertir.
  getBookingHoldsForDates: async (_t: string, dates: string[]) =>
    new Map((dates || []).map((d) => [d, []])),
  hasRedis: () => false,
}));

vi.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: async ({ to, text }: { to: string; text: string }) => {
    ctx().sent.push({ to, text });
    return { ok: true };
  },
  sendWhatsAppMessageDetailed: async () => ({ ok: true }),
  sendWhatsAppTemplateMessage: async () => ({ ok: true }),
  sendWhatsAppTemplateMessageDetailed: async () => ({ ok: true }),
  downloadWhatsAppMedia: async () => null,
}));

// Gürültüyü kes: her konuşma onlarca observability satırı basıyor.
vi.mock("@/services/conversationObservability.service", () => ({
  emitConversationEvent: async () => undefined,
}));

const { processMessage } = await import("@/lib/bot-v1/conversation");

// ── Çalıştırıcı ──────────────────────────────────────────────────────────────

let phoneSeq = 0;
function nextPhone(): string {
  return `+90555${String(1000000 + ++phoneSeq).slice(-7)}`;
}

type Outcome = {
  turns: Turn[];
  appointments: Row[];
  store: Store;
  infraError?: string;
};

async function converse(profile: Profile, sc: Scenario): Promise<Outcome> {
  const conv: ConvCtx = {
    store: buildStore(profile),
    sessions: new Map(),
    tenantCache: new Map(),
    sent: [],
  };
  const phone = sc.phone!;

  return als.run(conv, async () => {
    const turns: Turn[] = [];
    for (const msg of sc.messages) {
      try {
        const res = await processMessage(profile.tenantId, phone, msg);
        // Rate-limit/altyapı çöküşü BOT HATASI olarak sayılmamalı: config'in
        // system_error şablonu da buraya düşer ("Bir sorun oldu…").
        if (
          /Bir şeyler ters gitti|işletme bulunamadı|Bir sorun oldu, biraz sonra|Şu an randevu alamıyorum/i.test(
            res.reply
          )
        ) {
          return {
            turns,
            appointments: (conv.store.appointments || []) as Row[],
            store: conv.store,
            infraError: `Bot generic hata döndü: "${res.reply}" (mesaj: "${msg}")`,
          };
        }
        turns.push({ user: msg, bot: res.reply });
      } catch (err) {
        return {
          turns,
          appointments: (conv.store.appointments || []) as Row[],
          store: conv.store,
          infraError: `İSTİSNA: ${(err as Error).message}`,
        };
      }
    }
    return {
      turns,
      appointments: (conv.store.appointments || []) as Row[],
      store: conv.store,
    };
  });
}

// ── Senaryo listesi ──────────────────────────────────────────────────────────

type Job = { profile: Profile; scenario: Scenario };

const JOBS: Job[] = [];
for (const profile of PROFILES) {
  // Telefon senaryo kapanışlarına ÖNCEDEN verilmeli: universalScenarios içindeki
  // own(c, phone) kontrolleri bu değeri closure'da yakalıyor. Sonradan
  // { ...sc, phone } ile atamak beklentileri sessizce boş string'e bağlıyordu.
  for (const sc of universalScenarios(profile, nextPhone())) {
    JOBS.push({ profile, scenario: sc });
  }
  for (const sc of regularCustomerScenarios(profile)) {
    JOBS.push({ profile, scenario: sc });
  }
  const sectorFn = SECTOR_SCENARIOS[profile.key];
  if (sectorFn) {
    for (const sc of sectorFn(profile)) {
      JOBS.push({ profile, scenario: { ...sc, phone: sc.phone ?? nextPhone() } });
    }
  }
}

type Finding = {
  profile: string;
  level: string;
  name: string;
  issue: string;
  transcript: Turn[];
};

const findings: Finding[] = [];
const HAS_KEY = Boolean(process.env.OPENAI_API_KEY?.startsWith("sk-"));
const RUN_ID = process.env.BOT_RUN_ID || "1";
const OUT = process.env.BOT_FINDINGS_OUT || `.bot-findings/run-${RUN_ID}.json`;

beforeAll(() => {
  if (!HAS_KEY) console.warn("\n⚠ OPENAI_API_KEY yok — canlı bot testi atlanıyor.\n");
});

describe("SEKTÖREL CANLI BOT TESTİ", () => {
  for (const job of JOBS) {
    (HAS_KEY ? it.concurrent : it.skip)(
      `[${job.scenario.level}] ${job.profile.label} — ${job.scenario.name}`,
      async () => {
        const out = await converse(job.profile, job.scenario);
        const issue = out.infraError
          ? `ALTYAPI: ${out.infraError}`
          : job.scenario.expect(out.turns, {
              appointments: out.appointments,
              store: out.store,
              profile: job.profile,
            });
        if (issue) {
          findings.push({
            profile: job.profile.label,
            level: job.scenario.level,
            name: job.scenario.name,
            issue,
            transcript: out.turns,
          });
        }
        expect(out.turns.length).toBeGreaterThan(0);
      },
      180_000
    );
  }
});

afterAll(() => {
  if (!HAS_KEY) return;
  const order = ["olağanüstü", "zor", "orta", "normal"];
  findings.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));

  console.log(`\n\n${"═".repeat(78)}`);
  console.log(
    `  CANLI BOT TEST RAPORU (tur ${RUN_ID}) — ${JOBS.length} senaryo, ${findings.length} bulgu`
  );
  console.log("═".repeat(78));
  for (const lvl of order) {
    const group = findings.filter((f) => f.level === lvl);
    if (!group.length) continue;
    console.log(`\n▓▓ ${lvl.toUpperCase()} (${group.length})`);
    for (const f of group) {
      console.log(`\n  ✗ [${f.profile}] ${f.name}`);
      console.log(`    SORUN: ${f.issue}`);
      for (const t of f.transcript) {
        console.log(`      👤 ${t.user}`);
        console.log(`      🤖 ${t.bot.replace(/\n/g, "\n         ")}`);
      }
    }
  }
  console.log(`\n${"═".repeat(78)}\n`);

  try {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          runId: RUN_ID,
          total: JOBS.length,
          findings: findings.map((f) => ({
            key: `${f.profile} :: ${f.name}`,
            level: f.level,
            issue: f.issue,
          })),
        },
        null,
        2
      )
    );
    console.log(`Bulgular yazıldı: ${OUT}`);
  } catch (err) {
    console.warn("Bulgu dosyası yazılamadı:", (err as Error).message);
  }
});
