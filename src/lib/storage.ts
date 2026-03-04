/**
 * Unstorage: Çoklu backend key-value storage.
 * Redis (Upstash) varsa kullanır, yoksa memory fallback.
 * Cache, geçici veri için tek API.
 */
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import upstashDriver from "unstorage/drivers/upstash";

function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return false;
  if (/(your-|placeholder|changeme|xxx\.upstash\.io)/i.test(url)) return false;
  return true;
}

const storage = createStorage({
  driver: isUpstashConfigured()
    ? upstashDriver({
        base: "ahi-ai:cache:",
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : memoryDriver(),
});

export { storage };
