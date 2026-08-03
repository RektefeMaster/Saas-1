import { getRuntimeWhatsAppConfig } from "./redis";
import { withRetry } from "./retry";
import { getTenantChannelAccount } from "@/services/tenantChannelAccount.service";

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

const CREDENTIALS_CACHE_TTL_MS = 45_000;

export type WhatsAppCredentialSource = "runtime" | "env" | "tenant";

export interface WhatsAppCredentials {
  phoneId: string;
  token: string;
  source: WhatsAppCredentialSource;
}

/** Anahtar: tenant id, ortak numara için SHARED_CREDENTIALS_KEY. */
const SHARED_CREDENTIALS_KEY = "__shared__";
const credentialsCache = new Map<
  string,
  { expiry: number; value: WhatsAppCredentials }
>();

async function resolveSharedCredentials(): Promise<WhatsAppCredentials> {
  const cached = credentialsCache.get(SHARED_CREDENTIALS_KEY);
  if (cached && cached.expiry > Date.now()) return cached.value;

  const runtime = await getRuntimeWhatsAppConfig();
  const runtimePhone = normalizePlainValue(runtime?.phone_id);
  const runtimeToken = normalizeSecretValue(runtime?.token);

  let value: WhatsAppCredentials;
  if (runtimePhone && runtimeToken) {
    value = { phoneId: runtimePhone, token: runtimeToken, source: "runtime" };
  } else {
    const envPhone = normalizePlainValue(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const envToken = normalizeSecretValue(process.env.WHATSAPP_ACCESS_TOKEN);
    value = { phoneId: envPhone, token: envToken, source: "env" };
  }

  credentialsCache.set(SHARED_CREDENTIALS_KEY, {
    value,
    expiry: Date.now() + CREDENTIALS_CACHE_TTL_MS,
  });
  return value;
}

/**
 * Gönderim için kullanılacak WhatsApp kimlik bilgileri.
 *
 * İşletmenin kendi numarası bağlıysa onunla, değilse ortak numarayla gönderilir.
 * Bugün hiçbir işletmenin kendi kaydı yok; bu yol her zaman ortak numaraya
 * düşer ve davranış değişmez. Kayıt eklendiği an gönderim otomatik olarak
 * o numaraya geçer — çağıran tarafta değişiklik gerekmez.
 */
export async function resolveWhatsAppCredentials(
  tenantId?: string | null
): Promise<WhatsAppCredentials> {
  if (!tenantId) return resolveSharedCredentials();

  const cached = credentialsCache.get(tenantId);
  if (cached && cached.expiry > Date.now()) return cached.value;

  // Defter okunamazsa (tablo yok / geçici hata) ortak numara devreye girer:
  // gönderimin sessizce durmasındansa bugünkü davranışı sürdürmek yeğdir.
  const account = await getTenantChannelAccount(tenantId, "whatsapp").catch(
    () => null
  );
  const tenantPhoneId = normalizePlainValue(account?.externalAccountId);
  const tenantToken = normalizeSecretValue(account?.accessToken || undefined);
  const usable = account?.status === "active" && Boolean(tenantPhoneId && tenantToken);

  if (!usable) {
    // Kayıt VAR ama kullanılamıyorsa bu bir arızadır: işletme kendi
    // numarasını bağladığını sanırken mesajlar ortak numaradan gidiyor.
    // Sessiz kalmamalı — token yenileme/koparma akışının yakalaması gereken yer.
    if (account) {
      console.warn(
        "[whatsapp] tenant kanal hesabı kullanılamıyor, ortak numaraya düşülüyor",
        {
          tenantId,
          status: account.status,
          hasPhoneId: Boolean(tenantPhoneId),
          hasToken: Boolean(tenantToken),
        }
      );
    }
    return resolveSharedCredentials();
  }

  const value: WhatsAppCredentials = {
    phoneId: tenantPhoneId,
    token: tenantToken,
    source: "tenant",
  };
  credentialsCache.set(tenantId, {
    value,
    expiry: Date.now() + CREDENTIALS_CACHE_TTL_MS,
  });
  return value;
}

/** Kimlik bilgisi değiştiğinde önbelleği düşür (bağlama/koparma akışları). */
export function invalidateWhatsAppCredentialsCache(tenantId?: string | null): void {
  if (tenantId) credentialsCache.delete(tenantId);
  else credentialsCache.clear();
}

export interface SendMessageParams {
  to: string;
  text: string;
  /** İşletmenin kendi numarasından gönderim için. Boşsa ortak numara. */
  tenantId?: string | null;
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
  source?: WhatsAppCredentialSource;
  /** Meta Graph API message id when send succeeds */
  messageId?: string;
}

export interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  /** İşletmenin kendi numarasından gönderim için. Boşsa ortak numara. */
  tenantId?: string | null;
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

export async function getWhatsAppPhoneProfileSummary(
  tenantId?: string | null
): Promise<WhatsAppPhoneProfile | null> {
  const { phoneId, token } = await resolveWhatsAppCredentials(tenantId);
  if (!phoneId || !token) return null;
  return getWhatsAppPhoneProfile(phoneId, token);
}

export async function sendWhatsAppMessageDetailed({
  to,
  text,
  tenantId,
}: SendMessageParams): Promise<WhatsAppSendResult> {
  const { phoneId, token, source } = await resolveWhatsAppCredentials(tenantId);
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
            : parsedError?.code === 190 || res.status === 401
              ? "token_expired"
              : undefined,
      isTestNumber: phoneProfile?.isTestNumber,
      to: normalizedTo,
      source,
    };
  }
  let messageId: string | undefined;
  try {
    const parsed = (await res.json()) as {
      messages?: Array<{ id?: string }>;
    };
    messageId = parsed.messages?.[0]?.id;
  } catch {
    messageId = undefined;
  }
  return { ok: true, status: res.status, to: normalizedTo, source, messageId };
}

