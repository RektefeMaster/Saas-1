import { getRuntimeWhatsAppConfig } from "./redis";
import { withRetry } from "./retry";

const WHATSAPP_API = "https://graph.facebook.com/v22.0";

function normalizeSecretValue(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^['"]|['"]$/g, "");
  const withoutBearer = unquoted.replace(/^bearer\s+/i, "");
  const compact = withoutBearer.replace(/\s+/g, "");
  const tokenMatch = compact.match(/EAA[A-Za-z0-9]+/);
  if (tokenMatch?.[0]) return tokenMatch[0];
  return compact;
}

function normalizePlainValue(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.replace(/^['"]|['"]$/g, "");
}

export async function resolveWhatsAppCredentials(): Promise<{
  phoneId: string;
  token: string;
  source: "runtime" | "env";
}> {
  const runtime = await getRuntimeWhatsAppConfig();
  const runtimePhone = normalizePlainValue(runtime?.phone_id);
  const runtimeToken = normalizeSecretValue(runtime?.token);

  if (runtimePhone && runtimeToken) {
    return { phoneId: runtimePhone, token: runtimeToken, source: "runtime" };
  }

  const envPhone = normalizePlainValue(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const envToken = normalizeSecretValue(process.env.WHATSAPP_ACCESS_TOKEN);
  return { phoneId: envPhone, token: envToken, source: "env" };
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
  blockedReason?: "test_number_allowed_list" | "outside_24h_window" | "token_expired";
  isTestNumber?: boolean;
  to?: string;
  source?: "runtime" | "env";
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

export interface WhatsAppPhoneProfile {
  phoneId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  status: string | null;
  isTestNumber: boolean;
  fetchedAt: string;
}

let phoneProfileCache:
  | {
      key: string;
      expiry: number;
      value: WhatsAppPhoneProfile;
    }
  | null = null;

async function getWhatsAppPhoneProfile(
  phoneId: string,
  token: string
): Promise<WhatsAppPhoneProfile | null> {
  if (!phoneId || !token) return null;
  const cacheKey = `${phoneId}:${token.slice(-8)}`;
  if (phoneProfileCache && phoneProfileCache.key === cacheKey && phoneProfileCache.expiry > Date.now()) {
    return phoneProfileCache.value;
  }

  const url = `${WHATSAPP_API}/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,status`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("[whatsapp] phone profile fetch error", res.status, raw);
    return null;
  }
  const payload = (await res.json().catch(() => ({}))) as {
    id?: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    status?: string;
  };
  const profile: WhatsAppPhoneProfile = {
    phoneId: payload.id || phoneId,
    displayPhoneNumber: payload.display_phone_number || null,
    verifiedName: payload.verified_name || null,
    qualityRating: payload.quality_rating || null,
    status: payload.status || null,
    isTestNumber: (payload.verified_name || "").toLocaleLowerCase("en-US").includes("test number"),
    fetchedAt: new Date().toISOString(),
  };
  phoneProfileCache = {
    key: cacheKey,
    value: profile,
    expiry: Date.now() + 5 * 60 * 1000,
  };
  return profile;
}

export async function getWhatsAppPhoneProfileSummary(): Promise<WhatsAppPhoneProfile | null> {
  const { phoneId, token } = await resolveWhatsAppCredentials();
  if (!phoneId || !token) return null;
  return getWhatsAppPhoneProfile(phoneId, token);
}

export async function sendWhatsAppMessageDetailed({
  to,
  text,
}: SendMessageParams): Promise<WhatsAppSendResult> {
  const { phoneId, token, source } = await resolveWhatsAppCredentials();
  const normalizedTo = to.replace(/\D/g, "");
  if (!phoneId || !token) {
    console.error("[whatsapp] credentials missing - phoneId:", !!phoneId, "token:", !!token);
    return {
      ok: false,
      status: 0,
      errorMessage: "credentials_missing",
      to: normalizedTo,
      source,
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

  const res = await withRetry(
    async () => {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (r.status >= 500) throw new Error(`WhatsApp API ${r.status}`);
      return r;
    },
    { retries: 3 }
  );

  if (!res.ok) {
    const raw = await res.text();
    let parsedError: { code?: number; error_subcode?: number; message?: string } | undefined;
    let phoneProfile: WhatsAppPhoneProfile | null = null;
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
      phoneProfile = await getWhatsAppPhoneProfile(phoneId, token);
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
    const errorMessage =
      parsedError?.code === 131047
        ? "Alıcı son 24 saatte mesaj atmadı; serbest metin yerine onaylı şablon kullanın (Meta kuralı)."
        : parsedError?.code === 131030
          ? phoneProfile?.isTestNumber
            ? "WhatsApp numarası Meta'da Test Number modunda. Bu alıcı allowed recipients listesinde değil; Meta Business Suite > WhatsApp > API Setup bölümüne numarayı ekleyin veya production numarasına geçin."
            : "Alıcıya WhatsApp gönderimi Meta politikası nedeniyle engellendi. Numara eşleşmesi ve hesap durumunu kontrol edin."
          : parsedError?.code === 190
            ? "WhatsApp erişim token süresi dolmuş; WHATSAPP_ACCESS_TOKEN yenileyin."
            : parsedError?.message || raw;
    return {
      ok: false,
      status: res.status,
      errorCode: parsedError?.code,
      errorSubcode: parsedError?.error_subcode,
      errorMessage,
      blockedReason:
        parsedError?.code === 131030 && phoneProfile?.isTestNumber
          ? "test_number_allowed_list"
          : parsedError?.code === 131047
            ? "outside_24h_window"
            : parsedError?.code === 190
              ? "token_expired"
              : undefined,
      isTestNumber: phoneProfile?.isTestNumber,
      to: normalizedTo,
      source,
    };
  }
  return { ok: true, status: res.status, to: normalizedTo, source };
}

export async function sendWhatsAppMessage({
  to,
  text,
}: SendMessageParams): Promise<boolean> {
  const result = await sendWhatsAppMessageDetailed({ to, text });
  return result.ok;
}

export interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveListSection {
  title?: string;
  rows: InteractiveListRow[];
}

export interface SendWhatsAppInteractiveListParams {
  to: string;
  bodyText: string;
  buttonLabel: string;
  sections: InteractiveListSection[];
}

export async function sendWhatsAppInteractiveList({
  to,
  bodyText,
  buttonLabel,
  sections,
}: SendWhatsAppInteractiveListParams): Promise<WhatsAppSendResult> {
  const { phoneId, token, source } = await resolveWhatsAppCredentials();
  const normalizedTo = to.replace(/\D/g, "");
  if (!phoneId || !token) {
    console.error("[whatsapp] credentials missing - phoneId:", !!phoneId, "token:", !!token);
    return {
      ok: false,
      status: 0,
      errorMessage: "credentials_missing",
      to: normalizedTo,
      source,
    };
  }

  const url = `${WHATSAPP_API}/${phoneId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: sections.map((sec) => ({
          ...(sec.title ? { title: sec.title.slice(0, 24) } : {}),
          rows: sec.rows.map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    },
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
    console.error("[whatsapp] interactive list send error", res.status, "to", normalizedTo, raw);
    return {
      ok: false,
      status: res.status,
      errorMessage: raw,
      to: normalizedTo,
      source,
    };
  }
  return { ok: true, status: res.status, to: normalizedTo, source };
}

export async function sendWhatsAppTemplateMessage({
  to,
  templateName,
  languageCode = "tr",
  bodyParams = [],
}: SendTemplateMessageParams): Promise<boolean> {
  const { phoneId, token } = await resolveWhatsAppCredentials();
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
  const { token } = await resolveWhatsAppCredentials();
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
  const { token } = await resolveWhatsAppCredentials();
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
