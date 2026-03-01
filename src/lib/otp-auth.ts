export const ADMIN_OTP_COOKIE = "admin_otp_verified";
export const DASHBOARD_OTP_COOKIE = "dashboard_otp_verified";
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_TTL_SECONDS = 60 * 5;
export const OTP_VERIFIED_TTL_SECONDS = 60 * 60 * 8;

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isSms2faEnabledFlag(): boolean {
  const value = process.env.ENABLE_SMS_2FA?.trim().toLowerCase();
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value);
}
