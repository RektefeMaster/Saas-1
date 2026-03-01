const WHATSAPP_API = "https://graph.facebook.com/v22.0";

export interface SendMessageParams {
  to: string;
  text: string;
}

export async function sendWhatsAppMessage({
  to,
  text,
}: SendMessageParams): Promise<boolean> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    console.error("[whatsapp] credentials missing - phoneId:", !!phoneId, "token:", !!token);
    return false;
  }

  const normalizedTo = to.replace(/\D/g, "");
  const url = `${WHATSAPP_API}/${phoneId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "text",
    text: { body: text },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsedError: { code?: number; error_subcode?: number; message?: string } | undefined;
    try {
      const parsed = JSON.parse(raw) as {
        error?: { code?: number; error_subcode?: number; message?: string };
      };
      parsedError = parsed.error;
    } catch {
      parsedError = undefined;
    }
    const maybeExpired =
      res.status === 401 &&
      parsedError?.code === 190 &&
      (parsedError.error_subcode === 463 ||
        /session has expired/i.test(parsedError.message || ""));
    if (maybeExpired) {
      console.error("[whatsapp] access token expired - refresh WHATSAPP_ACCESS_TOKEN");
    }
    console.error("[whatsapp] send error", res.status, "to", normalizedTo, raw);
    return false;
  }
  return true;
}