export async function sendWhatsAppMessage({
  to,
  text,
  tenantId,
}: SendMessageParams): Promise<boolean> {
  const result = await sendWhatsAppMessageDetailed({ to, text, tenantId });
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
  /** İşletmenin kendi numarasından gönderim için. Boşsa ortak numara. */
  tenantId?: string | null;
}

export async function sendWhatsAppInteractiveList({
  to,
  bodyText,
  buttonLabel,
  sections,
  tenantId,
}: SendWhatsAppInteractiveListParams): Promise<WhatsAppSendResult> {
  const { phoneId, token, source } = await resolveWhatsAppCredentials(tenantId);
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

export async function sendWhatsAppTemplateMessageDetailed({
  to,
  templateName,
  languageCode = "tr",
  bodyParams = [],
  tenantId,
}: SendTemplateMessageParams): Promise<WhatsAppSendResult> {
  const { phoneId, token, source } = await resolveWhatsAppCredentials(tenantId);
  const normalizedTo = to.replace(/\D/g, "");
  if (!phoneId || !token) {
    console.error(
      "[whatsapp template] credentials missing - phoneId:",
      !!phoneId,
      "token:",
      !!token
    );
    return {
      ok: false,
      status: 0,
      errorMessage: "credentials_missing",
      to: normalizedTo,
      source,
    };
  }

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
    let parsedError: { code?: number; error_subcode?: number; message?: string } | undefined;
    try {
      parsedError = (JSON.parse(raw) as { error?: typeof parsedError }).error;
    } catch {
      parsedError = undefined;
    }
    const maybeExpired =
      res.status === 401 &&
      (parsedError?.code === 190 ||
        parsedError?.error_subcode === 463 ||
        /session has expired|invalid oauth/i.test(parsedError?.message || ""));
    if (maybeExpired || res.status === 401) {
      console.error(
        "[whatsapp template] access token expired or unauthorized - refresh WHATSAPP_ACCESS_TOKEN"
      );
    }
    console.error("[whatsapp template] send error", res.status, "to", normalizedTo, raw);
    return {
      ok: false,
      status: res.status,
      errorCode: parsedError?.code,
      errorSubcode: parsedError?.error_subcode,
      errorMessage: parsedError?.message || raw,
      blockedReason:
        maybeExpired || res.status === 401 || parsedError?.code === 190
          ? "token_expired"
          : parsedError?.code === 131030
            ? "test_number_allowed_list"
            : parsedError?.code === 131047
              ? "outside_24h_window"
              : undefined,
      to: normalizedTo,
      source,
    };
  }
  return { ok: true, status: res.status, to: normalizedTo, source };
}

export async function sendWhatsAppTemplateMessage(
  params: SendTemplateMessageParams
): Promise<boolean> {
  const result = await sendWhatsAppTemplateMessageDetailed(params);
  return result.ok;
}

async function getWhatsAppMediaUrl(
  mediaId: string,
  tenantId?: string | null
): Promise<{ url: string; mimeType: string } | null> {
  const { token } = await resolveWhatsAppCredentials(tenantId);
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

export async function downloadWhatsAppMedia(
  mediaId: string,
  tenantId?: string | null
): Promise<WhatsAppMediaPayload | null> {
  const { token } = await resolveWhatsAppCredentials(tenantId);
  if (!token) return null;
  const meta = await getWhatsAppMediaUrl(mediaId, tenantId);
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
  const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8MB
  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_MEDIA_BYTES) {
    console.error("[whatsapp media] too large", contentLength);
    return null;
  }
  // Stream with early abort so missing Content-Length cannot inflate memory.
  if (!res.body) {
    console.error("[whatsapp media] empty body");
    return null;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_MEDIA_BYTES) {
      await reader.cancel().catch(() => undefined);
      console.error("[whatsapp media] stream exceeded limit", total);
      return null;
    }
    chunks.push(value);
  }
  return {
    buffer: Buffer.concat(chunks.map((c) => Buffer.from(c))),
    mimeType: meta.mimeType,
  };
}
