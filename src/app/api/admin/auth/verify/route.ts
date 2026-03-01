import { NextRequest, NextResponse } from "next/server";
import { createAdminToken, getAdminCookieName, getAdminCookieOpts } from "@/lib/admin-auth";
import { deleteOtpChallenge, getOtpChallenge, updateOtpChallengeAttempts } from "@/lib/redis";
import { verifySmsCode } from "@/lib/twilio";
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
    };
    const challengeId = body.challenge_id?.trim();
    const code = body.code?.trim();

    if (!challengeId || !code) {
      return NextResponse.json({ error: "challenge_id ve code gerekli" }, { status: 400 });
    }

    if (!isSms2faEnabledFlag()) {
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
