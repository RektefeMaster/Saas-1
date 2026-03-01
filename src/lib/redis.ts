import { Redis } from "@upstash/redis";
import type { ConversationState } from "./database.types";

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

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

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
/** [YENİ] Tenant cache key prefix; TTL 300 saniye (5 dk). */
const TENANT_CACHE_PREFIX = "ahi-ai:tenant:id:";
const TENANT_CACHE_TTL_SECONDS = 300;
const TTL_SECONDS = 60 * 60 * 24; // 24 saat
const RATE_LIMIT_TTL_SECONDS = 60; // 1 dakika
const RATE_LIMIT_MAX = 15; // dakikada max mesaj

/** [YENİ] Tenant cache in-memory fallback (Redis yoksa). */
const tenantCacheMemory = new Map<string, { value: string; expiry: number }>();
const otpChallengeMemory = new Map<string, { value: string; expiry: number }>();

function logRedisFallback(action: string, err: unknown) {
  if (fallbackLogged) return;
  fallbackLogged = true;
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[redis] ${action} failed, in-memory fallback active: ${msg}`);
}

function sessionKey(tenantId: string, customerPhone: string): string {
  const normalized = customerPhone.replace(/\D/g, "");
  return `${SESSION_PREFIX}${tenantId}:${normalized}`;
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

export function hasRedis(): boolean {
  return redis !== null;
}

export async function getTenantIdByPhone(customerPhone: string): Promise<string | null> {
  const key = PHONE_TENANT_PREFIX + customerPhone.replace(/\D/g, "");
  if (redis) {
    try {
      return await redis.get<string>(key);
    } catch (err) {
      logRedisFallback("getTenantIdByPhone", err);
    }
  }
  const mem = phoneTenantStore.get(key);
  if (mem && mem.expiry > Date.now()) return mem.value;
  phoneTenantStore.delete(key);
  return null;
}

export async function setPhoneTenantMapping(
  customerPhone: string,
  tenantId: string
): Promise<void> {
  const key = PHONE_TENANT_PREFIX + customerPhone.replace(/\D/g, "");
  if (redis) {
    try {
      await redis.set(key, tenantId, { ex: TTL_SECONDS });
      return;
    } catch (err) {
      logRedisFallback("setPhoneTenantMapping", err);
    }
  }
  phoneTenantStore.set(key, { value: tenantId, expiry: Date.now() + TTL_SECONDS * 1000 });
}

export async function clearPhoneTenantMapping(customerPhone: string): Promise<void> {
  const key = PHONE_TENANT_PREFIX + customerPhone.replace(/\D/g, "");
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (err) {
      logRedisFallback("clearPhoneTenantMapping", err);
    }
  }
  phoneTenantStore.delete(key);
}

/**
 * [YENİ] Tenant cache — get. TTL 5 dk. Cache miss → null (DB'den çekilip setTenantCache ile yazılır).
 */
export async function getTenantFromCache(tenantId: string): Promise<unknown | null> {
  const key = TENANT_CACHE_PREFIX + tenantId;
  if (redis) {
    try {
      const raw = await redis.get<string>(key);
      return raw ? (JSON.parse(raw) as unknown) : null;
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
      const raw = await redis.get<string>(key);
      return raw ? (JSON.parse(raw) as OtpChallenge) : null;
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

export async function checkAndIncrementRateLimit(phone: string): Promise<{ allowed: boolean; count: number }> {
  const key = RATE_LIMIT_PREFIX + phone.replace(/\D/g, "");
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, RATE_LIMIT_TTL_SECONDS);
      return { allowed: count <= RATE_LIMIT_MAX, count };
    } catch (err) {
      logRedisFallback("checkAndIncrementRateLimit", err);
    }
  }
  const now = Date.now();
  const mem = rateLimitMemory.get(key);
  if (!mem || mem.expiry < now) {
    rateLimitMemory.set(key, { count: 1, expiry: now + RATE_LIMIT_TTL_SECONDS * 1000 });
    return { allowed: true, count: 1 };
  }
  mem.count += 1;
  return { allowed: mem.count <= RATE_LIMIT_MAX, count: mem.count };
}
