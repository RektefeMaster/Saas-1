import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createAdminToken,
  getAdminCookieName,
  getAdminCookieOpts,
  isAdminPasswordValid,
} from "@/lib/admin-auth";
import { checkAdminLoginRateLimit, resetAdminLoginRateLimit, setOtpChallenge } from "@/lib/redis";
import {
  ADMIN_OTP_COOKIE,
  OTP_TTL_SECONDS,
  cookieSecure,
  isSms2faEnabledFlag,
} from "@/lib/otp-auth";
import { getTwilioVerifyStatus, sendSmsVerification } from "@/lib/twilio";

const DEFAULT_ADMIN_HIDDEN_IDENTIFIER = "nuronuro458@gmail.com";

function getHiddenIdentifier(): string {
  return (
    process.env.ADMIN_HIDDEN_LOGIN_IDENTIFIER ||
    DEFAULT_ADMIN_HIDDEN_IDENTIFIER
  )
    .trim()
    .toLowerCase();
}

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  return ip.replace(/[^a-zA-Z0-9.:-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
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

    if (identifier !== getHiddenIdentifier()) {
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya şifre" }, { status: 404 });
    }

    if (!isAdminPasswordValid(password)) {
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json({ error: "Geçersiz kullanıcı adı veya şifre" }, { status: 401 });
    }

    await resetAdminLoginRateLimit(clientId);

    const sms2faEnabled = isSms2faEnabledFlag();
    if (!sms2faEnabled) {
      const token = await createAdminToken();
      const res = NextResponse.json({ success: true, requires_otp: false });
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
