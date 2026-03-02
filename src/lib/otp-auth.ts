export const ADMIN_OTP_COOKIE = "admin_otp_verified";
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

function isPlaceholder(value: string): boolean {
  return /(your-|placeholder|changeme|xxx|example|test-token|test)/i.test(value);
}

function hasTwilioVerifyConfig(): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "";
  if (!accountSid || !authToken || !serviceSid) return false;
  if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) return false;
  if (!/^VA[a-zA-Z0-9]{32}$/.test(serviceSid)) return false;
  if (authToken.length < 12 || isPlaceholder(authToken)) return false;
  return true;
}

export function isSms2faEnabledFlag(): boolean {
  return isTruthy(process.env.ENABLE_SMS_2FA);
}

export function isTwilioVerifyConfigReady(): boolean {
  return hasTwilioVerifyConfig();
}
