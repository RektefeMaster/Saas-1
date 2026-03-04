import { processMessage } from "@/lib/bot-v1/conversation";
import { supabase } from "@/lib/supabase";
import {
  downloadWhatsAppMedia,
  sendWhatsAppMessage,
  sendWhatsAppMessageDetailed,
  sendWhatsAppTemplateMessage,
} from "@/lib/whatsapp";
import {
  acquireBotProcessingLock,
  claimWebhookMessageId,
  deleteSession,
  getSession,
  getTenantIdByPhone,
  releaseBotProcessingLock,
  setPhoneTenantMapping,
  setSession,
  storeTemporaryEncryptedMedia,
} from "@/lib/redis";
import { enforceRateLimit } from "@/middleware/rateLimit.middleware";
import { logTenantSwitch, resolveTenantRouting } from "@/lib/tenant-routing";
import { transcribeVoiceMessage } from "@/lib/stt";
import { stripZeroWidthMarkers } from "@/lib/zero-width";
import type { ConversationState } from "@/lib/database.types";
import { logBotMessageAudit } from "@/services/botAudit.service";
import type { IncomingMessage, IncomingWebhookValue, WhatsAppInboundEventData } from "./types";
import { extractSafeEntities, maskSensitivePII } from "./pii";

const ENABLE_QUICK_ACK =
  (process.env.WHATSAPP_QUICK_ACK || "").trim().toLowerCase() === "true";
const WHATSAPP_RESUME_TEMPLATE_NAME =
  (process.env.WHATSAPP_RESUME_TEMPLATE_NAME || "").trim() || "continue_chat_tr";
const MODEL_PRICING_VERSION = (process.env.MODEL_PRICING_VERSION || "v1").trim();
const MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

