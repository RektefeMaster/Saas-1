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

const SESSION_PREFIX = "saasrandevu:session:";
const PHONE_TENANT_PREFIX = "saasrandevu:phone2tenant:";
const TTL_SECONDS = 60 * 60 * 24; // 24 saat

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
