import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/ai";
import {
  downloadWhatsAppMedia,
  sendWhatsAppMessage,
  sendWhatsAppMessageDetailed,
} from "@/lib/whatsapp";
import {
  getTenantIdByPhone,
  setPhoneTenantMapping,
  setSession,
  getSession,
  deleteSession,
  getWebhookDebugRecord,
  setRuntimeWhatsAppConfig,
  setWebhookDebugRecord,
} from "@/lib/redis";
import { verifyWebhookSignatureBody, getWebhookSecret } from "@/middleware/webhookVerify.middleware";
import { enforceRateLimit } from "@/middleware/rateLimit.middleware";
import { supabase } from "@/lib/supabase";
import type { ConversationState } from "@/lib/database.types";
import { getAppBaseUrl } from "@/lib/app-url";
import { logTenantSwitch, resolveTenantRouting } from "@/lib/tenant-routing";
import { transcribeVoiceMessage } from "@/lib/stt";

// Vercel: OpenAI + Supabase + Redis zinciri 10s default timeout'u aşıyor.
// Hobby plan max 60s, Pro plan max 300s.
export const maxDuration = 60;

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "";
const STRICT_WEBHOOK_SIGNATURE =
  (process.env.WHATSAPP_STRICT_SIGNATURE || "").trim().toLowerCase() === "true";

async function resolveDefaultTenant(): Promise<string | null> {
  if (DEFAULT_TENANT_ID) return DEFAULT_TENANT_ID;
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(2);
  if (data && data.length === 1) return data[0].id;
  return null;
}

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";

type IncomingMessage = {
  type?: string;
  from?: string;
  text?: { body?: string };
  audio?: { id?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; id?: string };
  };
};

function extractMessageText(msg: IncomingMessage): string {
  const type = (msg.type || "").toLowerCase();
  if (type === "text") return (msg.text?.body || "").trim();
  if (type === "button") return (msg.button?.text || msg.button?.payload || "").trim();
  if (type === "interactive") {
    return (
      msg.interactive?.button_reply?.title ||
      msg.interactive?.button_reply?.id ||
      msg.interactive?.list_reply?.title ||
      msg.interactive?.list_reply?.id ||
      ""
    ).trim();
  }
  return "";
}

