const WHATSAPP_API = "https://graph.facebook.com/v22.0";

export interface SendMessageParams {
  to: string;
  text: string;
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

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "tr",
  bodyParams = [],
}: SendTemplateMessageParams): Promise<boolean> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
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
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
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
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
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
