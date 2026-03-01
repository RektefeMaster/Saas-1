import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";
import { setOtpChallenge } from "@/lib/redis";
import { sendSmsVerification } from "@/lib/twilio";
import { OTP_TTL_SECONDS, isSms2faEnabledFlag } from "@/lib/otp-auth";

export async function POST(_request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
    }

    if (!isSms2faEnabledFlag()) {
      return NextResponse.json({ success: true, requires_otp: false });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, owner_phone_e164, contact_phone, security_config")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
    }

    const securityConfig = (tenant.security_config || {}) as Record<string, unknown>;
    if (securityConfig.sms_2fa_enabled === false) {
      return NextResponse.json({ success: true, requires_otp: false });
    }

    const phone = (tenant.owner_phone_e164 || tenant.contact_phone || "").trim();
    if (!phone) {
      return NextResponse.json(
        { error: "Bu hesap için owner_phone_e164 veya contact_phone tanımlı değil." },
        { status: 400 }
      );
    }

    await sendSmsVerification(phone);
    const challengeId = randomUUID();
    await setOtpChallenge(
      {
        id: challengeId,
        scope: "dashboard",
        phone,
        user_id: user.id,
        attempts: 0,
        created_at: new Date().toISOString(),
      },
      OTP_TTL_SECONDS
    );

    return NextResponse.json({
      success: true,
      requires_otp: true,
      challenge_id: challengeId,
      expires_in: OTP_TTL_SECONDS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OTP başlatılamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
