const TWILIO_API_BASE = "https://verify.twilio.com/v2";

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function isSms2faEnabled(): boolean {
  return isTruthy(process.env.ENABLE_SMS_2FA);
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("Twilio Verify yapılandırması eksik.");
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
