const TWILIO_API_BASE = "https://verify.twilio.com/v2";

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isPlaceholder(value: string): boolean {
  return /(your-|placeholder|changeme|xxx|example|test-token|test)/i.test(value);
}

function isAccountSidValid(value: string): boolean {
  return /^AC[a-zA-Z0-9]{32}$/.test(value);
}

function isServiceSidValid(value: string): boolean {
  return /^VA[a-zA-Z0-9]{32}$/.test(value);
}

function isAuthTokenValid(value: string): boolean {
  if (isPlaceholder(value)) return false;
  return value.trim().length >= 12;
}

export function isSms2faEnabled(): boolean {
  return isTruthy(process.env.ENABLE_SMS_2FA);
}

export interface TwilioVerifyStatus {
  enabledByFlag: boolean;
  configReady: boolean;
  missing: Array<"TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN" | "TWILIO_VERIFY_SERVICE_SID">;
  invalid: Array<"TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN" | "TWILIO_VERIFY_SERVICE_SID">;
  accountSidSet: boolean;
  authTokenSet: boolean;
  serviceSidSet: boolean;
}

export function getTwilioVerifyStatus(): TwilioVerifyStatus {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "";

  const missing: TwilioVerifyStatus["missing"] = [];
  const invalid: TwilioVerifyStatus["invalid"] = [];

  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!serviceSid) missing.push("TWILIO_VERIFY_SERVICE_SID");

  if (accountSid && !isAccountSidValid(accountSid)) invalid.push("TWILIO_ACCOUNT_SID");
  if (authToken && !isAuthTokenValid(authToken)) invalid.push("TWILIO_AUTH_TOKEN");
  if (serviceSid && !isServiceSidValid(serviceSid)) invalid.push("TWILIO_VERIFY_SERVICE_SID");

  return {
    enabledByFlag: isSms2faEnabled(),
    configReady: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    accountSidSet: Boolean(accountSid),
    authTokenSet: Boolean(authToken),
    serviceSidSet: Boolean(serviceSid),
  };
}

export function isTwilioVerifyConfigured(): boolean {
  return getTwilioVerifyStatus().configReady;
}

export function isSms2faOperational(): boolean {
  const status = getTwilioVerifyStatus();
  return status.enabledByFlag && status.configReady;
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() || "";
  const status = getTwilioVerifyStatus();
  if (!status.configReady) {
    const parts: string[] = [];
    if (status.missing.length) parts.push(`eksik: ${status.missing.join(", ")}`);
    if (status.invalid.length) parts.push(`geçersiz: ${status.invalid.join(", ")}`);
    throw new Error(
      `Twilio Verify yapılandırması eksik veya geçersiz (${parts.join(" | ")}).`
    );
  }
  return { accountSid, authToken, serviceSid };
}

function buildAuthHeader(accountSid: string, authToken: string): string {
  const raw = `${accountSid}:${authToken}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

export async function sendSmsVerification(phoneE164: string): Promise<void> {
  const { accountSid, authToken, serviceSid } = getTwilioConfig();
  const response = await fetch(
    `${TWILIO_API_BASE}/Services/${serviceSid}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phoneE164,
        Channel: "sms",
      }),
    }
  );

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Twilio doğrulama kodu gönderilemedi (${response.status}): ${payload}`);
  }
}

export async function verifySmsCode(phoneE164: string, code: string): Promise<boolean> {
  const { accountSid, authToken, serviceSid } = getTwilioConfig();
  const response = await fetch(
    `${TWILIO_API_BASE}/Services/${serviceSid}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phoneE164,
        Code: code,
      }),
    }
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    status?: string;
    valid?: boolean;
  };
  return payload.status === "approved" || payload.valid === true;
}
