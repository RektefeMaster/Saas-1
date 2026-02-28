import { checkAndIncrementRateLimit } from "@/lib/redis";

const RATE_LIMIT_MESSAGE =
  "Çok fazla mesaj gönderdiniz, lütfen 1 dakika bekleyin.";

/**
 * Aynı numaradan 1 dakikada max 15 mesaj.
 * Redis key: ratelimit:{phone}, TTL 60 saniye.
 * Limit aşımında { allowed: false, message } döner ve loglanır.
 */
export async function enforceRateLimit(phone: string): Promise<
  | { allowed: true }
  | { allowed: false; message: string }
> {
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) {
    return { allowed: true };
  }
  const { allowed, count } = await checkAndIncrementRateLimit(phone);
  if (!allowed) {
    console.warn("[rateLimit] Limit exceeded", { phone: normalized, count });
    return { allowed: false, message: RATE_LIMIT_MESSAGE };
  }
  return { allowed: true };
}
