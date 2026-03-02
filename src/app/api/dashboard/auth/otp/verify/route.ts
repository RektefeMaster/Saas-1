import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";
import { deleteOtpChallenge, getOtpChallenge, updateOtpChallengeAttempts } from "@/lib/redis";
import { getTwilioVerifyStatus, verifySmsCode } from "@/lib/twilio";
import {
  DASHBOARD_OTP_COOKIE,
  OTP_MAX_ATTEMPTS,
  OTP_VERIFIED_TTL_SECONDS,
  cookieSecure,
  isSms2faEnabledFlag,
} from "@/lib/otp-auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      challenge_id?: string;
      code?: string;
    };
    const challengeId = body.challenge_id?.trim();
    const code = body.code?.trim();

    const supabaseClient = await createClient();
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
    }

    if (!isSms2faEnabledFlag()) {
      const res = NextResponse.json({ success: true });
      res.cookies.set(DASHBOARD_OTP_COOKIE, user.id, {
        httpOnly: true,
        secure: cookieSecure(),
        sameSite: "strict",
        path: "/",
        maxAge: OTP_VERIFIED_TTL_SECONDS,
      });
      return res;
    }

    const twilioStatus = getTwilioVerifyStatus();
    if (!twilioStatus.configReady) {
      const missing = twilioStatus.missing.join(", ");
      const invalid = twilioStatus.invalid.join(", ");
      const details = [missing ? `eksik: ${missing}` : "", invalid ? `geçersiz: ${invalid}` : ""]
        .filter(Boolean)
        .join(" | ");
      return NextResponse.json(
        { error: `SMS 2FA yapılandırması hazır değil${details ? ` (${details})` : ""}.` },
        { status: 503 }
      );
    }

    if (!challengeId || !code) {
      return NextResponse.json({ error: "challenge_id ve code gerekli" }, { status: 400 });
    }

    const challenge = await getOtpChallenge(challengeId);
    if (!challenge || challenge.scope !== "dashboard") {
      return NextResponse.json({ error: "OTP oturumu bulunamadı veya süresi doldu" }, { status: 410 });
    }
    if (challenge.user_id !== user.id) {
      return NextResponse.json({ error: "OTP oturumu kullanıcıyla eşleşmedi" }, { status: 403 });
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      await deleteOtpChallenge(challengeId);
      return NextResponse.json({ error: "Maksimum deneme aşıldı" }, { status: 429 });
    }

    const ok = await verifySmsCode(challenge.phone, code);
    if (!ok) {
      await updateOtpChallengeAttempts(challengeId, challenge.attempts + 1);
      return NextResponse.json({ error: "Kod doğrulanamadı" }, { status: 401 });
    }

    await deleteOtpChallenge(challengeId);

    // İlk OTP doğrulamasında phone_verified_at set et
    await supabase
      .from("tenants")
      .update({ phone_verified_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("phone_verified_at", null);

    const res = NextResponse.json({ success: true });
    res.cookies.set(DASHBOARD_OTP_COOKIE, user.id, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "strict",
      path: "/",
      maxAge: OTP_VERIFIED_TTL_SECONDS,
    });
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OTP doğrulama hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
