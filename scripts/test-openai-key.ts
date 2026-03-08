/**
 * OpenAI API key testi. .env dosyasındaki OPENAI_API_KEY ile kısa bir çağrı yapar.
 * Kullanım: npx tsx scripts/test-openai-key.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import OpenAI from "openai";

function loadEnv(): void {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("OPENAI_API_KEY=")) {
        const value = trimmed.slice("OPENAI_API_KEY=".length).trim();
        const unquoted = value.replace(/^["']|["']$/g, "");
        process.env.OPENAI_API_KEY = unquoted;
        return;
      }
    }
  } catch {
    // .env yoksa process.env zaten dolu olabilir (next dev vb.)
  }
}

loadEnv();

const rawKey = process.env.OPENAI_API_KEY ?? "";
const key = rawKey.replace(/\s/g, "").trim();
const keyOk = key.length >= 20 && key.startsWith("sk-");

if (!keyOk) {
  console.error("❌ OPENAI_API_KEY eksik veya geçersiz (.env içinde sk- ile başlamalı, en az 20 karakter)");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: key });

async function main() {
  console.log("🔄 OpenAI API test ediliyor (gpt-4o-mini, tek cümle)...");
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Merhaba, tek kelime cevap ver: tamam" }],
      max_tokens: 10,
    });
    const text = res.choices[0]?.message?.content ?? "";
    console.log("✅ OpenAI API çalışıyor. Yanıt:", text.trim() || "(boş)");
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    const status = e?.status;
    const message = e?.error?.message ?? e?.message ?? String(err);
    console.error("❌ OpenAI hatası:", message);
    if (status === 401) console.error("   → API key yanlış veya iptal edilmiş. platform.openai.com → API keys");
    if (status === 429) console.error("   → Kota / limit. platform.openai.com → Billing / Usage");
    process.exit(1);
  }
}

main();
