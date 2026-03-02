const WHATSAPP_API = "https://graph.facebook.com/v22.0";

function normalizeSecretValue(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, "");
  return unquoted.replace(/\s+/g, "");
}

function normalizePlainValue(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.replace(/^['"]|['"]$/g, "");
}

export interface SendMessageParams {
  to: string;
  text: string;
}

export interface WhatsAppSendResult {
  ok: boolean;
  status?: number;
  errorCode?: number;
  errorSubcode?: number;
  errorMessage?: string;
  to?: string;
}

export interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
}

export interface WhatsAppMediaPayload {
  buffer: Buffer;
  mimeType: string;
}

export async function sendWhatsAppMessageDetailed({
  to,
  text,
}: SendMessageParams): Promise<WhatsAppSendResult> {
  const phoneId = normalizePlainValue(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const token = normalizeSecretValue(process.env.WHATSAPP_ACCESS_TOKEN);
  const normalizedTo = to.replace(/\D/g, "");
  if (!phoneId || !token) {
    console.error("[whatsapp] credentials missing - phoneId:", !!phoneId, "token:", !!token);
    return {
      ok: false,
      status: 0,
      errorMessage: "credentials_missing",
      to: normalizedTo,
    };
  }

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
    if (parsedError?.code === 131030) {
      console.error(
        "[whatsapp] recipient not in allowed list (test number). Add recipient in Meta WhatsApp > API Setup or switch to production number."
      );
    }
    if (parsedError?.code === 131047) {
      console.error(
        "[whatsapp] outside 24h service window. Use an approved template message first."
      );
    }
    console.error("[whatsapp] send error", res.status, "to", normalizedTo, raw);
    return {
      ok: false,
      status: res.status,
      errorCode: parsedError?.code,
      errorSubcode: parsedError?.error_subcode,
      errorMessage: parsedError?.message || raw,
      to: normalizedTo,
    };
  }
  return { ok: true, status: res.status, to: normalizedTo };
}

export async function sendWhatsAppMessage({
  to,
  text,
}: SendMessageParams): Promise<boolean> {
  const result = await sendWhatsAppMessageDetailed({ to, text });
  return result.ok;
}

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "tr",
  bodyParams = [],
}: SendTemplateMessageParams): Promise<boolean> {
  const phoneId = normalizePlainValue(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const token = normalizeSecretValue(process.env.WHATSAPP_ACCESS_TOKEN);
  if (!phoneId || !token) {
    console.error(
      "[whatsapp template] credentials missing - phoneId:",
      !!phoneId,
      "token:",
      !!token
    );
    return false;
  }

  const normalizedTo = to.replace(/\D/g, "");
  const url = `${WHATSAPP_API}/${phoneId}/messages`;
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };
  if (bodyParams.length > 0) {
    payload.template = {
      ...(payload.template as Record<string, unknown>),
      components: [
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("[whatsapp template] send error", res.status, "to", normalizedTo, raw);
    return false;
  }
  return true;
}

async function getWhatsAppMediaUrl(mediaId: string): Promise<{ url: string; mimeType: string } | null> {
  const token = normalizeSecretValue(process.env.WHATSAPP_ACCESS_TOKEN);
  if (!token) return null;
  const url = `${WHATSAPP_API}/${mediaId}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("[whatsapp media] meta error", res.status, raw);
    return null;
  }
  const json = (await res.json().catch(() => ({}))) as {
    url?: string;
    mime_type?: string;
  };
  if (!json.url) return null;
  return { url: json.url, mimeType: json.mime_type || "audio/ogg" };
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<WhatsAppMediaPayload | null> {
  const token = normalizeSecretValue(process.env.WHATSAPP_ACCESS_TOKEN);
  if (!token) return null;
  const meta = await getWhatsAppMediaUrl(mediaId);
  if (!meta) return null;

  const res = await fetch(meta.url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("[whatsapp media] download error", res.status, raw);
    return null;
  }
  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: meta.mimeType,
  };
}
