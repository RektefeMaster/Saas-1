/**
 * Canlıda kapatılmalı. Env değişkenlerinin varlığını kontrol eder (değer göstermez).
 */
import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    REDIS_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    REDIS_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    OPENAI_KEY: !!process.env.OPENAI_API_KEY,
    WHATSAPP_PHONE_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY: !!process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_WEBHOOK_SECRET: !!process.env.WHATSAPP_WEBHOOK_SECRET,
  };
  const allOk = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok: allOk, checks });
}