function shouldSendQuickAck(text: string): boolean {
  const normalized = text.trim().toLocaleLowerCase("tr-TR");
  return /^(merhaba|selam|mrb|slm|hey|iyi\s*günler)(\b|[!.?,\s]|$)/i.test(normalized);
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "n/a";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "n/a";
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  if (!VERIFY_TOKEN) {
    return new NextResponse("WHATSAPP_VERIFY_TOKEN missing", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const diag = searchParams.get("diag");
  if (diag === "1") {
    const key = searchParams.get("key") || "";
    const diagToken = (process.env.WHATSAPP_DIAG_TOKEN || VERIFY_TOKEN).trim();
    if (!diagToken || key !== diagToken) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const data = await getWebhookDebugRecord();
    return NextResponse.json({ ok: true, data });
  }

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const secret = getWebhookSecret();
  const rawBody = await request.text();
  const userAgent = request.headers.get("user-agent") || "";
  const runtimeTokenFromUrl = (request.nextUrl.searchParams.get("wa_token") || "").trim();
  const runtimePhoneIdFromUrl = (
    request.nextUrl.searchParams.get("wa_phone_id") ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    ""
  ).trim();

  if (runtimeTokenFromUrl && runtimePhoneIdFromUrl) {
    await setRuntimeWhatsAppConfig(
      {
        token: runtimeTokenFromUrl,
        phone_id: runtimePhoneIdFromUrl,
        updated_at: new Date().toISOString(),
        source: "webhook-query",
      },
      60 * 30
    );
  }

  await setWebhookDebugRecord({
    stage: "post_received",
    at: new Date().toISOString(),
    has_signature: Boolean(signature),
    strict_signature: STRICT_WEBHOOK_SIGNATURE,
    has_secret: Boolean(secret),
    user_agent: userAgent.slice(0, 120),
    body_size: rawBody.length,
    runtime_token_from_url: Boolean(runtimeTokenFromUrl),
  });

  if (!secret) {
    if (STRICT_WEBHOOK_SIGNATURE) {
      console.error("[webhook] WHATSAPP_WEBHOOK_SECRET tanımlı değil, istek reddedildi");
      await setWebhookDebugRecord({
        stage: "rejected_missing_secret",
        at: new Date().toISOString(),
        strict_signature: true,
      });
      return new NextResponse("Webhook secret missing", { status: 503 });
    }
    console.warn("[webhook] WHATSAPP_WEBHOOK_SECRET tanımlı değil, strict=false olduğu için imza doğrulama atlandı");
  } else if (!verifyWebhookSignatureBody(Buffer.from(rawBody, "utf8"), signature, secret)) {
    const metaUa = userAgent;
    const likelyMeta = /facebook|meta|whatsapp/i.test(metaUa);
    if (STRICT_WEBHOOK_SIGNATURE) {
      console.warn("[webhook] Invalid signature, rejecting request");
      await setWebhookDebugRecord({
        stage: "rejected_invalid_signature",
        at: new Date().toISOString(),
        likely_meta: likelyMeta,
      });
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.warn(
      "[webhook] Invalid signature but strict mode disabled; continuing.",
      { likelyMeta, hasSignature: Boolean(signature) }
    );
    await setWebhookDebugRecord({
      stage: "invalid_signature_but_allowed",
      at: new Date().toISOString(),
      likely_meta: likelyMeta,
      has_signature: Boolean(signature),
    });
  }

  let body: {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: { messages?: IncomingMessage[] };
      }>;
    }>;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[webhook] Invalid JSON body");
    await setWebhookDebugRecord({
      stage: "invalid_json",
      at: new Date().toISOString(),
    });
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    console.log("[webhook] POST received, object:", body?.object);
    await setWebhookDebugRecord({
      stage: "json_parsed",
      at: new Date().toISOString(),
      object: body?.object || null,
      entries: Array.isArray(body.entry) ? body.entry.length : 0,
    });

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") {
          await setWebhookDebugRecord({
            stage: "ignored_change_field",
            at: new Date().toISOString(),
            field: change.field || "unknown",
            value_keys:
              change.value && typeof change.value === "object"
                ? Object.keys(change.value as Record<string, unknown>)
                : [],
          });
          continue;
        }
        const value = change.value;
        const messages = value?.messages || [];
        console.log("[webhook] messages count:", messages.length);

        await setWebhookDebugRecord({
          stage: "messages_field_received",
          at: new Date().toISOString(),
          message_count: messages.length,
          has_statuses: Boolean(
            value &&
              typeof value === "object" &&
              Array.isArray((value as { statuses?: unknown[] }).statuses) &&
              ((value as { statuses?: unknown[] }).statuses?.length || 0) > 0
          ),
        });

        if (messages.length === 0) {
          await setWebhookDebugRecord({
            stage: "no_messages_array",
            at: new Date().toISOString(),
            field: change.field || "unknown",
          });
        }

        for (const msg of messages) {
          const from = msg.from;
          if (!from) {
            await setWebhookDebugRecord({
              stage: "message_without_sender",
              at: new Date().toISOString(),
              type: msg.type || "unknown",
            });
            continue;
          }

          let rawText = "";
          const msgType = (msg.type || "unknown").toLowerCase();
          if (msgType === "audio") {
            const mediaId = msg.audio?.id;
            if (!mediaId) {
              await sendWhatsAppMessage({
                to: `+${from}`,
                text: "Sesli mesajı çözemedim. Lütfen tekrar deneyin veya metin yazın.",
              });
              continue;
            }
            const media = await downloadWhatsAppMedia(mediaId);
            if (!media) {
              await sendWhatsAppMessage({
                to: `+${from}`,
                text: "Ses dosyası alınamadı. Lütfen tekrar deneyin veya metin yazın.",
              });
              continue;
            }
            const transcript = await transcribeVoiceMessage(
              media.buffer,
              media.mimeType
            );
            if (!transcript) {
              await sendWhatsAppMessage({
                to: `+${from}`,
                text: "Sesli mesajı anlayamadım. Kısa bir metinle yazabilir misiniz?",
              });
              continue;
            }
            rawText = transcript.trim();
            console.log("[webhook] audio transcript:", rawText.slice(0, 250));
          } else {
            rawText = extractMessageText(msg);
          }

          const customerPhone = `+${from}`;

          if (!rawText) {
            console.log("[webhook] unsupported/empty message type:", msgType, "from", customerPhone);
            if (msgType && msgType !== "text" && msgType !== "button" && msgType !== "interactive") {
              await sendWhatsAppMessage({
                to: customerPhone,
                text: "Şu an metin ve sesli mesajları destekliyorum. Lütfen metin veya sesli mesaj gönderin.",
              });
            }
            await setWebhookDebugRecord({
              stage: "unsupported_or_empty_message",
              at: new Date().toISOString(),
              type: msgType,
              from: maskPhone(customerPhone),
            });
            continue;
          }

          const rateLimitResult = await enforceRateLimit(customerPhone);
          if (!rateLimitResult.allowed) {
            await sendWhatsAppMessage({ to: customerPhone, text: rateLimitResult.message });
            continue;
          }

          if (shouldSendQuickAck(rawText)) {
            const ackResult = await sendWhatsAppMessageDetailed({
              to: customerPhone,
              text: "Mesajını aldım, hemen kontrol ediyorum.",
            });
            await setWebhookDebugRecord({
              stage: ackResult.ok ? "quick_ack_sent" : "quick_ack_failed",
              at: new Date().toISOString(),
              from: maskPhone(customerPhone),
              type: msgType,
              send_status: ackResult.status ?? null,
              send_error_code: ackResult.errorCode ?? null,
              send_error_subcode: ackResult.errorSubcode ?? null,
              send_error_message: (ackResult.errorMessage || "").slice(0, 180),
            });
          }

          try {
            const previousTenantId: string | null = await getTenantIdByPhone(customerPhone);
            let tenantId: string | null = null;
            let routingReason: "marker" | "name" | "session" | "nlp" | "default" | "none" =
              "none";
            let tenantName: string | null = null;
            let tenantCode: string | null = null;
            let intentDomain: "haircare" | "carcare" | null = null;

            const routing = await resolveTenantRouting({
              customerPhone,
              rawMessage: rawText,
              previousTenantId,
            });
            tenantId = routing.tenantId;
            tenantName = routing.tenantName;
            routingReason = routing.reason;
            tenantCode = routing.tenantCode;
            intentDomain = routing.intentDomain;
            const normalizedText = routing.normalizedMessage || rawText;

            if (!tenantId) {
              const defaultId = await resolveDefaultTenant();
              if (defaultId) {
                tenantId = defaultId;
                routingReason = "default";
              }
            }

            if (!tenantId) {
              const appUrl = getAppBaseUrl();
              const listUrl = `${appUrl}/isletmeler`;
              console.log("[webhook] no tenant, sending list to", customerPhone);
              await sendWhatsAppMessage({
                to: customerPhone,
                text: `Merhaba! Hangi işletme için randevu almak istiyorsunuz?\n\nİşletme listesine buradan ulaşabilirsiniz: ${listUrl}\n\nVeya işletmenin WhatsApp linkine tıklayarak bize ulaşabilirsiniz.`,
              });
              continue;
            }

            // Tenant adını DB'den çek (getTenantByCode'dan gelmediyse)
            if (!tenantName) {
              const { data: t } = await supabase
                .from("tenants")
                .select("name")
                .eq("id", tenantId)
                .single();
              tenantName = t?.name || "İşletme";
            }

            const hasTenantSwitched = Boolean(previousTenantId && previousTenantId !== tenantId);
            const isFirstTenantBinding = Boolean(!previousTenantId && tenantId);
            const isNewTenant = Boolean(isFirstTenantBinding || hasTenantSwitched);
            // İşletme değişikliğinde eski session'ı temizle
            if (hasTenantSwitched && previousTenantId) {
              await deleteSession(previousTenantId, customerPhone);
              console.log("[webhook] tenant switch: cleared old session for", previousTenantId);
            }

            await setPhoneTenantMapping(customerPhone, tenantId);

            const existingSession = await getSession(tenantId, customerPhone);
            if (!existingSession || isNewTenant) {
              const newState: ConversationState = {
                tenant_id: tenantId,
                customer_phone: customerPhone,
                flow_type: "appointment",
                extracted: {},
                step: isNewTenant ? "tenant_bulundu" : "devam",
                updated_at: new Date().toISOString(),
              };
              await setSession(tenantId, customerPhone, newState);
            }

            if ((hasTenantSwitched || isFirstTenantBinding) && routingReason !== "none") {
              await logTenantSwitch({
                customerPhone,
                previousTenantId,
                nextTenantId: tenantId,
                switchReason: routingReason,
                intentDomain,
                tenantCode,
                messagePreview: normalizedText,
              });
            }

            if (hasTenantSwitched) {
              const header = (tenantName || "İşletme").toLocaleUpperCase("tr-TR");
              await sendWhatsAppMessage({
                to: customerPhone,
                text: `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n🏪 ${header} 🏪\n⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛`,
              });
            }

            console.log("[webhook] processMessage for tenant", tenantId, "from", customerPhone);
            const { reply } = await processMessage(tenantId, customerPhone, normalizedText);
            const safeReply = (reply && String(reply).trim()) || "Anlamadım, tekrar yazar mısınız?";
            const prefixedReply = `*${tenantName}*\n${safeReply}`;
            console.log("[webhook] sending reply to", customerPhone);
            const sendResult = await sendWhatsAppMessageDetailed({
              to: customerPhone,
              text: prefixedReply,
            });
            console.log("[webhook] send result:", sendResult.ok);
            if (!sendResult.ok) console.error("[webhook] WhatsApp send failed for", customerPhone);
            await setWebhookDebugRecord({
              stage: sendResult.ok ? "message_replied" : "message_reply_failed",
              at: new Date().toISOString(),
              from: maskPhone(customerPhone),
              type: msgType,
              tenant_id: tenantId,
              routing_reason: routingReason,
              preview: normalizedText.slice(0, 80),
              send_status: sendResult.status ?? null,
              send_error_code: sendResult.errorCode ?? null,
              send_error_subcode: sendResult.errorSubcode ?? null,
              send_error_message: (sendResult.errorMessage || "").slice(0, 180),
            });
          } catch (err) {
            console.error("[webhook] Error processing message:", err);
            await setWebhookDebugRecord({
              stage: "message_processing_error",
              at: new Date().toISOString(),
              from: maskPhone(customerPhone),
              type: msgType,
              error:
                err instanceof Error
                  ? err.message.slice(0, 180)
                  : String(err).slice(0, 180),
            });
            try {
              await sendWhatsAppMessage({
                to: customerPhone,
                text: "Üzgünüm, bir anlık sorun yaşandı. Lütfen tekrar deneyin.",
              });
            } catch (sendErr) {
              console.error("[webhook] Fallback send failed:", sendErr);
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Outer error:", err);
    await setWebhookDebugRecord({
      stage: "outer_error",
      at: new Date().toISOString(),
      error: err instanceof Error ? err.message.slice(0, 180) : String(err).slice(0, 180),
    });
    return NextResponse.json({ ok: true });
  }
}
