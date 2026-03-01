import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createAdminToken,
  isAdminPasswordValid,
  getAdminCookieName,
  getAdminCookieOpts,
} from "@/lib/admin-auth";
import { setOtpChallenge } from "@/lib/redis";
import { sendSmsVerification } from "@/lib/twilio";
import {
  ADMIN_OTP_COOKIE,
  OTP_TTL_SECONDS,
  isSms2faEnabledFlag,
  cookieSecure,
} from "@/lib/otp-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Şifre gerekli" },
        { status: 400 }
      );
    }

    if (!isAdminPasswordValid(password)) {
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json(
        { error: "Geçersiz şifre" },
        { status: 401 }
      );
    }

    const sms2faEnabled = isSms2faEnabledFlag();
    if (!sms2faEnabled) {
      const token = await createAdminToken();
      const res = NextResponse.json({ success: true });
      res.cookies.set(getAdminCookieName(), token, getAdminCookieOpts());
      res.cookies.set(ADMIN_OTP_COOKIE, "ok", {
        httpOnly: true,
        secure: cookieSecure(),
        sameSite: "strict",
        path: "/",
        maxAge: getAdminCookieOpts().maxAge,
      });
      return res;
    }

    const adminPhone = process.env.ADMIN_2FA_PHONE_E164?.trim();
    if (!adminPhone) {
      return NextResponse.json(
        { error: "ADMIN_2FA_PHONE_E164 tanımlanmadı." },
        { status: 500 }
      );
    }

    await sendSmsVerification(adminPhone);
    const challengeId = randomUUID();
    await setOtpChallenge({
      id: challengeId,
      scope: "admin",
      phone: adminPhone,
      attempts: 0,
      created_at: new Date().toISOString(),
    }, OTP_TTL_SECONDS);

    return NextResponse.json({
      success: true,
      requires_otp: true,
      challenge_id: challengeId,
      expires_in: OTP_TTL_SECONDS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Giriş hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
