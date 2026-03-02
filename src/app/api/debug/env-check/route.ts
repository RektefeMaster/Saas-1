/**
 * Canlıda kapatılmalı. Env değişkenlerinin varlığını kontrol eder (değer göstermez).
 */
import { NextResponse } from "next/server";
import { getTwilioVerifyStatus } from "@/lib/twilio";
import { requireDebugAccess } from "@/lib/debug-auth";

export async function GET() {
  const blocked = await requireDebugAccess();
  if (blocked) return blocked;

  const twilio = getTwilioVerifyStatus();
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
    SMS_2FA_FLAG: twilio.enabledByFlag,
    TWILIO_VERIFY_READY: twilio.configReady,
    INFO_SMS_ENABLED: !!process.env.ENABLE_INFO_SMS,
    TWILIO_SMS_FROM_SET:
      !!process.env.TWILIO_SMS_FROM_E164 || !!process.env.TWILIO_PHONE_NUMBER,
  };
  const allOk = Object.values(checks).every(Boolean);
  return NextResponse.json({
    ok: allOk,
    checks,
    twilio: {
      missing: twilio.missing,
      invalid: twilio.invalid,
    },
  });
}
