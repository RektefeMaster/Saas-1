import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, getAdminCookieName, getAdminCookieOpts, isAdminPasswordValid } from "@/lib/admin-auth";
import { deleteOtpChallenge, getOtpChallenge, updateOtpChallengeAttempts } from "@/lib/redis";
import { getTwilioVerifyStatus, verifySmsCode } from "@/lib/twilio";
import {
  ADMIN_OTP_COOKIE,
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
      password?: string;
    };
    const challengeId = body.challenge_id?.trim();
    const code = body.code?.trim();

    if (!isSms2faEnabledFlag()) {
      const password = body.password;
      if (!password || typeof password !== "string") {
        return NextResponse.json({ error: "password gerekli" }, { status: 400 });
      }
      if (!isAdminPasswordValid(password)) {
        await new Promise((r) => setTimeout(r, 2000));
        return NextResponse.json({ error: "Geçersiz şifre" }, { status: 401 });
      }
      const token = await createAdminToken();
      const res = NextResponse.json({ success: true });
      res.cookies.set(getAdminCookieName(), token, getAdminCookieOpts());
      res.cookies.set(ADMIN_OTP_COOKIE, "ok", {
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
    if (!challenge || challenge.scope !== "admin") {
      return NextResponse.json({ error: "OTP oturumu bulunamadı veya süresi doldu" }, { status: 410 });
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
    const token = await createAdminToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set(getAdminCookieName(), token, getAdminCookieOpts());
    res.cookies.set(ADMIN_OTP_COOKIE, "ok", {
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
