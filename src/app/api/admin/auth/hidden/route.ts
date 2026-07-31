import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

function getHiddenIdentifier(): string | null {
  const raw = process.env.ADMIN_HIDDEN_LOGIN_IDENTIFIER?.trim().toLowerCase() || "";
  return raw || null;
}

export async function POST(request: NextRequest) {
  try {
    const hiddenIdentifier = getHiddenIdentifier();
    if (!hiddenIdentifier) {
      return NextResponse.json(
        { error: "ADMIN_HIDDEN_LOGIN_IDENTIFIER tanımlı değil" },
        { status: 503 }
      );
    }

    const clientId = getAdminClientIdentifier(request);
    const rateLimit = await checkAdminLoginRateLimit(clientId);
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
      identifier?: string;
      password?: string;
    };
    const identifier = body.identifier?.trim().toLowerCase() || "";
    const password = body.password;

    if (!identifier || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Kimlik bilgileri eksik" }, { status: 400 });
    }

    const identifierOk = identifier === hiddenIdentifier;
    const passwordOk = isAdminPasswordValid(password);
    if (!identifierOk || !passwordOk) {
      // Uniform delay: avoid timing-based identifier enumeration.
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya şifre" }, { status: 401 });
    }

    const sms2faEnabled = isSms2faEnabledFlag();
    if (!sms2faEnabled) {
      await resetAdminLoginRateLimit(clientId);
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
        { error: "ADMIN_2FA_PHONE_E164 tanımlanmadı." },
        { status: 500 }
      );
    }

    const otpSendLimit = await checkSimpleRateLimit(`admin-otp-send:${clientId}`, 3, 60 * 15);
    if (!otpSendLimit.allowed) {
      return NextResponse.json(
        { error: "Çok fazla OTP SMS isteği. Lütfen biraz sonra tekrar deneyin." },
        { status: 429 }
      );
    }

    await sendSmsVerification(adminPhone);
    const challengeId = randomUUID();
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gizli admin giriş hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
