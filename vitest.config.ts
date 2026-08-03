import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    /**
     * Sektörel canlı bot testi varsayılan koşuya girmez: gerçek OpenAI
     * çağrıları yapar (ücretli, ~8 dk) ve OPENAI_API_KEY gerektirir.
     * Elle çalıştırmak için: npm run test:bot
     */
    exclude: ["**/node_modules/**", "**/dist/**", "src/test/__live__/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
