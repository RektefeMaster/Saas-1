import { Redis } from "@upstash/redis";
import type { ConversationState } from "./database.types";

const redis: Redis | null =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Development fallback: Redis yoksa in-memory (server restart'ta silinir)
const memoryStore = new Map<string, { value: ConversationState; expiry: number }>();
const phoneTenantStore = new Map<string, { value: string; expiry: number }>();

const SESSION_PREFIX = "saasrandevu:session:";
const PHONE_TENANT_PREFIX = "saasrandevu:phone2tenant:";
const TTL_SECONDS = 60 * 60 * 24; // 24 saat

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
    return redis.get<ConversationState>(key);
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
    await redis.set(key, data, { ex: TTL_SECONDS });
    return;
  }
  memoryStore.set(key, { value: data, expiry: Date.now() + TTL_SECONDS * 1000 });
}

export async function deleteSession(
  tenantId: string,
  customerPhone: string
): Promise<void> {
  const key = sessionKey(tenantId, customerPhone);
  if (redis) {
    await redis.del(key);
    return;
  }
  memoryStore.delete(key);
}

export function hasRedis(): boolean {
  return redis !== null;
}

export async function getTenantIdByPhone(customerPhone: string): Promise<string | null> {
  const key = PHONE_TENANT_PREFIX + customerPhone.replace(/\D/g, "");
  if (redis) {
    return redis.get<string>(key);
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
    await redis.set(key, tenantId, { ex: TTL_SECONDS });
    return;
  }
  phoneTenantStore.set(key, { value: tenantId, expiry: Date.now() + TTL_SECONDS * 1000 });
}

export async function clearPhoneTenantMapping(customerPhone: string): Promise<void> {
  const key = PHONE_TENANT_PREFIX + customerPhone.replace(/\D/g, "");
  if (redis) await redis.del(key);
  else phoneTenantStore.delete(key);
}
