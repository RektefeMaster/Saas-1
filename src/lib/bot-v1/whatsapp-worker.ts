import { processMessage } from "@/lib/bot-v1/conversation";
import { supabase } from "@/lib/supabase";
import {
  downloadWhatsAppMedia,
  sendWhatsAppInteractiveList,
  sendWhatsAppMessage,
  sendWhatsAppMessageDetailed,
  sendWhatsAppTemplateMessageDetailed,
  type WhatsAppSendResult,
} from "@/lib/whatsapp";
import { resolveTenantByChannelAccount } from "@/services/tenantChannelAccount.service";
import { isMetaSampleWhatsAppInbound } from "@/lib/bot-v1/meta-sample-webhook";
import {
  acquireBotProcessingLock,
  claimWebhookMessageId,
  deleteSession,
  getGlobalKillSwitch,
  getSession,
  getTenantIdByPhone,
  markWebhookMessageProcessed,
  releaseBotProcessingLock,
  setPendingIntent,
  setPhoneTenantMapping,
  setSession,
  storeTemporaryEncryptedMedia,
  takePendingIntent,
} from "@/lib/redis";
import { enforceRateLimit } from "@/middleware/rateLimit.middleware";
import {
  logTenantSwitch,
  resolveTenantRouting,
  type RoutingReason,
  type TenantCandidate,
} from "@/lib/tenant-routing";
import { sanitizeIncomingCustomerMessage } from "@/lib/tenant-code";
import { transcribeVoiceMessage } from "@/lib/stt";
import { stripZeroWidthMarkers } from "@/lib/zero-width";
import { isLiveHumanTakeoverReason } from "@/lib/human-takeover";
import type { ConversationState } from "@/lib/database.types";
import { logBotMessageAudit } from "@/services/botAudit.service";
import { logConversationMessage } from "@/services/conversationMessages.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import {
  ensureConversation,
  touchConversationForInbound,
  insertInboundMessageIdempotent,
  getConversationAutomationMode,
  shouldSkipAiProcessing,
  recordOutboundQueued,
  markOutboundSent,
  markOutboundFailed,
} from "@/services/conversation.service";
import { emitConversationEvent } from "@/services/conversationObservability.service";
import { cancelFollowUpsForCustomer } from "@/services/safeFollowUp.service";
import type { IncomingMessage, IncomingWebhookValue, WhatsAppInboundEventData } from "./types";
import { extractSafeEntities, maskSensitivePII } from "./pii";
import {
  getLeadMemory,
  refreshLeadMemoryFromConversation,
  shouldRefreshLeadMemory,
} from "@/services/leadMemory.service";
import { openai } from "@/lib/bot-v1/conversation/client";
import {
  describeImage,
  buildImageMessageText,
  getVisionModel,
  isImageUnderstandingEnabled,
} from "@/lib/vision";
import { MODEL_SIMPLE } from "@/lib/bot-v1/conversation/constants";

const ENABLE_QUICK_ACK =
  (process.env.WHATSAPP_QUICK_ACK || "").trim().toLowerCase() === "true";
const WHATSAPP_RESUME_TEMPLATE_NAME =
  (process.env.WHATSAPP_RESUME_TEMPLATE_NAME || "").trim() || "continue_chat_tr";
const WHATSAPP_KILL_SWITCH_MESSAGE =
  (process.env.WHATSAPP_KILL_SWITCH_MESSAGE || "").trim() ||
  "Sistemimiz su anda bakim modunda. Kisa sure sonra tekrar deneyebilir misiniz?";
const MODEL_PRICING_VERSION = (process.env.MODEL_PRICING_VERSION || "v1").trim();

