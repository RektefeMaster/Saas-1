import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createCipheriv, randomBytes } from "crypto";
import { normalizePhoneDigits } from "./phone";
import type { ConversationState } from "./database.types";
import { isSupabaseConfigured, supabase } from "./supabase";

function normalizeSecretValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, "");
  const compact = unquoted.replace(/\s+/g, "");
  return compact || undefined;
}

function normalizePlainValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, "");
  return unquoted || undefined;
}

function isPlaceholder(value: string): boolean {
  return /(your-|placeholder|changeme|xxx\.upstash\.io|your-token|test-token)/i.test(value);
}

function isRedisConfigUsable(url?: string, token?: string): boolean {
  if (!url || !token) return false;
  if (isPlaceholder(url) || isPlaceholder(token)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const redisUrl = normalizePlainValue(process.env.UPSTASH_REDIS_REST_URL);
const redisToken = normalizeSecretValue(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis: Redis | null =
  isRedisConfigUsable(redisUrl, redisToken)
    ? new Redis({
        url: redisUrl!,
        token: redisToken!,
      })
    : null;

// Development fallback: Redis yoksa in-memory (server restart'ta silinir)
const memoryStore = new Map<string, { value: ConversationState; expiry: number }>();
const phoneTenantStore = new Map<string, { value: string; expiry: number }>();
let fallbackLogged = false;

const SESSION_PREFIX = "ahi-ai:session:";
const PHONE_TENANT_PREFIX = "ahi-ai:phone2tenant:";
const RATE_LIMIT_PREFIX = "ahi-ai:ratelimit:";
const OTP_CHALLENGE_PREFIX = "ahi-ai:otp:challenge:";
const BOOKING_LOCK_PREFIX = "ahi-ai:booking:lock:";
const BOOKING_HOLD_PREFIX = "ahi-ai:booking:hold:";
const WEBHOOK_MESSAGE_DEDUPE_PREFIX = "ahi-ai:webhook:msg:";
const BOT_PROCESS_LOCK_PREFIX = "ahi-ai:bot:lock:";
const TEMP_MEDIA_PREFIX = "ahi-ai:media:tmp:";
const WEBHOOK_DEBUG_KEY = "ahi-ai:webhook:last";
const RUNTIME_WHATSAPP_KEY = "ahi-ai:runtime:whatsapp";
const GLOBAL_KILL_SWITCH_KEY = "ahi-ai:global:kill_switch";
/** [YENİ] Tenant cache key prefix; TTL 300 saniye (5 dk). */
const TENANT_CACHE_PREFIX = "ahi-ai:tenant:id:";
const TENANT_CACHE_TTL_SECONDS = 300;
const TTL_SECONDS = 60 * 60 * 24; // 24 saat
const PHONE_TENANT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 gün
const RATE_LIMIT_TTL_SECONDS = 60; // 1 dakika
const RATE_LIMIT_MAX = 15; // dakikada max mesaj
const RATE_LIMIT_HOURLY_TTL_SECONDS = 60 * 60; // 1 saat
const RATE_LIMIT_HOURLY_MAX = 35; // saatte max mesaj
const RATE_LIMIT_DAILY_TTL_SECONDS = 60 * 60 * 24; // 24 saat
const RATE_LIMIT_DAILY_MAX = 180; // günde max mesaj
const RATE_LIMIT_COOLDOWN_SECONDS = 60 * 60 * 3; // yoğun suistimalde 3 saat soğutma
const BOOKING_LOCK_TTL_SECONDS = 10; // Aynı slot onayı için kısa kilit
const BOOKING_HOLD_TTL_SECONDS = 180; // 3 dk sepet tutma

/** [YENİ] Tenant cache in-memory fallback (Redis yoksa). */
const tenantCacheMemory = new Map<string, { value: string; expiry: number }>();
const otpChallengeMemory = new Map<string, { value: string; expiry: number }>();
const bookingLockMemory = new Map<string, { value: string; expiry: number }>();
const bookingHoldMemory = new Map<
  string,
  {
    value: BookingHoldRecord;
    expiry: number;
  }
>();
const botProcessLockMemory = new Map<string, { owner: string; expiry: number }>();
const webhookDebugMemory = new Map<string, { value: WebhookDebugRecord; expiry: number }>();
const runtimeWhatsAppMemory = new Map<string, { value: RuntimeWhatsAppConfig; expiry: number }>();
let globalKillSwitchMemory: GlobalKillSwitchState | null = null;
const webhookMessageDedupeMemory = new Map<string, { expiry: number }>();
const tempMediaMemory = new Map<string, { value: string; expiry: number }>();

function logRedisFallback(action: string, err: unknown) {
  if (fallbackLogged) return;
  fallbackLogged = true;
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[redis] ${action} failed, in-memory fallback active: ${msg}`);
}

function parseRedisJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    return raw as T;
  }
  return null;
}

function sessionKey(tenantId: string, customerPhone: string): string {
  const normalized = normalizePhoneDigits(customerPhone);
  return `${SESSION_PREFIX}${tenantId}:${normalized}`;
}

function parseSessionStorageKey(key: string): { tenantId: string; customerPhone: string } | null {
  if (!key.startsWith(SESSION_PREFIX)) return null;
  const raw = key.slice(SESSION_PREFIX.length);
  const sepIdx = raw.indexOf(":");
  if (sepIdx <= 0) return null;
  const tenantId = raw.slice(0, sepIdx);
  const customerPhone = raw.slice(sepIdx + 1);
  if (!tenantId || !customerPhone) return null;
  return { tenantId, customerPhone };
}

export interface PausedSessionItem {
  tenantId: string;
  customerPhone: string;
  state: ConversationState;
}

export async function getSession(
  tenantId: string,
  customerPhone: string
): Promise<ConversationState | null> {
  const key = sessionKey(tenantId, customerPhone);
  if (redis) {
    try {
      return await redis.get<ConversationState>(key);
    } catch (err) {
      logRedisFallback("getSession", err);
    }
  }
  const mem = memoryStore.get(key);
  if (mem && mem.expiry > Date.now()) return mem.value;
  memoryStore.delete(key);
  return null;
}

export async function setSession(
  tenantId: string,
  customerPhone: string,
  state: ConversationState
): Promise<void> {
  const key = sessionKey(tenantId, customerPhone);
  const data = { ...state, updated_at: new Date().toISOString() };
  if (redis) {
    try {
      await redis.set(key, data, { ex: TTL_SECONDS });
      return;
    } catch (err) {
      logRedisFallback("setSession", err);
    }
  }
  memoryStore.set(key, { value: data, expiry: Date.now() + TTL_SECONDS * 1000 });
}

export async function deleteSession(
  tenantId: string,
  customerPhone: string
): Promise<void> {
  const key = sessionKey(tenantId, customerPhone);
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (err) {
      logRedisFallback("deleteSession", err);
    }
  }
  memoryStore.delete(key);
}

export async function listPausedSessions(input?: {
  tenantId?: string;
  limit?: number;
}): Promise<PausedSessionItem[]> {
  const tenantFilter = (input?.tenantId || "").trim();
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
  const collected: PausedSessionItem[] = [];

  if (redis) {
    try {
      const pattern = tenantFilter
        ? `${SESSION_PREFIX}${tenantFilter}:*`
        : `${SESSION_PREFIX}*`;
      const keys = (await redis.keys(pattern)) || [];
      for (const key of keys) {
        if (collected.length >= limit) break;
        const parsed = parseSessionStorageKey(key);
        if (!parsed) continue;
        const state = await redis.get<ConversationState>(key);
        if (!state) continue;
        if (state.step !== "PAUSED_FOR_HUMAN") continue;
        collected.push({
          tenantId: parsed.tenantId,
          customerPhone: parsed.customerPhone,
          state,
        });
      }
      return collected
        .sort(
          (a, b) =>
            new Date(b.state.updated_at || 0).getTime() -
            new Date(a.state.updated_at || 0).getTime()
        )
        .slice(0, limit);
    } catch (err) {
      logRedisFallback("listPausedSessions", err);
    }
  }

  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (collected.length >= limit) break;
    if (entry.expiry <= now) {
      memoryStore.delete(key);
      continue;
    }
    const parsed = parseSessionStorageKey(key);
    if (!parsed) continue;
    if (tenantFilter && parsed.tenantId !== tenantFilter) continue;
    if (entry.value.step !== "PAUSED_FOR_HUMAN") continue;
    collected.push({
      tenantId: parsed.tenantId,
      customerPhone: parsed.customerPhone,
      state: entry.value,
    });
  }

  return collected
    .sort(
      (a, b) =>
        new Date(b.state.updated_at || 0).getTime() -
        new Date(a.state.updated_at || 0).getTime()
    )
    .slice(0, limit);
}

export function hasRedis(): boolean {
  return redis !== null;
}

export async function getTenantIdByPhone(customerPhone: string): Promise<string | null> {
  const digits = normalizePhoneDigits(customerPhone);
  if (!digits) return null;
  const key = PHONE_TENANT_PREFIX + digits;

  if (redis) {
    try {
      const val = await redis.get<string>(key);
      if (val) return val;
    } catch (err) {
      logRedisFallback("getTenantIdByPhone", err);
    }
  }

  const mem = phoneTenantStore.get(key);
  if (mem && mem.expiry > Date.now()) return mem.value;
  phoneTenantStore.delete(key);

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from("phone_tenant_mappings")
        .select("tenant_id")
        .eq("customer_phone_digits", digits)
        .single();
      if (data?.tenant_id) return data.tenant_id;
    } catch {
      // Tablo yoksa veya hata varsa sessizce devam et
    }
  }

  return null;
}

export async function setPhoneTenantMapping(
  customerPhone: string,
  tenantId: string
): Promise<void> {
  const digits = normalizePhoneDigits(customerPhone);
  if (!digits) return;
  const key = PHONE_TENANT_PREFIX + digits;

  if (redis) {
    try {
      await redis.set(key, tenantId, { ex: PHONE_TENANT_TTL_SECONDS });
    } catch (err) {
      logRedisFallback("setPhoneTenantMapping", err);
    }
  }

  phoneTenantStore.set(key, {
    value: tenantId,
    expiry: Date.now() + PHONE_TENANT_TTL_SECONDS * 1000,
  });

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("phone_tenant_mappings").upsert(
        {
          customer_phone_digits: digits,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_phone_digits" }
      );
    } catch {
      // Tablo yoksa veya hata varsa sessizce devam et
    }
  }
}

export async function clearPhoneTenantMapping(customerPhone: string): Promise<void> {
  const digits = normalizePhoneDigits(customerPhone);
  if (!digits) return;
  const key = PHONE_TENANT_PREFIX + digits;

  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      logRedisFallback("clearPhoneTenantMapping", err);
    }
  }
  phoneTenantStore.delete(key);

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from("phone_tenant_mappings")
        .delete()
        .eq("customer_phone_digits", digits);
    } catch {
      // Tablo yoksa veya hata varsa sessizce devam et
    }
  }
}

/**
 * [YENİ] Tenant cache — get. TTL 5 dk. Cache miss → null (DB'den çekilip setTenantCache ile yazılır).
 */
export async function getTenantFromCache(tenantId: string): Promise<unknown | null> {
  const key = TENANT_CACHE_PREFIX + tenantId;
  if (redis) {
    try {
      const raw = await redis.get<unknown>(key);
      return parseRedisJson<unknown>(raw);
    } catch (err) {
      logRedisFallback("getTenantFromCache", err);
    }
  }
  const mem = tenantCacheMemory.get(key);
  if (mem && mem.expiry > Date.now()) {
    try {
      return JSON.parse(mem.value) as unknown;
    } catch {
      tenantCacheMemory.delete(key);
    }
  }
  return null;
}

/**
 * [YENİ] Tenant cache — set. TTL 300 saniye.
 */
export async function setTenantCache(tenantId: string, value: unknown): Promise<void> {
  const key = TENANT_CACHE_PREFIX + tenantId;
  const serialized = JSON.stringify(value);
  if (redis) {
    try {
      await redis.set(key, serialized, { ex: TENANT_CACHE_TTL_SECONDS });
      return;
    } catch (err) {
      logRedisFallback("setTenantCache", err);
    }
  }
  tenantCacheMemory.set(key, { value: serialized, expiry: Date.now() + TENANT_CACHE_TTL_SECONDS * 1000 });
}

export interface OtpChallenge {
  id: string;
  scope: "admin" | "dashboard";
  phone: string;
  user_id?: string;
  attempts: number;
  created_at: string;
}

export interface WebhookDebugRecord {
  stage: string;
  at: string;
  [key: string]: unknown;
}

export interface RuntimeWhatsAppConfig {
  token?: string;
  phone_id?: string;
  updated_at: string;
  source?: string;
}

export interface GlobalKillSwitchState {
  enabled: boolean;
  updated_at: string;
  source?: string;
}

function parseGlobalKillSwitchState(raw: unknown): GlobalKillSwitchState | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "1") {
      return { enabled: true, updated_at: "", source: "legacy" };
    }
    if (trimmed === "0") {
      return { enabled: false, updated_at: "", source: "legacy" };
    }
    try {
      return parseGlobalKillSwitchState(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }

  if (typeof raw === "number") {
    if (raw === 1) return { enabled: true, updated_at: "", source: "legacy" };
    if (raw === 0) return { enabled: false, updated_at: "", source: "legacy" };
    return null;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.enabled !== "boolean") return null;
    return {
      enabled: obj.enabled,
      updated_at: typeof obj.updated_at === "string" ? obj.updated_at : "",
      source: typeof obj.source === "string" ? obj.source : undefined,
    };
  }

  return null;
}

function botLockKey(lockKey: string): string {
  return `${BOT_PROCESS_LOCK_PREFIX}${lockKey}`;
}

export async function acquireBotProcessingLock(
  lockKey: string,
  owner: string,
  ttlSeconds = 20
): Promise<boolean> {
  const key = botLockKey(lockKey);
  if (redis) {
    try {
      const result = await redis.set(key, owner, { nx: true, ex: ttlSeconds });
      return result === "OK";
    } catch (err) {
      logRedisFallback("acquireBotProcessingLock", err);
    }
  }
  const now = Date.now();
  const mem = botProcessLockMemory.get(key);
  if (mem && mem.expiry > now) return false;
  botProcessLockMemory.set(key, {
    owner,
    expiry: now + ttlSeconds * 1000,
  });
  return true;
}

export async function releaseBotProcessingLock(
  lockKey: string,
  owner: string
): Promise<boolean> {
  const key = botLockKey(lockKey);
  if (redis) {
    try {
      const current = await redis.get<string>(key);
      if (current !== owner) return false;
      await redis.del(key);
      return true;
    } catch (err) {
      logRedisFallback("releaseBotProcessingLock", err);
    }
  }
  const mem = botProcessLockMemory.get(key);
  if (!mem) return false;
  if (mem.owner !== owner) return false;
  botProcessLockMemory.delete(key);
  return true;
}

function getMediaEncryptionKey(): Buffer | null {
  const raw = (process.env.MEDIA_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  try {
    if (/^[0-9a-f]{64}$/i.test(raw)) {
      const keyHex = Buffer.from(raw, "hex");
      if (keyHex.length === 32) return keyHex;
    }
    const keyB64 = Buffer.from(raw, "base64");
    if (keyB64.length === 32) return keyB64;
  } catch {
    return null;
  }
  return null;
}

function tempMediaKey(traceId: string, messageId: string): string {
  return `${TEMP_MEDIA_PREFIX}${traceId}:${messageId}`;
}

export async function storeTemporaryEncryptedMedia(
  input: {
    traceId: string;
    messageId: string;
    mimeType: string;
    buffer: Buffer;
  },
  ttlSeconds = 60 * 60 * 48
): Promise<{ key: string } | null> {
  const encKey = getMediaEncryptionKey();
  if (!encKey) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const encrypted = Buffer.concat([cipher.update(input.buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = JSON.stringify({
    v: 1,
    mime_type: input.mimeType,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    created_at: new Date().toISOString(),
  });
  const key = tempMediaKey(input.traceId, input.messageId);

  if (redis) {
    try {
      await redis.set(key, payload, { ex: ttlSeconds });
      return { key };
    } catch (err) {
      logRedisFallback("storeTemporaryEncryptedMedia", err);
    }
  }

  tempMediaMemory.set(key, {
    value: payload,
    expiry: Date.now() + ttlSeconds * 1000,
  });
  return { key };
}

export async function purgeExpiredTemporaryMedia(
  maxKeys = 500
): Promise<{ scanned: number; removed: number }> {
  let scanned = 0;
  let removed = 0;

  if (redis) {
    try {
      const keys = await redis.keys(`${TEMP_MEDIA_PREFIX}*`);
      for (const key of (keys || []).slice(0, maxKeys)) {
        scanned += 1;
        const ttl = await redis.ttl(key);
        if (typeof ttl === "number" && ttl <= 0) {
          await redis.del(key);
          removed += 1;
          continue;
        }
        const raw = await redis.get<string>(key);
        if (!raw) {
          await redis.del(key);
          removed += 1;
          continue;
        }
        let createdAt = 0;
        try {
          const parsed = JSON.parse(raw) as { created_at?: string };
          createdAt = parsed.created_at ? new Date(parsed.created_at).getTime() : 0;
        } catch {
          createdAt = 0;
        }
        if (!Number.isFinite(createdAt) || createdAt <= 0) continue;
        if (Date.now() - createdAt >= 48 * 60 * 60 * 1000) {
          await redis.del(key);
          removed += 1;
        }
      }
      return { scanned, removed };
    } catch (err) {
      logRedisFallback("purgeExpiredTemporaryMedia", err);
    }
  }

  const now = Date.now();
  for (const [key, entry] of tempMediaMemory.entries()) {
    if (!key.startsWith(TEMP_MEDIA_PREFIX)) continue;
    scanned += 1;
    if (entry.expiry <= now) {
      tempMediaMemory.delete(key);
      removed += 1;
    }
  }
  return { scanned, removed };
}

function webhookMessageDedupeKey(messageId: string): string {
  return `${WEBHOOK_MESSAGE_DEDUPE_PREFIX}${messageId.trim()}`;
}

/**
 * Webhook mesaj ID'sini atomik olarak claim eder.
 * true  -> ilk kez görüldü, işlenebilir
 * false -> daha önce işlendi, tekrar işlenmemeli
 */
export async function claimWebhookMessageId(
  messageId: string,
  ttlSeconds = 60 * 60 * 24
): Promise<boolean> {
  const normalized = messageId.trim();
  if (!normalized) return true;
  const key = webhookMessageDedupeKey(normalized);

  if (redis) {
    try {
      const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
      return result === "OK";
    } catch (err) {
      logRedisFallback("claimWebhookMessageId", err);
    }
  }

  const now = Date.now();
  const mem = webhookMessageDedupeMemory.get(key);
  if (mem && mem.expiry > now) return false;
  webhookMessageDedupeMemory.set(key, {
    expiry: now + ttlSeconds * 1000,
  });
  return true;
}

export async function setWebhookDebugRecord(
  record: WebhookDebugRecord,
  ttlSeconds = 60 * 60 * 24
): Promise<void> {
  if (redis) {
    try {
      await redis.set(WEBHOOK_DEBUG_KEY, JSON.stringify(record), { ex: ttlSeconds });
      return;
    } catch (err) {
      logRedisFallback("setWebhookDebugRecord", err);
    }
  }
  webhookDebugMemory.set(WEBHOOK_DEBUG_KEY, {
    value: record,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

export async function getWebhookDebugRecord(): Promise<WebhookDebugRecord | null> {
  if (redis) {
    try {
      const raw = await redis.get<unknown>(WEBHOOK_DEBUG_KEY);
      return parseRedisJson<WebhookDebugRecord>(raw);
    } catch (err) {
      logRedisFallback("getWebhookDebugRecord", err);
    }
  }
  const mem = webhookDebugMemory.get(WEBHOOK_DEBUG_KEY);
  if (mem && mem.expiry > Date.now()) return mem.value;
  webhookDebugMemory.delete(WEBHOOK_DEBUG_KEY);
  return null;
}

export async function setRuntimeWhatsAppConfig(
  config: RuntimeWhatsAppConfig,
  ttlSeconds = 60 * 60 * 24 * 30
): Promise<void> {
  if (redis) {
    try {
      await redis.set(RUNTIME_WHATSAPP_KEY, JSON.stringify(config), { ex: ttlSeconds });
      return;
    } catch (err) {
      logRedisFallback("setRuntimeWhatsAppConfig", err);
    }
  }
  runtimeWhatsAppMemory.set(RUNTIME_WHATSAPP_KEY, {
    value: config,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

export async function getRuntimeWhatsAppConfig(): Promise<RuntimeWhatsAppConfig | null> {
  if (redis) {
    try {
      const raw = await redis.get<unknown>(RUNTIME_WHATSAPP_KEY);
      return parseRedisJson<RuntimeWhatsAppConfig>(raw);
    } catch (err) {
      logRedisFallback("getRuntimeWhatsAppConfig", err);
    }
  }
  const mem = runtimeWhatsAppMemory.get(RUNTIME_WHATSAPP_KEY);
  if (mem && mem.expiry > Date.now()) return mem.value;
  runtimeWhatsAppMemory.delete(RUNTIME_WHATSAPP_KEY);
  return null;
}

export async function clearRuntimeWhatsAppConfig(): Promise<void> {
  if (redis) {
    try {
      await redis.del(RUNTIME_WHATSAPP_KEY);
      return;
    } catch (err) {
      logRedisFallback("clearRuntimeWhatsAppConfig", err);
    }
  }
  runtimeWhatsAppMemory.delete(RUNTIME_WHATSAPP_KEY);
}

export async function setGlobalKillSwitch(
  enabled: boolean,
  source = "admin"
): Promise<GlobalKillSwitchState> {
  const state: GlobalKillSwitchState = {
    enabled,
    updated_at: new Date().toISOString(),
    source,
  };

  if (redis) {
    try {
      await redis.set(GLOBAL_KILL_SWITCH_KEY, JSON.stringify(state));
      globalKillSwitchMemory = state;
      return state;
    } catch (err) {
      logRedisFallback("setGlobalKillSwitch", err);
    }
  }

  globalKillSwitchMemory = state;
  return state;
}

export async function getGlobalKillSwitch(): Promise<GlobalKillSwitchState> {
  if (redis) {
    try {
      const raw = await redis.get<unknown>(GLOBAL_KILL_SWITCH_KEY);
      const parsed = parseGlobalKillSwitchState(raw);
      if (parsed) {
        globalKillSwitchMemory = parsed;
        return parsed;
      }
    } catch (err) {
      logRedisFallback("getGlobalKillSwitch", err);
    }
  }

  if (globalKillSwitchMemory) return globalKillSwitchMemory;

  return {
    enabled: false,
    updated_at: "",
    source: "default",
  };
}

export async function setOtpChallenge(
  challenge: OtpChallenge,
  ttlSeconds = 300
): Promise<void> {
  const key = OTP_CHALLENGE_PREFIX + challenge.id;
  const serialized = JSON.stringify(challenge);
  if (redis) {
    try {
      await redis.set(key, serialized, { ex: ttlSeconds });
      return;
    } catch (err) {
      logRedisFallback("setOtpChallenge", err);
    }
  }
  otpChallengeMemory.set(key, {
    value: serialized,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

export async function getOtpChallenge(challengeId: string): Promise<OtpChallenge | null> {
  const key = OTP_CHALLENGE_PREFIX + challengeId;
  if (redis) {
    try {
      const raw = await redis.get<unknown>(key);
      return parseRedisJson<OtpChallenge>(raw);
    } catch (err) {
      logRedisFallback("getOtpChallenge", err);
    }
  }
  const mem = otpChallengeMemory.get(key);
  if (mem && mem.expiry > Date.now()) {
    try {
      return JSON.parse(mem.value) as OtpChallenge;
    } catch {
      otpChallengeMemory.delete(key);
    }
  }
  otpChallengeMemory.delete(key);
  return null;
}

export async function updateOtpChallengeAttempts(
  challengeId: string,
  attempts: number,
  ttlSeconds = 300
): Promise<void> {
  const existing = await getOtpChallenge(challengeId);
  if (!existing) return;
  await setOtpChallenge({ ...existing, attempts }, ttlSeconds);
}

export async function deleteOtpChallenge(challengeId: string): Promise<void> {
  const key = OTP_CHALLENGE_PREFIX + challengeId;
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (err) {
      logRedisFallback("deleteOtpChallenge", err);
    }
  }
  otpChallengeMemory.delete(key);
}

// --- Rate limiting (webhook: 15 mesaj/dakika per phone) ---
const rateLimitMemory = new Map<string, { count: number; expiry: number }>();

export interface RateLimitResult {
  allowed: boolean;
  minuteCount: number;
  hourCount: number;
  dayCount: number;
  blockedBy?: "minute" | "hour" | "day" | "cooldown";
  cooldownSeconds?: number;
}

function rateWindowKey(phoneDigits: string, window: "minute" | "hour" | "day"): string {
  if (window === "minute") return `${RATE_LIMIT_PREFIX}${phoneDigits}:1m`;
  if (window === "hour") return `${RATE_LIMIT_PREFIX}${phoneDigits}:1h`;
  return `${RATE_LIMIT_PREFIX}${phoneDigits}:1d`;
}

function rateCooldownKey(phoneDigits: string): string {
  return `${RATE_LIMIT_PREFIX}${phoneDigits}:cooldown`;
}

function incrementMemoryCounter(key: string, ttlSeconds: number): number {
  const now = Date.now();
  const mem = rateLimitMemory.get(key);
  if (!mem || mem.expiry < now) {
    rateLimitMemory.set(key, {
      count: 1,
      expiry: now + ttlSeconds * 1000,
    });
    return 1;
  }
  mem.count += 1;
  return mem.count;
}

// @upstash/ratelimit: Redis varsa kullan (spam koruması)
const upstashRatelimitMinute =
  redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, "1 m"),
        analytics: false,
      })
    : null;
const upstashRatelimitHour = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_HOURLY_MAX, "1 h"),
      analytics: false,
    })
  : null;
const upstashRatelimitDay = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_DAILY_MAX, "1 d"),
      analytics: false,
    })
  : null;

export async function checkAndIncrementRateLimit(phone: string): Promise<RateLimitResult> {
  const digits = normalizePhoneDigits(phone);
  const minuteKey = rateWindowKey(digits, "minute");
  const hourKey = rateWindowKey(digits, "hour");
  const dayKey = rateWindowKey(digits, "day");
  const cooldownKey = rateCooldownKey(digits);

  // @upstash/ratelimit ile öncelikli kontrol
  if (upstashRatelimitMinute && upstashRatelimitHour && upstashRatelimitDay) {
    try {
      const [minRes, hourRes, dayRes] = await Promise.all([
        upstashRatelimitMinute.limit(digits),
        upstashRatelimitHour.limit(digits),
        upstashRatelimitDay.limit(digits),
      ]);
      if (!minRes.success) {
        return {
          allowed: false,
          minuteCount: 0,
          hourCount: 0,
          dayCount: 0,
          blockedBy: "minute",
          cooldownSeconds: Math.max(1, Math.ceil((minRes.reset - Date.now()) / 1000)),
        };
      }
      if (!hourRes.success) {
        return {
          allowed: false,
          minuteCount: 0,
          hourCount: 0,
          dayCount: 0,
          blockedBy: "hour",
          cooldownSeconds: Math.max(1, Math.ceil((hourRes.reset - Date.now()) / 1000)),
        };
      }
      if (!dayRes.success) {
        return {
          allowed: false,
          minuteCount: 0,
          hourCount: 0,
          dayCount: 0,
          blockedBy: "day",
          cooldownSeconds: Math.max(1, Math.ceil((dayRes.reset - Date.now()) / 1000)),
        };
      }
      return {
        allowed: true,
        minuteCount: minRes.limit - minRes.remaining,
        hourCount: hourRes.limit - hourRes.remaining,
        dayCount: dayRes.limit - dayRes.remaining,
      };
    } catch (err) {
      logRedisFallback("checkAndIncrementRateLimit (upstash)", err);
    }
  }

  if (redis) {
    try {
      const activeCooldown = await redis.ttl(cooldownKey);
      if (typeof activeCooldown === "number" && activeCooldown > 0) {
        return {
          allowed: false,
          minuteCount: 0,
          hourCount: 0,
          dayCount: 0,
          blockedBy: "cooldown",
          cooldownSeconds: activeCooldown,
        };
      }

      const minuteCount = await redis.incr(minuteKey);
      if (minuteCount === 1) await redis.expire(minuteKey, RATE_LIMIT_TTL_SECONDS);

      const hourCount = await redis.incr(hourKey);
      if (hourCount === 1) await redis.expire(hourKey, RATE_LIMIT_HOURLY_TTL_SECONDS);

      const dayCount = await redis.incr(dayKey);
      if (dayCount === 1) await redis.expire(dayKey, RATE_LIMIT_DAILY_TTL_SECONDS);

      if (minuteCount > RATE_LIMIT_MAX) {
        return {
          allowed: false,
          minuteCount,
          hourCount,
          dayCount,
          blockedBy: "minute",
          cooldownSeconds: RATE_LIMIT_TTL_SECONDS,
        };
      }

      if (hourCount > RATE_LIMIT_HOURLY_MAX) {
        await redis.set(cooldownKey, "1", { ex: RATE_LIMIT_COOLDOWN_SECONDS });
        return {
          allowed: false,
          minuteCount,
          hourCount,
          dayCount,
          blockedBy: "hour",
          cooldownSeconds: RATE_LIMIT_COOLDOWN_SECONDS,
        };
      }

      if (dayCount > RATE_LIMIT_DAILY_MAX) {
        await redis.set(cooldownKey, "1", { ex: RATE_LIMIT_DAILY_TTL_SECONDS });
        return {
          allowed: false,
          minuteCount,
          hourCount,
          dayCount,
          blockedBy: "day",
          cooldownSeconds: RATE_LIMIT_DAILY_TTL_SECONDS,
        };
      }

      return {
        allowed: true,
        minuteCount,
        hourCount,
        dayCount,
      };
    } catch (err) {
      logRedisFallback("checkAndIncrementRateLimit", err);
    }
  }

  const now = Date.now();
  const cooldownMem = rateLimitMemory.get(cooldownKey);
  if (cooldownMem && cooldownMem.expiry > now) {
    return {
      allowed: false,
      minuteCount: 0,
      hourCount: 0,
      dayCount: 0,
      blockedBy: "cooldown",
      cooldownSeconds: Math.max(1, Math.floor((cooldownMem.expiry - now) / 1000)),
    };
  }
  rateLimitMemory.delete(cooldownKey);

  const minuteCount = incrementMemoryCounter(minuteKey, RATE_LIMIT_TTL_SECONDS);
  const hourCount = incrementMemoryCounter(hourKey, RATE_LIMIT_HOURLY_TTL_SECONDS);
  const dayCount = incrementMemoryCounter(dayKey, RATE_LIMIT_DAILY_TTL_SECONDS);

  if (minuteCount > RATE_LIMIT_MAX) {
    return {
      allowed: false,
      minuteCount,
      hourCount,
      dayCount,
      blockedBy: "minute",
      cooldownSeconds: RATE_LIMIT_TTL_SECONDS,
    };
  }

  if (hourCount > RATE_LIMIT_HOURLY_MAX) {
    rateLimitMemory.set(cooldownKey, {
      count: 1,
      expiry: now + RATE_LIMIT_COOLDOWN_SECONDS * 1000,
    });
    return {
      allowed: false,
      minuteCount,
      hourCount,
      dayCount,
      blockedBy: "hour",
      cooldownSeconds: RATE_LIMIT_COOLDOWN_SECONDS,
    };
  }

  if (dayCount > RATE_LIMIT_DAILY_MAX) {
    rateLimitMemory.set(cooldownKey, {
      count: 1,
      expiry: now + RATE_LIMIT_DAILY_TTL_SECONDS * 1000,
    });
    return {
      allowed: false,
      minuteCount,
      hourCount,
      dayCount,
      blockedBy: "day",
      cooldownSeconds: RATE_LIMIT_DAILY_TTL_SECONDS,
    };
  }

  return {
    allowed: true,
    minuteCount,
    hourCount,
    dayCount,
  };
}

export interface BookingHoldRecord {
  tenant_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customer_phone: string;
  duration_minutes: number;
  expires_at: string;
  staff_id?: string | null;
}

function bookingLockKey(tenantId: string, date: string, time: string): string {
  return `${BOOKING_LOCK_PREFIX}${tenantId}:${date}:${time}`;
}

function bookingHoldKey(tenantId: string, date: string, time: string): string {
  return `${BOOKING_HOLD_PREFIX}${tenantId}:${date}:${time}`;
}

function normalizeHoldPhone(phone: string): string {
  return normalizePhoneDigits(phone);
}

export async function acquireBookingSlotLock(
  tenantId: string,
  date: string,
  time: string,
  ttlSeconds = BOOKING_LOCK_TTL_SECONDS
): Promise<boolean> {
  const key = bookingLockKey(tenantId, date, time);
  if (redis) {
    try {
      const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
      return result === "OK";
    } catch (err) {
      logRedisFallback("acquireBookingSlotLock", err);
    }
  }
  const now = Date.now();
  const mem = bookingLockMemory.get(key);
  if (mem && mem.expiry > now) return false;
  bookingLockMemory.set(key, { value: "1", expiry: now + ttlSeconds * 1000 });
  return true;
}

export async function releaseBookingSlotLock(
  tenantId: string,
  date: string,
  time: string
): Promise<void> {
  const key = bookingLockKey(tenantId, date, time);
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (err) {
      logRedisFallback("releaseBookingSlotLock", err);
    }
  }
  bookingLockMemory.delete(key);
}

export async function setBookingSlotHold(
  hold: Omit<BookingHoldRecord, "expires_at">,
  ttlSeconds = BOOKING_HOLD_TTL_SECONDS
): Promise<BookingHoldRecord> {
  const key = bookingHoldKey(hold.tenant_id, hold.date, hold.time);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const payload: BookingHoldRecord = {
    ...hold,
    customer_phone: normalizeHoldPhone(hold.customer_phone),
    expires_at: expiresAt,
  };

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(payload), { ex: ttlSeconds });
      return payload;
    } catch (err) {
      logRedisFallback("setBookingSlotHold", err);
    }
  }
  bookingHoldMemory.set(key, {
    value: payload,
    expiry: Date.now() + ttlSeconds * 1000,
  });
  return payload;
}

export async function getBookingSlotHold(
  tenantId: string,
  date: string,
  time: string
): Promise<BookingHoldRecord | null> {
  const key = bookingHoldKey(tenantId, date, time);
  if (redis) {
    try {
      const raw = await redis.get<unknown>(key);
      return parseRedisJson<BookingHoldRecord>(raw);
    } catch (err) {
      logRedisFallback("getBookingSlotHold", err);
    }
  }
  const mem = bookingHoldMemory.get(key);
  if (mem && mem.expiry > Date.now()) return mem.value;
  bookingHoldMemory.delete(key);
  return null;
}

export async function clearBookingSlotHold(
  tenantId: string,
  date: string,
  time: string
): Promise<void> {
  const key = bookingHoldKey(tenantId, date, time);
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (err) {
      logRedisFallback("clearBookingSlotHold", err);
    }
  }
  bookingHoldMemory.delete(key);
}

export async function getBookingHoldsForDate(
  tenantId: string,
  date: string
): Promise<BookingHoldRecord[]> {
  const prefix = bookingHoldKey(tenantId, date, "");
  if (redis) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (!keys || keys.length === 0) return [];
      const holds: BookingHoldRecord[] = [];
      for (const key of keys) {
        const raw = await redis.get<unknown>(key);
        if (!raw) continue;
        const parsed = parseRedisJson<BookingHoldRecord>(raw);
        if (parsed) holds.push(parsed);
      }
      return holds;
    } catch (err) {
      logRedisFallback("getBookingHoldsForDate", err);
    }
  }
  const now = Date.now();
  const holds: BookingHoldRecord[] = [];
  for (const [key, entry] of bookingHoldMemory.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (entry.expiry <= now) {
      bookingHoldMemory.delete(key);
      continue;
    }
    holds.push(entry.value);
  }
  return holds;
}

// --- Admin login rate limiting (brute-force koruması) ---
const ADMIN_LOGIN_PREFIX = "ahi-ai:admin:login:";
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_SECONDS = 60 * 15; // 15 dakika

const adminLoginMemory = new Map<string, { count: number; expiry: number }>();

export async function checkAdminLoginRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const key = `${ADMIN_LOGIN_PREFIX}${identifier}`;
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ADMIN_LOGIN_WINDOW_SECONDS);
      if (count > ADMIN_LOGIN_MAX_ATTEMPTS) {
        const ttl = await redis.ttl(key);
        return { allowed: false, retryAfterSeconds: Math.max(1, ttl) };
      }
      return { allowed: true };
    } catch (err) {
      logRedisFallback("checkAdminLoginRateLimit", err);
    }
  }
  const now = Date.now();
  const mem = adminLoginMemory.get(key);
  if (!mem || mem.expiry < now) {
    adminLoginMemory.set(key, {
      count: 1,
      expiry: now + ADMIN_LOGIN_WINDOW_SECONDS * 1000,
    });
    return { allowed: true };
  }
  mem.count += 1;
  if (mem.count > ADMIN_LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.floor((mem.expiry - now) / 1000)),
    };
  }
  return { allowed: true };
}

export async function resetAdminLoginRateLimit(identifier: string): Promise<void> {
  const key = `${ADMIN_LOGIN_PREFIX}${identifier}`;
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (err) {
      logRedisFallback("resetAdminLoginRateLimit", err);
    }
  }
  adminLoginMemory.delete(key);
}
