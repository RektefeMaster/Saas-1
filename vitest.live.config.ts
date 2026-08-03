import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Sektörel canlı bot testi (`npm run test:bot`).
 *
 * GERÇEK olan: processMessage, prompt üretimi, sektör kuralları, tool tanımları,
 * tool executor, FSM, guardrail'ler ve GERÇEK OpenAI modeli.
 * SAHTE olan: yalnızca veri katmanı (bellek içi Supabase/Redis) ve WhatsApp
 * gönderimi — canlı veritabanına tek satır yazılmaz.
 *
 * OPENAI_API_KEY gerekir ve gerçek token harcar; bu yüzden varsayılan
 * `npm test` koşusunun dışında tutulur.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/__live__/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    // Konuşmalar eşzamanlı; izolasyon AsyncLocalStorage ile. 6 eşzamanlı istek
    // OpenAI rate limitini zorlamadan süreyi ~6 kat kısaltıyor.
    maxConcurrency: 6,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
