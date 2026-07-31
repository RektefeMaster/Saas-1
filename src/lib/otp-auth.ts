import { createHmac, timingSafeEqual } from "crypto";

export const DASHBOARD_OTP_COOKIE = "dashboard_otp_verified";
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_TTL_SECONDS = 60 * 5;
export const OTP_VERIFIED_TTL_SECONDS = 60 * 60 * 8;

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function isSms2faEnabledFlag(): boolean {
  return isTruthy(process.env.ENABLE_SMS_2FA);
}

function isWeakSecret(secret: string): boolean {
  return /(your-|placeholder|changeme|change-this|example|xxx|test-secret|at-least-32)/i.test(
    secret
  );
}

function getOtpCookieSecret(): string | null {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.OTP_COOKIE_SECRET?.trim() ||
    "";
  if (!secret || secret.length < 32 || isWeakSecret(secret)) return null;
  return secret;
}

/** Signed dashboard OTP cookie value: `${userId}.${exp}.${mac}` */
export function createDashboardOtpCookieValue(
  userId: string,
  ttlSeconds = OTP_VERIFIED_TTL_SECONDS
): string | null {
  const secret = getOtpCookieSecret();
  if (!secret || !userId) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyDashboardOtpCookieValue(
  cookieValue: string | undefined | null,
  expectedUserId: string
): boolean {
  if (!cookieValue || !expectedUserId) return false;
  const secret = getOtpCookieSecret();
  if (!secret) return false;

  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;
  const [userId, expStr, mac] = parts;
  if (userId !== expectedUserId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const payload = `${userId}.${expStr}`;
  const expectedMac = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expectedMac);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
