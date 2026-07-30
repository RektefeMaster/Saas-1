import { NextRequest, NextResponse } from "next/server";
import { shortId } from "@/lib/id";
import {
  createAdminToken,
  getAdminClientIdentifier,
  getAdminCookieName,
  getAdminCookieOpts,
  isAdminPasswordValid,
} from "@/lib/admin-auth";
import {
  checkAdminLoginRateLimit,
  checkSimpleRateLimit,
  resetAdminLoginRateLimit,
  setOtpChallenge,
} from "@/lib/redis";
import {
  OTP_TTL_SECONDS,
  isSms2faEnabledFlag,
} from "@/lib/otp-auth";
import { getTwilioVerifyStatus, sendSmsVerification } from "@/lib/twilio";

function getAdminEmail(): string | null {
  const raw = (
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_HIDDEN_LOGIN_IDENTIFIER ||
    ""
  )
    .trim()
    .toLowerCase();
  return raw || null;
}

export async function POST(request: NextRequest) {
  try {
    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      return NextResponse.json(
        { error: "ADMIN_EMAIL / ADMIN_HIDDEN_LOGIN_IDENTIFIER tanımlı değil" },
        { status: 503 }
      );
    }

    const identifier = getAdminClientIdentifier(request);
    const rateLimit = await checkAdminLoginRateLimit(identifier);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.",
          retry_after: rateLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password;

    if (!email || !password || typeof password !== "string") {
      return NextResponse.json({ error: "E-posta ve şifre gerekli" }, { status: 400 });
    }

    const normalizedEmail = email.replace(/\s+/g, "").toLowerCase();
    const normalizedAdminEmail = adminEmail.replace(/\s+/g, "").toLowerCase();
    const emailOk = normalizedEmail === normalizedAdminEmail;
    const passwordOk = isAdminPasswordValid(password);
    if (!emailOk || !passwordOk) {
      // Uniform delay: avoid timing-based email enumeration.
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json(
        { error: "Geçersiz e-posta veya şifre" },
        { status: 401 }
      );
    }

    const sms2faEnabled = isSms2faEnabledFlag();
    if (!sms2faEnabled) {
      await resetAdminLoginRateLimit(identifier);
      const token = await createAdminToken();
      const res = NextResponse.json({ success: true, requires_otp: false });
      res.cookies.set(getAdminCookieName(), token, getAdminCookieOpts());
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

    const adminPhone = process.env.ADMIN_2FA_PHONE_E164?.trim();
    if (!adminPhone) {
      return NextResponse.json(
        { error: "ADMIN_2FA_PHONE_E164 ortam değişkeni tanımlanmalıdır." },
        { status: 500 }
      );
    }

    const otpSendLimit = await checkSimpleRateLimit(`admin-otp-send:${identifier}`, 3, 60 * 15);
    if (!otpSendLimit.allowed) {
      return NextResponse.json(
        { error: "Çok fazla OTP SMS isteği. Lütfen biraz sonra tekrar deneyin." },
        { status: 429 }
      );
    }

    const challengeId = shortId(12);
    await sendSmsVerification(adminPhone);
    await setOtpChallenge(
      {
        id: challengeId,
        scope: "admin",
        phone: adminPhone,
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
  } catch (error) {
    console.error("Admin login hatası:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
