import { NextRequest, NextResponse } from "next/server";
import {
  createAdminToken,
  getAdminClientIdentifier,
  getAdminCookieName,
  getAdminCookieOpts,
} from "@/lib/admin-auth";
import {
  deleteOtpChallenge,
  getOtpChallenge,
  resetAdminLoginRateLimit,
  updateOtpChallengeAttempts,
} from "@/lib/redis";
import { getTwilioVerifyStatus, verifySmsCodeDetailed } from "@/lib/twilio";
import {
  OTP_MAX_ATTEMPTS,
  isSms2faEnabledFlag,
} from "@/lib/otp-auth";

export async function POST(request: NextRequest) {
  try {
    if (!isSms2faEnabledFlag()) {
      return NextResponse.json(
        { error: "OTP akışı kapalı. Gizli giriş (hidden login) kullanın." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      challenge_id?: string;
      code?: string;
    };
    const challengeId = body.challenge_id?.trim();
    const code = body.code?.trim();

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
    if (!challenge || challenge.scope !== "admin") {
      return NextResponse.json({ error: "OTP oturumu bulunamadı veya süresi doldu" }, { status: 410 });
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
    await resetAdminLoginRateLimit(getAdminClientIdentifier(request));
    const token = await createAdminToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set(getAdminCookieName(), token, getAdminCookieOpts());
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OTP doğrulama hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
