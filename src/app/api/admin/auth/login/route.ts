import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  createAdminToken,
  getAdminCookieName,
  getAdminCookieOpts,
  isAdminPasswordValid,
} from "@/lib/admin-auth";
import { setOtpChallenge } from "@/lib/redis";
import {
  ADMIN_OTP_COOKIE,
  OTP_TTL_SECONDS,
  cookieSecure,
  isSms2faEnabledFlag,
} from "@/lib/otp-auth";
import { getTwilioVerifyStatus, sendSmsVerification } from "@/lib/twilio";

const DEFAULT_ADMIN_EMAIL = "nuronuro458@gmail.com";

function getAdminEmail(): string {
  const email = (
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_HIDDEN_LOGIN_IDENTIFIER ||
    DEFAULT_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();
  
  // Debug için log
  if (process.env.NODE_ENV === "development") {
    console.log("Admin email configured:", email);
  }
  
  return email;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password;

    if (!email || !password || typeof password !== "string") {
      return NextResponse.json({ error: "E-posta ve şifre gerekli" }, { status: 400 });
    }

    const adminEmail = getAdminEmail();
    
    // Debug için log (production'da kaldırılabilir)
    console.log("Admin login attempt:", {
      providedEmail: email,
      expectedEmail: adminEmail,
      match: email === adminEmail,
    });
    
    // E-posta kontrolü - sadece admin e-postası kabul edilir
    // Normalize edilmiş e-posta karşılaştırması
    const normalizedEmail = email.replace(/\s+/g, "").toLowerCase();
    const normalizedAdminEmail = adminEmail.replace(/\s+/g, "").toLowerCase();
    
    if (normalizedEmail !== normalizedAdminEmail) {
      await new Promise((r) => setTimeout(r, 600));
      // Production'da güvenlik için e-posta göstermeyelim, sadece hata mesajı
      return NextResponse.json({ 
        error: "Geçersiz e-posta veya şifre. Lütfen admin e-posta adresini ve şifresini kontrol edin." 
      }, { status: 401 });
    }

    if (!isAdminPasswordValid(password)) {
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json({ error: "Geçersiz e-posta veya şifre" }, { status: 401 });
    }

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
        { error: "ADMIN_2FA_PHONE_E164 ortam değişkeni tanımlanmalıdır." },
        { status: 500 }
      );
    }

    const challengeId = randomUUID();
    const verifyResult = await sendSmsVerification(adminPhone);
    if (!verifyResult.success) {
      return NextResponse.json(
        { error: `SMS gönderilemedi: ${verifyResult.error || "Bilinmeyen hata"}` },
        { status: 500 }
      );
    }

    await setOtpChallenge({
      challenge_id: challengeId,
      scope: "admin",
      phone: adminPhone,
      expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
      attempts: 0,
    });

    return NextResponse.json({
      requires_otp: true,
      challenge_id: challengeId,
    });
  } catch (error) {
    console.error("Admin login hatası:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bilinmeyen hata" },
      { status: 500 }
    );
  }
}
