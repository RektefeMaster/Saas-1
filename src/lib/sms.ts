const TWILIO_MESSAGES_API = "https://api.twilio.com/2010-04-01";

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeE164(phone: string): string {
  const raw = phone.trim();
  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D/g, "")}`;
  }
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("0") ? `+9${digits}` : `+${digits}`;
}

function buildAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

export function isInfoSmsEnabled(): boolean {
  return isTruthy(process.env.ENABLE_INFO_SMS);
}

function getSmsConfig(): {
  accountSid: string;
  authToken: string;
  from: string;
} {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const from =
    process.env.TWILIO_SMS_FROM_E164?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    "";

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio SMS konfigürasyonu eksik.");
  }
  if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
    throw new Error("TWILIO_ACCOUNT_SID formatı geçersiz.");
  }

  return {
    accountSid,
    authToken,
    from: normalizeE164(from),
  };
}

export async function sendInfoSms(to: string, body: string): Promise<boolean> {
  if (!isInfoSmsEnabled()) return false;

  let cfg: { accountSid: string; authToken: string; from: string };
  try {
    cfg = getSmsConfig();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sms] config error:", msg);
    return false;
  }

  const response = await fetch(
    `${TWILIO_MESSAGES_API}/Accounts/${cfg.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(cfg.accountSid, cfg.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizeE164(to),
        From: cfg.from,
        Body: body,
      }),
    }
  );

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    console.error(`[sms] send failed (${response.status})`, payload);
    return false;
  }
  return true;
}