function digitsOnly(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "n/a";
  const digits = digitsOnly(phone);
  if (!digits) return "n/a";
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function normalizeIncomingText(raw: string): string {
  const cleaned = stripZeroWidthMarkers(raw || "").replace(/[\uFEFF]/g, "");
  return cleaned.replace(/\s+/g, " ").trim();
}

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

function isLikelyOutboundEcho(
  message: IncomingMessage,
  value: IncomingWebhookValue
): boolean {
  const fromDigits = digitsOnly(message.from);
  if (!fromDigits) return false;

  const displayDigits = digitsOnly(value?.metadata?.display_phone_number);
  const phoneIdDigits = digitsOnly(value?.metadata?.phone_number_id);
  if (fromDigits === displayDigits || fromDigits === phoneIdDigits) return true;

  const envBusinessDigits = digitsOnly(
    process.env.WHATSAPP_API_PHONE || process.env.WHATSAPP_PHONE_NUMBER
  );
  if (envBusinessDigits && fromDigits === envBusinessDigits) return true;

  const contacts = value?.contacts || [];
  if (contacts.length > 0) {
    const matched = contacts.some((contact) => digitsOnly(contact.wa_id) === fromDigits);
    if (!matched) return true;
  }

  return false;
}

function shouldSendQuickAck(text: string): boolean {
  if (!ENABLE_QUICK_ACK) return false;
  const normalized = text.trim().toLocaleLowerCase("tr-TR");
  return /^(merhaba|selam|mrb|slm|hey|iyi\s*günler)(\b|[!.?,\s]|$)/i.test(normalized);
}

function isWindowOpen(receivedAt: string): boolean {
  const parsed = new Date(receivedAt).getTime();
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed < MESSAGE_WINDOW_MS;
}

function estimateCostUsd(model: string | null | undefined, totalTokens: number): number {
  if (!model || totalTokens <= 0) return 0;
  // Güvenli yaklaşık maliyet (model fiyat tablosu versiyonlanabilir).
  if (model.includes("4o-mini")) return (totalTokens / 1_000_000) * 0.6;
  if (model.includes("4o")) return (totalTokens / 1_000_000) * 8;
  return (totalTokens / 1_000_000) * 2;
}

async function resolveDefaultTenant(): Promise<string | null> {
  const configured = (process.env.DEFAULT_TENANT_ID || "").trim();
  if (configured) return configured;
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(2);
  if (data && data.length === 1) return data[0].id;
  return null;
}

async function sendWindowRecoveryTemplate(to: string): Promise<boolean> {
  return sendWhatsAppTemplateMessage({
    to,
    templateName: WHATSAPP_RESUME_TEMPLATE_NAME,
    languageCode: "tr",
  });
}

export async function processWhatsAppInboundEvent(
  event: WhatsAppInboundEventData,
  meta?: { lockWaitMs?: number; queueLagMs?: number; attempt?: number }
): Promise<void> {
  const startedAt = Date.now();
  const traceId = event.trace_id;
  const messageId = event.message_id;
  const messageType = (event.message_type || event.message?.type || "unknown").toLowerCase();
  const customerPhone = event.phone;
  const lockKey = `${event.tenant_hint || "none"}:${digitsOnly(customerPhone)}`;
  const lockOwner = `${traceId}:${messageId}:${Date.now()}`;
  const lockAcquired = await acquireBotProcessingLock(lockKey, lockOwner, 20);
  if (!lockAcquired) {
    throw new Error("processing_lock_not_acquired");
  }

  try {
    const isFirstSeen = await claimWebhookMessageId(messageId);
    if (!isFirstSeen) {
      await logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "duplicate_message_ignored",
        messageId,
        lockWaitMs: meta?.lockWaitMs ?? null,
        queueLagMs: meta?.queueLagMs ?? null,
      });
      return;
    }

    if (isLikelyOutboundEcho(event.message, event.value)) {
      await logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "outbound_echo_ignored",
        messageId,
      });
      return;
    }

    let rawText = "";
    if (messageType === "audio") {
      const mediaId = event.message.audio?.id;
      if (!mediaId) {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Sesli mesajı çözemedim. Lütfen tekrar deneyin veya metin yazın.",
        });
        return;
      }
      const media = await downloadWhatsAppMedia(mediaId);
      if (!media) {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Ses dosyası alınamadı. Lütfen tekrar deneyin veya metin yazın.",
        });
        return;
      }
      await storeTemporaryEncryptedMedia(
        {
          traceId,
          messageId,
          mimeType: media.mimeType,
          buffer: media.buffer,
        },
        60 * 60 * 48
      );
      const transcript = await transcribeVoiceMessage(media.buffer, media.mimeType);
      if (!transcript) {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Sesli mesajı anlayamadım. Kısa bir metinle yazabilir misiniz?",
        });
        return;
      }
      rawText = transcript;
    } else if (messageType === "image") {
      await sendWhatsAppMessage({
        to: customerPhone,
        text: "Görsel analiz özelliği şu an sınırlı. Lütfen ne istediğinizi kısa bir metinle yazın.",
      });
      await logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "image_fallback_requested_text",
        messageId,
      });
      return;
    } else {
      rawText = extractMessageText(event.message);
    }
    rawText = normalizeIncomingText(rawText);
    if (!rawText) {
      if (messageType !== "text" && messageType !== "button" && messageType !== "interactive") {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Şu an metin ve sesli mesajları destekliyorum. Lütfen metin veya sesli mesaj gönderin.",
        });
      }
      await logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "empty_or_unsupported_message",
        messageId,
      });
      return;
    }

    const rateLimitResult = await enforceRateLimit(customerPhone);
    if (!rateLimitResult.allowed) {
      await sendWhatsAppMessage({
        to: customerPhone,
        text: rateLimitResult.message,
      });
      await logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "system",
        stage: "rate_limited",
        messageId,
      });
      return;
    }

    if (shouldSendQuickAck(rawText)) {
      await sendWhatsAppMessageDetailed({
        to: customerPhone,
        text: "Mesajını aldım, hemen kontrol ediyorum.",
      });
    }

    const previousTenantId = await getTenantIdByPhone(customerPhone);
    let tenantId: string | null = null;
    let routingReason: "marker" | "name" | "session" | "customer_history" | "nlp" | "default" | "none" =
      "none";
    let tenantCode: string | null = null;
    let intentDomain: "haircare" | "carcare" | null = null;

    const extractedEntities = extractSafeEntities(rawText);
    const maskedMessage = maskSensitivePII(rawText);

    const routing = await resolveTenantRouting({
      customerPhone,
      rawMessage: maskedMessage,
      previousTenantId,
    });
    tenantId = routing.tenantId;
    routingReason = routing.reason;
    tenantCode = routing.tenantCode;
    intentDomain = routing.intentDomain;
    const normalizedText = normalizeIncomingText(routing.normalizedMessage || maskedMessage);

    if (!tenantId) {
      const defaultTenantId = await resolveDefaultTenant();
      if (defaultTenantId) {
        tenantId = defaultTenantId;
        routingReason = "default";
      }
    }

    if (!tenantId) {
      await sendWhatsAppMessage({
        to: customerPhone,
        text:
          "Mesajınızı aldım. Hangi işletme için randevu almak istediğinizi anlayamadım. Lütfen işletme adını yazın (örn: Kuaför Ahmet).",
      });
      await logBotMessageAudit({
        traceId,
        tenantId: null,
        customerPhone,
        direction: "outbound",
        stage: "tenant_not_found",
        messageId,
      });
      return;
    }

    const hasTenantSwitched = Boolean(previousTenantId && previousTenantId !== tenantId);
    const isFirstTenantBinding = Boolean(!previousTenantId && tenantId);
    if (hasTenantSwitched && previousTenantId) {
      await deleteSession(previousTenantId, customerPhone);
    }

    await setPhoneTenantMapping(customerPhone, tenantId);
    const existingSession = await getSession(tenantId, customerPhone);
    const nextExtracted = {
      ...(existingSession?.extracted || {}),
      ...(extractedEntities.customer_name
        ? { customer_name: extractedEntities.customer_name }
        : {}),
    } as Record<string, unknown>;
    if (!existingSession || isFirstTenantBinding || hasTenantSwitched) {
      const newState: ConversationState = {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        flow_type: "appointment",
        extracted: nextExtracted,
        step: "devam",
        updated_at: new Date().toISOString(),
        window_status: "OPEN",
        last_customer_message_at: event.received_at,
        retry_count: 0,
        timezone: "Europe/Istanbul",
      };
      await setSession(tenantId, customerPhone, newState);
    } else if (nextExtracted.customer_name) {
      await setSession(tenantId, customerPhone, {
        ...existingSession,
        extracted: nextExtracted,
        last_customer_message_at: event.received_at,
        window_status: "OPEN",
        timezone: existingSession.timezone || "Europe/Istanbul",
        updated_at: new Date().toISOString(),
      });
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

    if (!normalizedText) {
      await sendWhatsAppMessage({
        to: customerPhone,
        text: "Mesajın boş görünüyor. Kısa bir metinle tekrar yazabilir misin?",
      });
      return;
    }

    const aiStart = Date.now();
    const { reply, metrics } = await processMessage(tenantId, customerPhone, normalizedText);
    const llmLatencyMs = Date.now() - aiStart;
    const safeReply = (reply && String(reply).trim()) || "Anlamadım, tekrar yazar mısınız?";
    const windowOpen = isWindowOpen(event.received_at);
    let sendStage = "message_replied";
    let sendErrorCode: string | null = null;

    if (!windowOpen) {
      const templateSent = await sendWindowRecoveryTemplate(customerPhone);
      sendStage = templateSent ? "template_recovery_sent" : "template_recovery_failed";
      if (!templateSent) sendErrorCode = "window_closed_template_failed";
    } else {
      const sendResult = await sendWhatsAppMessageDetailed({
        to: customerPhone,
        text: safeReply,
      });
      if (!sendResult.ok) {
        sendErrorCode = sendResult.errorCode ? String(sendResult.errorCode) : null;
        if (sendResult.blockedReason === "outside_24h_window" || sendResult.errorCode === 131047) {
          const templateSent = await sendWindowRecoveryTemplate(customerPhone);
          sendStage = templateSent ? "template_recovery_sent" : "template_recovery_failed";
          if (!templateSent) sendErrorCode = "window_closed_template_failed";
        } else {
          sendStage = "message_reply_failed";
        }
      }
    }

    await logBotMessageAudit({
      traceId,
      tenantId,
      customerPhone,
      direction: "outbound",
      stage: sendStage,
      messageId,
      policyReason: routingReason,
      fsmStateBefore: existingSession?.step || "INIT",
      fsmStateAfter: "COMPLETED",
      replyPreview: safeReply.slice(0, 500),
      latencyMs: Date.now() - startedAt,
      llmLatencyMs,
      dbLatencyMs: null,
      lockWaitMs: meta?.lockWaitMs ?? null,
      queueLagMs: meta?.queueLagMs ?? null,
      promptTokens: metrics?.prompt_tokens ?? null,
      completionTokens: metrics?.completion_tokens ?? null,
      totalTokens: metrics?.total_tokens ?? null,
      costUsd: estimateCostUsd(metrics?.model, metrics?.total_tokens || 0),
      model: metrics?.model ?? null,
      modelPricingVersion: MODEL_PRICING_VERSION,
      errorCode: sendErrorCode,
    });
  } finally {
    await releaseBotProcessingLock(lockKey, lockOwner);
  }
}
