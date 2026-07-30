import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";
import { deleteOtpChallenge, getOtpChallenge, updateOtpChallengeAttempts } from "@/lib/redis";
import { getTwilioVerifyStatus, verifySmsCodeDetailed } from "@/lib/twilio";
import {
  DASHBOARD_OTP_COOKIE,
  OTP_MAX_ATTEMPTS,
  OTP_VERIFIED_TTL_SECONDS,
  cookieSecure,
  createDashboardOtpCookieValue,
  isSms2faEnabledFlag,
} from "@/lib/otp-auth";

function setSignedOtpCookie(res: NextResponse, userId: string): boolean {
  const value = createDashboardOtpCookieValue(userId, OTP_VERIFIED_TTL_SECONDS);
  if (!value) return false;
  res.cookies.set(DASHBOARD_OTP_COOKIE, value, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: OTP_VERIFIED_TTL_SECONDS,
  });
  return true;
}

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
      if (!setSignedOtpCookie(res, user.id)) {
        return NextResponse.json(
          { error: "OTP çerez imzası için ADMIN_SESSION_SECRET gerekli" },
          { status: 503 }
        );
      }
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

    const verifyResult = await verifySmsCodeDetailed(challenge.phone, code);
    if (!verifyResult.ok) {
      if (verifyResult.reason === "upstream_error") {
        return NextResponse.json(
          { error: "SMS doğrulama servisi geçici olarak kullanılamıyor" },
          { status: 503 }
        );
      }
      await updateOtpChallengeAttempts(challengeId, challenge.attempts + 1);
      return NextResponse.json({ error: "Kod doğrulanamadı" }, { status: 401 });
    }

    await deleteOtpChallenge(challengeId);

    await supabase
      .from("tenants")
      .update({ phone_verified_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("phone_verified_at", null);

    const res = NextResponse.json({ success: true });
    if (!setSignedOtpCookie(res, user.id)) {
      return NextResponse.json(
        { error: "OTP çerez imzası için ADMIN_SESSION_SECRET gerekli" },
        { status: 503 }
      );
    }
    return res;
  } catch (err) {
    console.error("[dashboard otp verify]", err);
    return NextResponse.json({ error: "OTP doğrulama hatası" }, { status: 500 });
  }
}