function digitsOnly(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function normalizeIncomingText(raw: string): string {
  const cleaned = stripZeroWidthMarkers(raw || "").replace(/[\uFEFF]/g, "");
  return cleaned.replace(/\s+/g, " ").trim();
}

/**
 * "Hangi işletme?" listesindeki satır kimliği. Müşteri listeden seçtiğinde
 * mesaj metni işletme ADI olur — ki o zaten belirsizdir. Seçimin kendisi bu
 * önekle satır kimliğinde taşınır.
 */
const TENANT_PICK_PREFIX = "tenant_pick:";

function extractTenantPickCode(msg: IncomingMessage): string | null {
  const id = (
    msg.interactive?.list_reply?.id ||
    msg.interactive?.button_reply?.id ||
    ""
  ).trim();
  if (!id.startsWith(TENANT_PICK_PREFIX)) return null;
  return id.slice(TENANT_PICK_PREFIX.length).trim() || null;
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

/**
 * Yaklaşık maliyet. Aktif model için fiyatı MODEL_PRICE_USD_PER_MTOK ile ver;
 * tanımlı değilse tablodaki eşleşme, o da yoksa muhafazakâr bir varsayılan.
 */
function estimateCostUsd(model: string | null | undefined, totalTokens: number): number {
  if (!model || totalTokens <= 0) return 0;
  const configured = Number(process.env.MODEL_PRICE_USD_PER_MTOK);
  if (Number.isFinite(configured) && configured > 0) {
    return (totalTokens / 1_000_000) * configured;
  }
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

async function sendWindowRecoveryTemplate(
  to: string,
  tenantId: string | null
): Promise<WhatsAppSendResult> {
  return sendWhatsAppTemplateMessageDetailed({
    to,
    templateName: WHATSAPP_RESUME_TEMPLATE_NAME,
    languageCode: "tr",
    tenantId,
  });
}

/**
 * İsim eşleşmesi birden fazla işletmeye yakın puan verdiğinde müşteriye sorar.
 * Satır kimliği tenant kodunu taşır; böylece cevap tahmine değil seçime dayanır.
 */
async function askWhichTenant(input: {
  customerPhone: string;
  candidates: TenantCandidate[];
  tenantId: string | null;
}): Promise<string> {
  const rows = input.candidates
    .filter((c) => c.tenantCode)
    .map((c) => ({
      id: `${TENANT_PICK_PREFIX}${c.tenantCode}`,
      title: c.name,
      // Adlar birebir aynı olabilir ve WhatsApp başlığı 24 karaktere kırpar;
      // işletmenin telefonu iki satırı ayırt edilebilir kılan tek bilgidir.
      ...(c.contactPhone ? { description: c.contactPhone } : {}),
    }));

  const bodyText =
    "Aynı isimde birden fazla işletme var. Hangisini kastettiğinizi seçer misiniz?";

  // Tenant kodu olmayan kayıt seçilemez; listede en az iki seçenek şart.
  if (rows.length < 2) {
    const fallback =
      "Birden fazla işletme eşleşti. İşletmenin tam adını yazar mısınız?";
    await sendWhatsAppMessage({
      to: input.customerPhone,
      text: fallback,
      tenantId: input.tenantId,
    });
    return fallback;
  }

  const result = await sendWhatsAppInteractiveList({
    to: input.customerPhone,
    bodyText,
    buttonLabel: "İşletme seç",
    sections: [{ rows }],
    tenantId: input.tenantId,
  });

  if (!result.ok) {
    // Etkileşimli liste gönderilemezse düz metne düş: müşteri cevapsız kalmasın.
    const numbered = input.candidates
      .map((c, i) => `${i + 1}. ${c.name}${c.contactPhone ? ` (${c.contactPhone})` : ""}`)
      .join("\n");
    const fallback = `${bodyText}\n${numbered}\n\nİşletmenin tam adını yazabilirsiniz.`;
    await sendWhatsAppMessage({
      to: input.customerPhone,
      text: fallback,
      tenantId: input.tenantId,
    });
    return fallback;
  }

  return bodyText;
}

function isPermanentWhatsAppSendFailure(result: WhatsAppSendResult | null): boolean {
  if (!result) return false;
  if (result.blockedReason === "token_expired") return true;
  if (result.blockedReason === "test_number_allowed_list") return true;
  if (result.status === 401) return true;
  if (result.errorCode === 190 || result.errorCode === 131030) return true;
  if (result.errorMessage === "credentials_missing") return true;
  return false;
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
  const lockAcquired = await acquireBotProcessingLock(lockKey, lockOwner, 90);
  if (!lockAcquired) {
    throw new Error("processing_lock_not_acquired");
  }

  try {
    const logInbound = (input: {
      tenantId?: string | null;
      text?: string | null;
      stage: string;
      messageType?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      void logConversationMessage({
        traceId,
        tenantId: input.tenantId ?? event.tenant_hint,
        customerPhone,
        direction: "inbound",
        messageText: input.text || null,
        messageType: input.messageType || messageType,
        stage: input.stage,
        messageId,
        metadata: input.metadata || {},
        createdAt: event.received_at,
      }).catch((err) =>
        console.error("[whatsapp-worker] inbound log failed", err)
      );
    };

    const logOutbound = (input: {
      tenantId?: string | null;
      text?: string | null;
      stage: string;
      messageType?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      void logConversationMessage({
        traceId,
        tenantId: input.tenantId ?? event.tenant_hint,
        customerPhone,
        direction: "outbound",
        messageText: input.text || null,
        messageType: input.messageType || "text",
        stage: input.stage,
        messageId,
        metadata: input.metadata || {},
      }).catch((err) =>
        console.error("[whatsapp-worker] outbound log failed", err)
      );
    };

    const audit = (input: Parameters<typeof logBotMessageAudit>[0]) => {
      void logBotMessageAudit(input).catch((err) =>
        console.error("[whatsapp-worker] audit log failed", err)
      );
    };

    if (
      isMetaSampleWhatsAppInbound({
        phone: customerPhone,
        messageId,
        phoneNumberId: event.value?.metadata?.phone_number_id,
        displayPhoneNumber: event.value?.metadata?.display_phone_number,
      })
    ) {
      // Meta Console "Test" payload — not a real customer. Ack + mark done; never send.
      audit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "meta_sample_webhook_ignored",
        messageId,
        lockWaitMs: meta?.lockWaitMs ?? null,
        queueLagMs: meta?.queueLagMs ?? null,
      });
      await markWebhookMessageProcessed(messageId);
      return;
    }

    // Single claim site for WA idempotency (do not also claim in the webhook ingress).
    // ownerToken=trace_id: Inngest retries keep the same event payload, so the same
    // run can re-acquire its own processing claim instead of burning retries.
    const claim = await claimWebhookMessageId(messageId, { ownerToken: traceId });
    if (claim === "already_done") {
      audit({
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
    if (claim === "in_progress") {
      // Another delivery/run owns this message (Meta redelivery with a new trace_id).
      // Soft-succeed: throwing RetryAfterError produced 500 storms and burned the
      // foreign run's retries while the owner was still working or left a claim.
      audit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "message_claim_in_progress",
        messageId,
        lockWaitMs: meta?.lockWaitMs ?? null,
        queueLagMs: meta?.queueLagMs ?? null,
      });
      return;
    }
    if (claim === "unavailable") {
      audit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "message_claim_unavailable",
        messageId,
        lockWaitMs: meta?.lockWaitMs ?? null,
        queueLagMs: meta?.queueLagMs ?? null,
      });
      throw new Error("webhook_message_claim_unavailable");
    }

    try {
      await processClaimedWhatsAppInboundEvent(event, {
        startedAt,
        traceId,
        messageId,
        messageType,
        customerPhone,
        lockWaitMs: meta?.lockWaitMs,
        queueLagMs: meta?.queueLagMs,
        logInbound,
        logOutbound,
      });
      await markWebhookMessageProcessed(messageId);
    } catch (err) {
      // Leave claim in processing:<ts>:<owner>. Same-owner Inngest retries can
      // re-acquire immediately; foreign deliveries wait for stale reclaim (~3m).
      // Do not release immediately (side effects may already have committed).
      console.error("[whatsapp-worker] claimed inbound failed; claim retained for owner/stale reclaim", {
        messageId,
        traceId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  } finally {
    await releaseBotProcessingLock(lockKey, lockOwner);
  }
}

async function processClaimedWhatsAppInboundEvent(
  event: WhatsAppInboundEventData,
  ctx: {
    startedAt: number;
    traceId: string;
    messageId: string;
    messageType: string;
    customerPhone: string;
    lockWaitMs?: number;
    queueLagMs?: number;
    logInbound: (input: {
      tenantId?: string | null;
      text?: string | null;
      stage: string;
      messageType?: string | null;
      metadata?: Record<string, unknown>;
    }) => void;
    logOutbound: (input: {
      tenantId?: string | null;
      text?: string | null;
      stage: string;
      messageType?: string | null;
      metadata?: Record<string, unknown>;
    }) => void;
  }
): Promise<void> {
  const {
    startedAt,
    traceId,
    messageId,
    messageType,
    customerPhone,
    logInbound,
    logOutbound,
  } = ctx;

  if (isLikelyOutboundEcho(event.message, event.value)) {
      void logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "outbound_echo_ignored",
        messageId,
      }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
      return;
    }

    // Mesajın ULAŞTIĞI numaradan tenant çözümü — tahmin değil, kesin bilgi.
    // Ortak numarada kayıt yoktur (null döner) ve içerikten yönlendirmeye devam
    // edilir. İşletme kendi numarasını bağladığında bu yol devreye girer ve
    // isim/oturum tahminleri hiç çalışmaz.
    const boundAccount = await resolveTenantByChannelAccount(
      "whatsapp",
      event.value?.metadata?.phone_number_id
    ).catch(() => null);
    const boundTenantId = boundAccount?.tenantId ?? null;
    // Gönderim ve medya indirme bu kimlikle yapılır; yönlendirme sonrası
    // çözülen tenant ile güncellenir.
    let channelTenantId: string | null = boundTenantId;

    const killSwitch = await getGlobalKillSwitch();
    if (killSwitch.enabled) {
      await sendWhatsAppMessage({
        to: customerPhone,
        text: WHATSAPP_KILL_SWITCH_MESSAGE,
        tenantId: channelTenantId,
      });
      await logOutbound({
        text: WHATSAPP_KILL_SWITCH_MESSAGE,
        stage: "global_kill_switch_blocked",
        messageType: "text",
        metadata: { source: killSwitch.source || "unknown" },
      });
      void logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "system",
        stage: "global_kill_switch_blocked",
        policyReason: "kill_switch",
        messageId,
      }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
      return;
    }

    // Rate limit medya indirme/AI çağrılarından ÖNCE. Eskiden ses transkripsiyonu
    // (ve şimdi görsel analizi) limit kontrolünden ÖNCE çalışıyordu; tek numaradan
    // sınırsız pahalı çağrı tetiklenebiliyordu.
    const rateLimitResult = await enforceRateLimit(customerPhone);
    if (!rateLimitResult.allowed) {
      await sendWhatsAppMessage({
        to: customerPhone,
        text: rateLimitResult.message,
        tenantId: channelTenantId,
      });
      // Rate limit artık medya işlemeden önce çalıştığı için mesaj metnini
      // henüz bilmiyoruz; yine de temasın kaydı düşsün (panelde boşluk olmasın).
      await logInbound({
        text: null,
        stage: "rate_limited_inbound",
        messageType,
      });
      await logOutbound({
        text: rateLimitResult.message,
        stage: "rate_limited",
      });
      void logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "system",
        stage: "rate_limited",
        messageId,
      }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
      return;
    }

    let rawText = "";
    if (messageType === "audio") {
      const mediaId = event.message.audio?.id;
      if (!mediaId) {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Sesli mesajı çözemedim. Lütfen tekrar deneyin veya metin yazın.",
          tenantId: channelTenantId,
        });
        await logInbound({ text: null, stage: "audio_missing_media_id", messageType: "audio" });
        await logOutbound({
          text: "Sesli mesajı çözemedim. Lütfen tekrar deneyin veya metin yazın.",
          stage: "audio_missing_media_id_reply",
        });
        return;
      }
      const media = await downloadWhatsAppMedia(mediaId, channelTenantId);
      if (!media) {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Ses dosyası alınamadı. Lütfen tekrar deneyin veya metin yazın.",
          tenantId: channelTenantId,
        });
        await logInbound({ text: null, stage: "audio_media_download_failed", messageType: "audio" });
        await logOutbound({
          text: "Ses dosyası alınamadı. Lütfen tekrar deneyin veya metin yazın.",
          stage: "audio_media_download_failed_reply",
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
          tenantId: channelTenantId,
        });
        await logInbound({ text: null, stage: "audio_transcribe_failed", messageType: "audio" });
        await logOutbound({
          text: "Sesli mesajı anlayamadım. Kısa bir metinle yazabilir misiniz?",
          stage: "audio_transcribe_failed_reply",
        });
        return;
      }
      rawText = transcript;
    } else if (messageType === "image") {
      const askForText = async (stage: string) => {
        const text =
          "Görseli şu an okuyamadım. Ne istediğini kısa bir metinle yazar mısın?";
        await sendWhatsAppMessage({ to: customerPhone, text, tenantId: channelTenantId });
        await logInbound({ text: null, stage, messageType: "image" });
        await logOutbound({ text, stage: `${stage}_reply` });
        void logBotMessageAudit({
          traceId,
          tenantId: event.tenant_hint,
          customerPhone,
          direction: "inbound",
          stage,
          messageId,
        }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
      };

      const caption = (event.message.image?.caption || "").trim();

      if (!isImageUnderstandingEnabled()) {
        await askForText("image_understanding_disabled");
        return;
      }
      const imageMediaId = event.message.image?.id;
      if (!imageMediaId) {
        await askForText("image_missing_media_id");
        return;
      }
      const imageMedia = await downloadWhatsAppMedia(imageMediaId, channelTenantId);
      if (!imageMedia) {
        await askForText("image_media_download_failed");
        return;
      }
      // Ses mesajlarıyla aynı retention politikası: şifreli, süreli saklama.
      await storeTemporaryEncryptedMedia(
        {
          traceId,
          messageId,
          mimeType: imageMedia.mimeType,
          buffer: imageMedia.buffer,
        },
        60 * 60 * 48
      );
      const vision = await describeImage({
        buffer: imageMedia.buffer,
        mimeType: imageMedia.mimeType,
        client: openai,
        model: getVisionModel(MODEL_SIMPLE),
        caption,
      });
      if (!vision.ok || !vision.description) {
        await askForText(`image_vision_${vision.reason || "failed"}`);
        return;
      }
      // DİKKAT: görsel içeriği VERİDİR. buildImageMessageText onu açıkça
      // "talimat değildir" etiketiyle sarar; bot akışı normal metin gibi işler.
      rawText = buildImageMessageText(vision.description, caption);
      await logInbound({
        text: rawText,
        stage: "image_described",
        messageType: "image",
        metadata: { has_caption: Boolean(caption) },
      });
    } else {
      rawText = extractMessageText(event.message);
    }
    rawText = normalizeIncomingText(rawText);
    if (!rawText) {
      if (messageType !== "text" && messageType !== "button" && messageType !== "interactive") {
        await sendWhatsAppMessage({
          to: customerPhone,
          text: "Şu an metin ve sesli mesajları destekliyorum. Lütfen metin veya sesli mesaj gönderin.",
          tenantId: channelTenantId,
        });
        await logOutbound({
          text: "Şu an metin ve sesli mesajları destekliyorum. Lütfen metin veya sesli mesaj gönderin.",
          stage: "unsupported_message_reply",
          messageType: "text",
        });
      }
      void logBotMessageAudit({
        traceId,
        tenantId: event.tenant_hint,
        customerPhone,
        direction: "inbound",
        stage: "empty_or_unsupported_message",
        messageId,
        policyReason: messageType,
      }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
      return;
    }

    await logInbound({
      text: rawText,
      stage: "inbound_received",
      metadata: {
        message_type: messageType,
      },
    });

    const previousTenantId = await getTenantIdByPhone(customerPhone);
    let tenantId: string | null = null;
    let routingReason: RoutingReason = "none";
    let tenantCode: string | null = null;
    let intentDomain: "haircare" | "carcare" | null = null;

    const extractedEntities = extractSafeEntities(rawText);
    const maskedMessage = maskSensitivePII(rawText);

    let normalizedText: string;

    if (boundTenantId) {
      // İşletmenin kendi numarası: mesaj zaten doğru adrese geldi.
      tenantId = boundTenantId;
      routingReason = "channel_account";
      // Yönlendirmeye gerek yok ama temizlik yine de şart: QR/link ile gelen
      // "Kod: AHMET01" / "#AHMET01" işaretleri modele gitmemeli.
      normalizedText = normalizeIncomingText(
        sanitizeIncomingCustomerMessage(maskedMessage) || maskedMessage
      );
    } else {
      const pickedTenantCode = extractTenantPickCode(event.message);
      const routing = await resolveTenantRouting({
        customerPhone,
        rawMessage: maskedMessage,
        previousTenantId,
        tenantCodeHint: pickedTenantCode,
      });
      tenantId = routing.tenantId;
      routingReason = routing.reason;
      tenantCode = routing.tenantCode;
      intentDomain = routing.intentDomain;
      normalizedText = normalizeIncomingText(routing.normalizedMessage || maskedMessage);

      // Müşteri listeden seçtiğinde WhatsApp bize yalnızca işletme adını
      // gönderir. Asıl niyet ("yarın 3'e randevu") soru sorulurken saklanmıştı;
      // geri yükle ki müşteri kendini tekrar etmek zorunda kalmasın.
      if (pickedTenantCode && tenantId) {
        const pending = await takePendingIntent(customerPhone).catch(() => null);
        const restored = normalizeIncomingText(pending || "");
        if (restored) normalizedText = restored;
      }

      // Benzer isimli birden fazla işletme eşleşti. Tahmin etmek, başka bir
      // işletmenin müşteri konuşmasını sızdırma riski taşır — sor ve bekle.
      if (routing.reason === "ambiguous" && routing.candidates?.length) {
        // Seçim geldiğinde geri yüklenmek üzere asıl mesajı sakla.
        await setPendingIntent(customerPhone, normalizedText).catch(() => undefined);
        const askedText = await askWhichTenant({
          customerPhone,
          candidates: routing.candidates,
          tenantId: channelTenantId,
        });
        await logOutbound({
          tenantId: null,
          text: askedText,
          stage: "tenant_ambiguous_asked",
          metadata: {
            candidate_ids: routing.candidates.map((c) => c.id),
            candidate_count: routing.candidates.length,
          },
        });
        void logBotMessageAudit({
          traceId,
          tenantId: null,
          customerPhone,
          direction: "outbound",
          stage: "tenant_ambiguous_asked",
          policyReason: "ambiguous_name_match",
          messageId,
        }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
        return;
      }
    }

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
        tenantId: channelTenantId,
      });
      await logOutbound({
        tenantId: null,
        text:
          "Mesajınızı aldım. Hangi işletme için randevu almak istediğinizi anlayamadım. Lütfen işletme adını yazın (örn: Kuaför Ahmet).",
        stage: "tenant_not_found",
      });
      void logBotMessageAudit({
        traceId,
        tenantId: null,
        customerPhone,
        direction: "outbound",
        stage: "tenant_not_found",
        messageId,
      }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
      return;
    }

    // Tenant belli: bundan sonraki gönderimler işletmenin kendi numarası
    // varsa oradan, yoksa ortak numaradan yapılır.
    channelTenantId = tenantId;

    const hasTenantSwitched = Boolean(previousTenantId && previousTenantId !== tenantId);
    const isFirstTenantBinding = Boolean(!previousTenantId && tenantId);
    if (hasTenantSwitched && previousTenantId) {
      await deleteSession(previousTenantId, customerPhone);
    }

    await setPhoneTenantMapping(customerPhone, tenantId);
    const existingSession = await getSession(tenantId, customerPhone);

    // Postgres is SoT for automation ownership (not Redis alone).
    // Order matters: ensure → insert (idempotent) → touch unread ONLY if new.
    // Touching before insert inflated unread on webhook retries.
    let conversation = await ensureConversation({
      tenantId,
      externalUserId: customerPhone,
    });

    if (conversation?.id && messageId) {
      const inboundInsert = await insertInboundMessageIdempotent({
        tenantId,
        conversationId: conversation.id,
        externalUserId: customerPhone,
        externalMessageId: messageId,
        text: normalizedText || null,
        messageType,
        requestId: traceId,
      });
      if (inboundInsert.duplicate) {
        emitConversationEvent("message_deduplicated", {
          tenant_id: tenantId,
          conversation_id: conversation.id,
          message_id: messageId,
          request_id: traceId,
        });
        // Same-owner Inngest retry after crash: inbound row exists but AI may not.
        // Meta redelivery with a new trace already exited at claim already_done/in_progress.
        // Skip unread touch; abort only if this trace already produced an outbound.
        const { data: priorOut } = await supabase
          .from("conversation_messages")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("conversation_id", conversation.id)
          .eq("direction", "outbound")
          .eq("request_id", traceId)
          .limit(1)
          .maybeSingle();
        if (priorOut?.id) return;
      } else if (inboundInsert.inserted) {
        conversation =
          (await touchConversationForInbound({
            conversationId: conversation.id,
            tenantId,
            messagePreview: normalizedText || null,
            messageId,
            requestId: traceId,
          })) || conversation;
        void cancelFollowUpsForCustomer(
          tenantId,
          conversation.customer_id,
          "customer_replied",
          customerPhone
        ).catch(() => undefined);
      }
      // Non-duplicate insert failure (migration missing): continue; Redis claim still dedupes AI.
    }

    const dbAutomationMode =
      conversation?.automation_mode ||
      (await getConversationAutomationMode(tenantId, customerPhone));
    const skipAi = shouldSkipAiProcessing(dbAutomationMode);

    if (skipAi) {
      emitConversationEvent("ai_processing_skipped", {
        tenant_id: tenantId,
        conversation_id: conversation?.id,
        message_id: messageId,
        request_id: traceId,
        reason: dbAutomationMode || "unknown",
      });
      if (existingSession) {
        await setSession(tenantId, customerPhone, {
          ...existingSession,
          last_customer_message_at: event.received_at,
          window_status: "OPEN",
          step: "PAUSED_FOR_HUMAN",
          updated_at: new Date().toISOString(),
        });
      }
      void logConversationMessage({
        traceId,
        tenantId,
        customerPhone,
        direction: "inbound",
        messageText: normalizedText || null,
        messageType,
        stage: "automation_mode_bypass",
        messageId,
        metadata: { automation_mode: dbAutomationMode },
        createdAt: event.received_at,
      }).catch(() => undefined);

      // HUMAN_ACTIVE / AI_ASSIST: staff must see inbound even if Redis expired.
      const takeoverBucket = Math.floor(Date.now() / (10 * 60 * 1000));
      await createOpsAlert({
        tenantId,
        type: "system",
        severity: "medium",
        customerPhone,
        message:
          dbAutomationMode === "HUMAN_ACTIVE"
            ? "Müşteri yeni mesaj gönderdi (canlı destek / insan modu açık)."
            : "Müşteri yeni mesaj gönderdi (AI asist modu — insan onayı bekleniyor).",
        meta: {
          source: "whatsapp_worker",
          stage: "automation_mode_bypass",
          automation_mode: dbAutomationMode,
          visibility: "internal",
          trace_id: traceId,
          conversation_id: conversation?.id || null,
        },
        dedupeKey: `human_mode_inbound:${tenantId}:${digitsOnly(customerPhone)}:${takeoverBucket}`,
      }).catch(() => undefined);
      return;
    }

    // Soft-pause: AI still runs a limited resume/ack path; staff must be notified.
    if (dbAutomationMode === "AUTOMATION_PAUSED") {
      const softBucket = Math.floor(Date.now() / (10 * 60 * 1000));
      await createOpsAlert({
        tenantId,
        type: "system",
        severity: "high",
        customerPhone,
        message:
          "Müşteri yazdı — konuşma AI soft-pause (insan desteği bekleniyor).",
        meta: {
          source: "whatsapp_worker",
          stage: "automation_paused_inbound",
          visibility: "internal",
          trace_id: traceId,
          conversation_id: conversation?.id || null,
        },
        dedupeKey: `soft_pause_inbound:${tenantId}:${digitsOnly(customerPhone)}:${softBucket}`,
      }).catch(() => undefined);
    }

    // Stale Redis admin-pause must NOT override Postgres AI_ACTIVE after resume.
    if (
      existingSession?.step === "PAUSED_FOR_HUMAN" &&
      isLiveHumanTakeoverReason(existingSession.pause_reason) &&
      dbAutomationMode !== "HUMAN_ACTIVE" &&
      dbAutomationMode !== "AI_ASSIST"
    ) {
      await setSession(tenantId, customerPhone, {
        ...existingSession,
        step: "devam",
        pause_reason: null,
        last_customer_message_at: event.received_at,
        window_status: "OPEN",
        updated_at: new Date().toISOString(),
      }).catch(() => undefined);
    }

    // DİKKAT: processMessage'a bu değişken geçilir. Eskiden Redis'e yazılan güncel
    // state yerine yazma ÖNCESİ okunan `existingSession` geçiliyordu; processor
    // kendi setSession'ını yapınca burada yakalanan isim ve tenant değişimindeki
    // sıfırlama geri alınıyordu.
    let sessionForProcessing: ConversationState | null = existingSession;

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
        // Tenant değiştiyse önceki işletmenin bağlamı taşınmamalı.
        extracted: hasTenantSwitched
          ? extractedEntities.customer_name
            ? { customer_name: extractedEntities.customer_name }
            : {}
          : nextExtracted,
        step: "devam",
        message_count: hasTenantSwitched ? 0 : existingSession?.message_count ?? 0,
        chat_history: hasTenantSwitched ? [] : existingSession?.chat_history ?? [],
        updated_at: new Date().toISOString(),
        window_status: "OPEN",
        last_customer_message_at: event.received_at,
        retry_count: 0,
        timezone: "Europe/Istanbul",
      };
      await setSession(tenantId, customerPhone, newState);
      sessionForProcessing = newState;
    } else if (nextExtracted.customer_name) {
      const updatedState: ConversationState = {
        ...existingSession,
        extracted: nextExtracted,
        last_customer_message_at: event.received_at,
        window_status: "OPEN",
        timezone: existingSession.timezone || "Europe/Istanbul",
        updated_at: new Date().toISOString(),
      };
      await setSession(tenantId, customerPhone, updatedState);
      sessionForProcessing = updatedState;
    }

    if (
      (hasTenantSwitched || isFirstTenantBinding) &&
      routingReason !== "none" &&
      routingReason !== "ambiguous"
    ) {
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
        tenantId: channelTenantId,
      });
      await logOutbound({
        tenantId,
        text: "Mesajın boş görünüyor. Kısa bir metinle tekrar yazabilir misin?",
        stage: "normalized_text_empty",
      });
      return;
    }

    if (shouldSendQuickAck(rawText)) {
      await sendWhatsAppMessageDetailed({
        to: customerPhone,
        text: "Mesajını aldım, hemen kontrol ediyorum.",
        tenantId: channelTenantId,
      });
      await logOutbound({
        text: "Mesajını aldım, hemen kontrol ediyorum.",
        stage: "quick_ack_sent",
      });
    }

    emitConversationEvent("ai_processing_started", {
      tenant_id: tenantId,
      conversation_id: conversation?.id,
      message_id: messageId,
      request_id: traceId,
    });

    const aiStart = Date.now();
    const { reply, metrics } = await processMessage(
      tenantId,
      customerPhone,
      normalizedText,
      { existingSession: sessionForProcessing, messageId }
    );
    const llmLatencyMs = Date.now() - aiStart;
    const safeReply = (reply && String(reply).trim()) || "Anlamadım, tekrar yazar mısınız?";
    // Inbound webhook ⇒ customer just messaged us; the 24h window is open.
    // Meta sample payloads ship stale timestamps that falsely tripped a local
    // pre-check and forced a doomed template path (401 on test numbers).
    // Trust Meta 131047 for a truly closed window.
    let sendStage = "message_replied";
    let sendErrorCode: string | null = null;
    let sendResult: WhatsAppSendResult | null = null;

    // Outbound audit: queue first so provider failure still leaves a row.
    const outboundQueued =
      conversation?.id
        ? await recordOutboundQueued({
            tenantId,
            conversationId: conversation.id,
            externalUserId: customerPhone,
            text: safeReply,
            senderType: "AI",
            source: "bot",
            requestId: traceId,
          })
        : null;

    sendResult = await sendWhatsAppMessageDetailed({
      to: customerPhone,
      text: safeReply,
      tenantId: channelTenantId,
    });
    if (outboundQueued && conversation?.id) {
      try {
        if (sendResult.ok && sendResult.messageId) {
          await markOutboundSent({
            rowId: outboundQueued.id,
            tenantId,
            conversationId: conversation.id,
            externalMessageId: sendResult.messageId,
            preview: safeReply,
          });
        } else if (!sendResult.ok) {
          await markOutboundFailed({
            rowId: outboundQueued.id,
            tenantId,
            conversationId: conversation.id,
            failureCode:
              sendResult.errorCode != null ? String(sendResult.errorCode) : null,
            failureReason: sendResult.errorMessage || sendStage,
          });
        } else if (sendResult.ok) {
          await markOutboundSent({
            rowId: outboundQueued.id,
            tenantId,
            conversationId: conversation.id,
            externalMessageId: `local_${outboundQueued.id}`,
            preview: safeReply,
          });
        }
      } catch (auditErr) {
        console.error("[whatsapp-worker] outbound audit update failed", auditErr);
      }
    }
    if (!sendResult.ok) {
      sendErrorCode = sendResult.errorCode ? String(sendResult.errorCode) : null;
      const closedWindow =
        sendResult.blockedReason === "outside_24h_window" ||
        sendResult.errorCode === 131047;
      // Same token/recipient that just failed auth or allow-list will fail template too.
      const skipTemplate = isPermanentWhatsAppSendFailure(sendResult);

      if (closedWindow && !skipTemplate) {
        const templateResult = await sendWindowRecoveryTemplate(
          customerPhone,
          channelTenantId
        );
        if (templateResult.ok) {
          sendStage = "template_recovery_sent";
        } else {
          sendStage = "template_recovery_failed";
          sendErrorCode =
            templateResult.blockedReason === "token_expired" || templateResult.status === 401
              ? "190"
              : "window_closed_template_failed";
          sendResult = {
            ...sendResult,
            status: templateResult.status ?? sendResult.status,
            errorCode: templateResult.errorCode ?? sendResult.errorCode,
            blockedReason: templateResult.blockedReason ?? sendResult.blockedReason,
            errorMessage: templateResult.errorMessage ?? sendResult.errorMessage,
          };
        }
      } else {
        sendStage = "message_reply_failed";
      }
    }

    await logOutbound({
      tenantId,
      text:
        sendStage === "template_recovery_sent" || sendStage === "template_recovery_failed"
          ? `[template:${WHATSAPP_RESUME_TEMPLATE_NAME}]`
          : safeReply,
      stage: sendStage,
      metadata: {
        window_open: true,
        routing_reason: routingReason,
        send_error_code: sendErrorCode,
        send_blocked_reason: sendResult?.blockedReason ?? null,
      },
    });

    if (sendStage === "message_reply_failed" || sendStage === "template_recovery_failed") {
      const errMsg = `whatsapp_reply_failed:${sendErrorCode || sendStage}`;
      const permanent =
        sendStage === "template_recovery_failed" ||
        isPermanentWhatsAppSendFailure(sendResult);
      if (permanent) {
        // Config / Meta policy won't change within Inngest backoff — mark done
        // (caller) and exit cleanly instead of burning retries + claim storms.
        console.error("[whatsapp-worker] permanent send failure; completing without retry", {
          messageId,
          traceId,
          err: errMsg,
          blockedReason: sendResult?.blockedReason ?? null,
          status: sendResult?.status ?? null,
        });
        return;
      }
      throw new Error(errMsg);
    }

    // Kalıcı lead hafızasını tazele. Cevap zaten gönderildi; müşteri beklemez.
    try {
      const finalSession = await getSession(tenantId, customerPhone);
      const turnCount = finalSession?.message_count ?? 0;
      if (shouldRefreshLeadMemory(turnCount, false)) {
        const existingMemory = await getLeadMemory(tenantId, customerPhone);
        await refreshLeadMemoryFromConversation({
          tenantId,
          customerPhone,
          history: finalSession?.chat_history ?? [],
          existing: existingMemory,
          client: openai,
          model: MODEL_SIMPLE,
        });
      }
    } catch (err) {
      console.warn("[whatsapp-worker] lead memory refresh failed", err);
    }

    void logBotMessageAudit({
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
      lockWaitMs: ctx.lockWaitMs ?? null,
      queueLagMs: ctx.queueLagMs ?? null,
      promptTokens: metrics?.prompt_tokens ?? null,
      completionTokens: metrics?.completion_tokens ?? null,
      totalTokens: metrics?.total_tokens ?? null,
      costUsd: estimateCostUsd(metrics?.model, metrics?.total_tokens || 0),
      model: metrics?.model ?? null,
      modelPricingVersion: MODEL_PRICING_VERSION,
      errorCode: sendErrorCode,
    }).catch((err) => console.error("[whatsapp-worker] audit log failed", err));
}
