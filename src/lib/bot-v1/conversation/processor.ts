import OpenAI from "openai";
import { supabase } from "../../supabase";
import {
  getSession,
  setSession,
  deleteSession,
  getTenantFromCache,
  setTenantCache,
} from "../../redis";
import { sendWhatsAppMessage } from "../../whatsapp";
import { getCustomerHistory, formatHistoryForPrompt } from "@/services/customerHistory.service";
import {
  getCustomerLastActiveAppointment,
  cancelAppointment,
} from "@/services/cancellation.service";
import { submitReview, hasReview } from "@/services/review.service";
import { isCustomerBlocked } from "@/services/blacklist.service";
import {
  mergeConfig,
  buildMessage as buildConfigMessage,
  checkRequiredFields,
} from "@/services/configMerge.service";
import {
  buildSystemPrompt as buildConfigSystemPrompt,
  type PromptBuilderContext,
} from "@/services/promptBuilder.service";
import { getDailyAvailability, reserveAppointment } from "@/services/booking.service";
import { createOpsAlert } from "@/services/opsAlert.service";
import { detectDeterministicIntent } from "@/lib/intent";
import type {
  BotConfig,
  MergedConfig,
  TenantConfigOverride,
} from "@/types/botConfig.types";
import type {
  Tenant,
  BusinessType,
  ConversationState,
  FlowType,
} from "../../database.types";

// Imports from new modules
import { openai } from "./client";
import {
  HUMAN_ESCALATION_TAG,
  MAX_MESSAGES_BEFORE_ESCALATION,
  CONTEXT_TURNS_TO_SEND,
  MAX_TOOL_ROUNDS,
  APP_TIMEZONE,
  isValidStep,
  MODEL_SIMPLE,
  MODEL_COMPLEX,
  RATING_MAP,
} from "./constants";
import {
  normalizeHalfHourRequest,
  normalizeAssistantReply,
} from "./normalizers";
import {
  isAskNameIntent,
  isCancelConfirmation,
  isCancelReject,
  isAbusiveMessage,
  isOutOfScopeMessage,
  isGreetingOrSmallTalkOnly,
  isNegotiationMessage,
  isEscalationQuestion,
  isHumanEscalationRequest,
  detectGlobalInterruptIntent,
  classifyIntentForRouting,
} from "./intent-detection";
import {
  getMergedMessages,
  getMisunderstandReply,
  getProcessErrorReply,
  buildSystemPrompt,
  wrapContextInXml,
} from "./prompt-builder";
import {
  localDateStr,
  localTimeStr,
  buildSystemContext,
  buildStateSummary,
  formatSlotDateTimeTr,
} from "./context-builder";
import {
  formatDateReadableTr,
  getKnownCustomerName,
  trimChatHistory,
} from "./helpers";
import { TOOLS } from "./tools/definitions";
import { executeToolCall } from "./tools/executor";

// ── Human escalation ────────────────────────────────────────────────────────────

export function buildHumanEscalationMessage(
  tenant: {
    contact_phone?: string | null;
    working_hours_text?: string | null;
  },
  tone?: string
): string {
  const phone =
    tenant.contact_phone?.trim() ||
    "İletişim numarası işletme ayarlarında tanımlanmadı.";
  const hours =
    tenant.working_hours_text?.trim() ||
    "Çalışma saatleri işletme ayarlarında tanımlanmadı.";
  if (tone === "siz") {
    return `Üzgünüm, bu konuda size yardımcı olamıyorum.\nLütfen işletmemizle doğrudan iletişime geçin: ${phone}\nÇalışma saatleri: ${hours}`;
  }
  return `Üzgünüm, bu konuda sana yardımcı olamıyorum.\nBizi doğrudan arayabilirsin: ${phone}\nÇalışma saatleri: ${hours}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function isValidBotConfig(c: unknown): c is BotConfig {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.bot_persona === "string" &&
    typeof o.opening_message === "string" &&
    typeof o.messages === "object" &&
    o.messages !== null &&
    typeof o.tone === "object" &&
    o.tone !== null
  );
}

function parseRating(text: string): number | null {
  const t = text.trim().toLowerCase();
  const digitMatch = t.match(/^([1-5])\s*(yıldız)?\s*$/);
  if (digitMatch) return parseInt(digitMatch[1], 10);
  const words = t.replace(/\s*yıldız\s*/gi, "").split(/\s+/);
  for (const w of words) {
    if (RATING_MAP[w] != null) return RATING_MAP[w];
  }
  if (RATING_MAP[t] != null) return RATING_MAP[t];
  return null;
}

async function tryHandleReview(
  tenantId: string,
  customerPhone: string,
  msg: string
): Promise<{ handled: boolean; reply?: string }> {
  const rating = parseRating(msg);
  if (rating == null || rating < 1 || rating > 5) return { handled: false };
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { data: apt } = await supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .lt("slot_start", oneHourAgo.toISOString())
    .in("status", ["completed", "confirmed"])
    .order("slot_start", { ascending: false })
    .limit(1)
    .single();

  if (!apt) return { handled: false };
  if (await hasReview(apt.id)) return { handled: false };

  const result = await submitReview(tenantId, apt.id, customerPhone, rating);
  if (!result.ok) return { handled: false };

  await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", apt.id);

  return {
    handled: true,
    reply: "Teşekkürler! Değerlendirmen için sağ ol, tekrar bekleriz!",
  };
}

// ── Tenant lookup ───────────────────────────────────────────────────────────────

export async function getTenantByCode(
  tenantCode: string
): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, business_types(*)")
    .eq("tenant_code", tenantCode.toUpperCase())
    .is("deleted_at", null)
    .eq("status", "active")
    .single();
  if (error || !data) return null;
  return data as unknown as Tenant;
}

export async function getTenantWithBusinessType(
  tenantId: string
): Promise<(Tenant & { business_types: BusinessType }) | null> {
  try {
    const cached = await getTenantFromCache(tenantId);
    if (cached && typeof cached === "object" && cached !== null) {
      return cached as Tenant & { business_types: BusinessType };
    }
  } catch (err) {
    console.warn("[ai] getTenantFromCache:", err);
  }
  const { data, error } = await supabase
    .from("tenants")
    .select("*, business_types(*)")
    .eq("id", tenantId)
    .single();
  if (error || !data) return null;
  const tenant = data as unknown as Tenant & { business_types: BusinessType };
  try {
    await setTenantCache(tenantId, tenant);
  } catch (err) {
    console.warn("[ai] setTenantCache:", err);
  }
  return tenant;
}

// ── Availability ────────────────────────────────────────────────────────────────

export async function checkAvailability(
  tenantId: string,
  dateStr: string,
  configOverride?: Record<string, unknown>,
  serviceSlug?: string
): Promise<{
  available: string[];
  booked: string[];
  blocked?: boolean;
  noSchedule?: boolean;
  closed?: boolean;
}> {
  const daily = await getDailyAvailability(tenantId, dateStr, {
    configOverride,
    serviceSlug,
  });
  return {
    available: daily.available,
    booked: daily.booked,
    blocked: daily.blocked,
    closed: daily.closed,
    noSchedule: daily.noSchedule,
  };
}

// ── Create appointment ──────────────────────────────────────────────────────────

export async function createAppointment(
  tenantId: string,
  customerPhone: string,
  dateStr: string,
  timeStr: string,
  extraData?: Record<string, unknown>,
  serviceSlug?: string | null
): Promise<{ ok: boolean; id?: string; error?: string; suggested_time?: string }> {
  try {
    const result = await reserveAppointment({
      tenantId,
      customerPhone,
      date: dateStr,
      time: timeStr,
      serviceSlug,
      extraData,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        suggested_time: result.suggested_time,
      };
    }
    return { ok: true, id: result.id };
  } catch (err) {
    console.error("[ai] createAppointment:", err);
    return { ok: false, error: "Bir hata oluştu." };
  }
}

// ── OpenAI call with retry ──────────────────────────────────────────────────────

async function callOpenAI(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  model: string = MODEL_SIMPLE
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await openai!.chat.completions.create({
      model,
      messages,
      ...(tools ? { tools, tool_choice: "auto" as const } : {}),
    });
  } catch (err: unknown) {
    const e = err as { status?: number; error?: { message?: string }; message?: string };
    console.error(
      "[ai] OpenAI error",
      "status:",
      e?.status,
      "message:",
      e?.error?.message ?? e?.message
    );
    if (e?.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      return await openai!.chat.completions.create({
        model,
        messages,
        ...(tools ? { tools, tool_choice: "auto" as const } : {}),
      });
    }
    throw err;
  }
}

// ── Main process ────────────────────────────────────────────────────────────────

export interface ProcessMessageMetrics {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  llm_latency_ms: number;
}

export async function processMessage(
  tenantId: string,
  customerPhone: string,
  incomingMessage: string
): Promise<{ reply: string; stateReset?: boolean; metrics?: ProcessMessageMetrics }> {
  try {
    const tenant = await getTenantWithBusinessType(tenantId);
    if (!tenant) {
      return {
        reply: "Üzgünüm, işletme bulunamadı. Lütfen doğru kodu kullanın.",
      };
    }

    const bt = (
      Array.isArray(tenant.business_types)
        ? tenant.business_types[0]
        : tenant.business_types
    ) as BusinessType | undefined;
    const baseBotConfig = bt?.bot_config;
    const mergedConfig: MergedConfig | null =
      baseBotConfig && isValidBotConfig(baseBotConfig)
        ? mergeConfig(baseBotConfig as BotConfig, tenant.config_override as TenantConfigOverride)
        : null;

    const msgs = getMergedMessages(tenant);
    const tone = msgs.tone ?? "sen";
    const effectiveMessage = normalizeHalfHourRequest(incomingMessage);

    if (isHumanEscalationRequest(effectiveMessage)) {
      const pausedState: ConversationState = {
        ...(await getSession(tenantId, customerPhone) || {
          tenant_id: tenantId,
          customer_phone: customerPhone,
          flow_type: (bt?.config?.flow_type as FlowType) || "appointment",
          extracted: {},
          step: "PAUSED_FOR_HUMAN",
          updated_at: new Date().toISOString(),
        }),
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "PAUSED_FOR_HUMAN",
        pause_reason: "human_request",
        window_status: "OPEN",
        last_customer_message_at: new Date().toISOString(),
        timezone: APP_TIMEZONE,
        updated_at: new Date().toISOString(),
      };
      await setSession(tenantId, customerPhone, pausedState);
      if (mergedConfig) {
        const msg = buildConfigMessage(mergedConfig, "human_escalation", {
          contact_phone: tenant.contact_phone?.trim() ?? "",
          working_hours: tenant.working_hours_text?.trim() ?? "",
        });
        if (msg) return { reply: msg };
      }
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    // Kara liste kontrolu
    const blocked = await isCustomerBlocked(tenantId, customerPhone);
    if (blocked) {
      return {
        reply: tone === "siz"
          ? "Üzgünüz, şu an randevu hizmeti veremiyoruz. Lütfen işletmeyi doğrudan arayın."
          : "Üzgünüm, şu an randevu hizmeti veremiyorum. Lütfen işletmeyi doğrudan ara.",
      };
    }

    const reviewResult = await tryHandleReview(
      tenantId,
      customerPhone,
      effectiveMessage
    );
    if (reviewResult.handled && reviewResult.reply) {
      return { reply: reviewResult.reply };
    }

    let state = await getSession(tenantId, customerPhone);
    if (state?.step === "PAUSED_FOR_HUMAN") {
      const pausedAt = state.updated_at ? new Date(state.updated_at).getTime() : 0;
      const inactiveMs = Date.now() - pausedAt;
      const wantsBotResume = /bot devam|devam et|geri don|geri dön/i.test(effectiveMessage);
      const autoResume = Number.isFinite(pausedAt) && inactiveMs >= 2 * 60 * 60 * 1000;
      if (!wantsBotResume && !autoResume) {
        return {
          reply:
            tone === "siz"
              ? "Bu sohbet şu an insan desteğinde. Botu tekrar devreye almak için \"bot devam\" yazabilirsiniz."
              : "Bu sohbet şu an insan desteğinde. Botu tekrar devreye almak için \"bot devam\" yazabilirsin.",
        };
      }
      state = {
        ...state,
        step: "RECOVERY_CHECK",
        pause_reason: null,
        updated_at: new Date().toISOString(),
      };
      await setSession(tenantId, customerPhone, state);
    }
    const messageCount = (state?.message_count ?? 0) + 1;
    if (messageCount > MAX_MESSAGES_BEFORE_ESCALATION) {
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    if (state && !isValidStep(state.step)) {
      console.warn("[session] Geçersiz step, sıfırlanıyor:", state.step);
      await deleteSession(tenantId, customerPhone);
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    const flowType = (bt?.config?.flow_type as FlowType) || "appointment";

    // tenant_bulundu adımı sadece tenant bağlama içindir; müşteriye her seferinde
    // "hoş geldiniz" dönmemek için konuşmayı "devam" moduna geçir.
    if (state?.step === "tenant_bulundu") {
      state = {
        ...(state || {}),
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "devam",
        extracted: state?.extracted || {},
        flow_type: flowType,
        message_count: messageCount,
        consecutive_misunderstandings: state?.consecutive_misunderstandings ?? 0,
        retry_count: state?.retry_count ?? 0,
        window_status: "OPEN",
        last_customer_message_at: new Date().toISOString(),
        timezone: state?.timezone || APP_TIMEZONE,
        chat_history: state?.chat_history || [],
        updated_at: new Date().toISOString(),
      };
      await setSession(tenantId, customerPhone, state);
    }

    // Session yoksa minimal başlangıç state'i oluştur.
    if (!state) {
      state = {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "devam",
        extracted: {},
        flow_type: flowType,
        message_count: 1,
        consecutive_misunderstandings: 0,
        retry_count: 0,
        window_status: "OPEN",
        last_customer_message_at: new Date().toISOString(),
        timezone: APP_TIMEZONE,
        chat_history: [],
        updated_at: new Date().toISOString(),
      };
      await setSession(tenantId, customerPhone, state);
    }

    const globalInterrupt = detectGlobalInterruptIntent(effectiveMessage);
    if (globalInterrupt === "RESET" || globalInterrupt === "CANCEL_FLOW") {
      const replyText =
        tone === "siz"
          ? "Tamam, mevcut akışı kapattım. İsterseniz baştan başlayabiliriz."
          : "Tamam, mevcut akışı kapattım. İstersen baştan başlayabiliriz.";
      await setSession(tenantId, customerPhone, {
        ...(state || {}),
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "devam",
        extracted: {},
        flow_type: flowType,
        message_count: messageCount,
        retry_count: 0,
        consecutive_misunderstandings: 0,
        window_status: "OPEN",
        last_customer_message_at: new Date().toISOString(),
        timezone: APP_TIMEZONE,
        chat_history: trimChatHistory([
          ...(state?.chat_history || []),
          { role: "user", content: incomingMessage },
          { role: "assistant", content: replyText },
        ]),
        updated_at: new Date().toISOString(),
      });
      return { reply: replyText };
    }
    if (globalInterrupt === "ASK_FAQ") {
      state = {
        ...(state || {}),
        step: "devam",
      };
    }

    if ((state?.retry_count ?? 0) >= 3) {
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    const extracted = (state.extracted || {}) as Record<string, unknown>;
    const pendingCancelId = extracted.pending_cancel_appointment_id as string | undefined;

    if (pendingCancelId) {
      if (isCancelConfirmation(effectiveMessage)) {
        const { data: pendingApt } = await supabase
          .from("appointments")
          .select("id, slot_start")
          .eq("id", pendingCancelId)
          .eq("tenant_id", tenantId)
          .eq("customer_phone", customerPhone)
          .in("status", ["confirmed", "pending"])
          .maybeSingle();

        if (!pendingApt) {
          await setSession(tenantId, customerPhone, {
            ...state,
            step: "devam",
            extracted: {
              ...extracted,
              pending_cancel_appointment_id: null,
            },
            message_count: messageCount,
            updated_at: new Date().toISOString(),
          });
          return {
            reply:
              tone === "siz"
                ? "İptal bekleyen aktif randevu bulunamadı. Yeni bir randevu planlayabiliriz."
                : "İptal bekleyen aktif randevu görünmüyor. Yeni randevu planlayalım mı?",
          };
        }

        const configOverride = (tenant.config_override || {}) as Record<string, unknown>;
        const cancellationHrs =
          mergedConfig?.cancellation_hours ??
          (configOverride?.cancellation_hours as number) ??
          2;
        const hasCancellationRule =
          mergedConfig != null || configOverride?.cancellation_hours != null;
        const slotTime = new Date(pendingApt.slot_start).getTime();
        const hoursLeft = (slotTime - Date.now()) / (60 * 60 * 1000);
        if (hasCancellationRule && hoursLeft < cancellationHrs) {
          return {
            reply:
              tone === "siz"
                ? `İptal için randevu saatine en az ${cancellationHrs} saat kala bildirmeniz gerekiyor.`
                : `İptal için randevu saatine en az ${cancellationHrs} saat kala bildirmen gerekiyor.`,
          };
        }

        const cancelResult = await cancelAppointment({
          tenantId,
          appointmentId: pendingCancelId,
          cancelledBy: "customer",
          reason: "Müşteri onaylı iptal",
        });

        if (!cancelResult.ok) {
          return {
            reply:
              tone === "siz"
                ? "İptal işlemi şu an tamamlanamadı. Lütfen tekrar deneyin."
                : "İptal işlemi şu an tamamlanamadı, tekrar dener misin?",
          };
        }

        await createOpsAlert({
          tenantId,
          type: "cancellation",
          severity: "medium",
          customerPhone,
          message: `${customerPhone} müşterisi randevusunu iptal etti.`,
          meta: { appointment_id: pendingCancelId, source: "cancel_confirmation" },
          dedupeKey: `cancel:${tenantId}:${pendingCancelId}`,
        }).catch((e) => console.error("[ai] ops alert create error:", e));

        await setSession(tenantId, customerPhone, {
          ...state,
          step: "devam",
          extracted: {
            ...extracted,
            pending_cancel_appointment_id: null,
          },
          message_count: messageCount,
          updated_at: new Date().toISOString(),
          chat_history: trimChatHistory([
            ...(state.chat_history || []),
            { role: "user", content: incomingMessage },
            {
              role: "assistant",
              content:
                tone === "siz"
                  ? "Randevunuzu iptal ettim. İsterseniz yeni bir saat planlayalım."
                  : "Randevunu iptal ettim. İstersen yeni bir saat planlayalım.",
            },
          ]),
        });
        return {
          reply:
            tone === "siz"
              ? "Randevunuzu iptal ettim. İsterseniz yeni bir saat planlayalım."
              : "Randevunu iptal ettim. İstersen yeni bir saat planlayalım.",
        };
      }

      if (isCancelReject(effectiveMessage)) {
        await setSession(tenantId, customerPhone, {
          ...state,
          step: "devam",
          extracted: {
            ...extracted,
            pending_cancel_appointment_id: null,
          },
          message_count: messageCount,
          updated_at: new Date().toISOString(),
        });
        return {
          reply:
            tone === "siz"
              ? "İptal isteğinizi kapattım. Randevunuz aktif olarak duruyor."
              : "Tamam, iptali kapattım. Randevun aktif olarak duruyor.",
        };
      }

      return {
        reply:
          tone === "siz"
            ? "İptal onayı için lütfen \"evet iptal\" yazın. Vazgeçtiyseniz \"vazgeçtim\" yazabilirsiniz."
            : "İptal onayı için \"evet iptal\" yaz. Vazgeçtiysen \"vazgeçtim\" yazabilirsin.",
      };
    }

    if (isEscalationQuestion(effectiveMessage)) {
      return {
        reply:
          tone === "siz"
            ? "Az önce burada çözemediğim bir konuda insan desteği önermiştim. İsterseniz randevu, fiyat veya müsaitlik işlemlerine burada devam edebiliriz."
            : "Az önce burada çözemediğim bir konuda insan desteği önermiştim. İstersen randevu, fiyat veya müsaitlik işlemlerine burada devam edebiliriz.",
      };
    }

    if (isAskNameIntent(effectiveMessage)) {
      const knownName = await getKnownCustomerName(tenantId, customerPhone, state);
      if (knownName) {
        await setSession(tenantId, customerPhone, {
          ...state,
          extracted: {
            ...extracted,
            customer_name: knownName,
          },
          message_count: messageCount,
          updated_at: new Date().toISOString(),
        });
        return {
          reply:
            tone === "siz"
              ? `Sizi ${knownName} adıyla kayıtlı görüyorum.`
              : `Seni ${knownName} adıyla kayıtlı görüyorum.`,
        };
      }
      return {
        reply:
          tone === "siz"
            ? "Ad bilginizi bu konuşmada henüz almadım. Adınızı yazarsanız kaydedebilirim."
            : "Ad bilgisini henüz almadım. Adını yazarsan kaydedeyim.",
      };
    }

    if (isAbusiveMessage(effectiveMessage)) {
      return {
        reply:
          tone === "siz"
            ? "Hakaret içeren mesajlarda devam edemiyorum. Randevu veya işletme bilgisi için yardımcı olabilirim."
            : "Hakaret içeren mesajlarda devam edemiyorum. Randevu veya işletme bilgisi için yardımcı olabilirim.",
      };
    }

    if (isNegotiationMessage(effectiveMessage)) {
      const contactPhone = tenant.contact_phone?.trim() || "işletme telefonu";
      return {
        reply:
          tone === "siz"
            ? `Fiyat konusunda son kararı işletme verir. Mevcut fiyat bilgisini paylaşabilirim; özel fiyat için ${contactPhone} numarasını arayabilirsiniz.`
            : `Fiyat konusunda son kararı işletme verir. Mevcut fiyat bilgisini paylaşabilirim; özel fiyat için ${contactPhone} numarasını arayabilirsin.`,
      };
    }

    if (isGreetingOrSmallTalkOnly(effectiveMessage)) {
      return {
        reply:
          tone === "siz"
            ? `Merhaba, ${tenant.name} için randevu, müsaitlik ve fiyat bilgisinde yardımcı olabilirim. Hangi hizmeti düşünüyorsunuz?`
            : `Merhaba, ${tenant.name} için randevu, müsaitlik ve fiyat bilgisinde yardımcı olabilirim. Hangi hizmeti düşünüyorsun?`,
      };
    }

    if (isOutOfScopeMessage(effectiveMessage)) {
      return {
        reply:
          tone === "siz"
            ? `Bu hatta sadece ${tenant.name} için randevu, fiyat ve işletme bilgisi desteği veriyorum.`
            : `Bu hatta sadece ${tenant.name} için randevu, fiyat ve işletme bilgisi desteği veriyorum.`,
      };
    }

    // ── Deterministic intent handling (cancel / delay) ──
    const deterministicIntent = detectDeterministicIntent(effectiveMessage);
    if (deterministicIntent?.type === "cancel") {
      const last = await getCustomerLastActiveAppointment(tenantId, customerPhone);
      if (!last) {
        return {
          reply:
            tone === "siz"
              ? "Aktif bir randevunuz görünmüyor. Yeni bir randevu almak ister misiniz?"
              : "Aktif bir randevun görünmüyor. Yeni randevu alalım mı?",
        };
      }

      const slotDateTime = formatSlotDateTimeTr(last.slot_start);
      const dateStr = slotDateTime.date || "-";
      const timeStr = slotDateTime.time || "-";

      await setSession(tenantId, customerPhone, {
        ...state,
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "iptal_onay_bekleniyor",
        extracted: {
          ...extracted,
          pending_cancel_appointment_id: last.id,
        },
        flow_type: flowType,
        message_count: messageCount,
        consecutive_misunderstandings: 0,
        chat_history: trimChatHistory([
          ...(state.chat_history || []),
          { role: "user", content: incomingMessage },
        ]),
        updated_at: new Date().toISOString(),
      });
      return {
        reply:
          tone === "siz"
            ? `${dateStr} ${timeStr} randevunuzu iptal etmek için lütfen "evet iptal" yazın.`
            : `${dateStr} ${timeStr} randevunu iptal etmem için "evet iptal" yaz.`,
      };
    }

    if (deterministicIntent?.type === "late") {
      const minutes = deterministicIntent.minutes;
      if (tenant.contact_phone) {
        await sendWhatsAppMessage({
          to: tenant.contact_phone,
          text: `${customerPhone} müşterisi ${minutes} dakika gecikeceğini bildirdi.`,
        }).catch((e) => console.error("[ai] delay notify error:", e));
      }

      await createOpsAlert({
        tenantId,
        type: "delay",
        severity: minutes >= 20 ? "high" : "medium",
        customerPhone,
        message: `${customerPhone} müşterisi ${minutes} dk gecikecek.`,
        meta: { minutes, source: "deterministic_intent" },
        dedupeKey: `delay:${tenantId}:${customerPhone.replace(/\D/g, "")}:${new Date()
          .toISOString()
          .slice(0, 13)}`,
      }).catch((e) => console.error("[ai] ops alert create error:", e));

      return {
        reply:
          tone === "siz"
            ? "Bilgiyi ustaya ilettim. Geldiğinizde program yoğunluğuna göre kısa bir bekleme olabilir."
            : "Bilgiyi ustaya ilettim. Geldiğinde program yoğunluğuna göre kısa bir bekleme olabilir.",
      };
    }

    // ── Build context ──
    const history = await getCustomerHistory(tenantId, customerPhone);
    const historySummary = formatHistoryForPrompt(history);
    const systemContext = buildSystemContext(state, historySummary);

    let systemPrompt: string;
    if (mergedConfig) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const ext = (state?.extracted || {}) as Record<string, unknown>;
      const promptContext: PromptBuilderContext = {
        today: localDateStr(today),
        tomorrow: localDateStr(tomorrow),
        currentTime: localTimeStr(today, APP_TIMEZONE),
        timeZone: APP_TIMEZONE,
        todayLabel: `${localDateStr(today)} (${today.toLocaleDateString("tr-TR", {
          weekday: "long",
          timeZone: APP_TIMEZONE,
        })})`,
        tomorrowLabel: `${localDateStr(tomorrow)} (${tomorrow.toLocaleDateString("tr-TR", {
          weekday: "long",
          timeZone: APP_TIMEZONE,
        })})`,
        availableSlots: ext.last_available_slots as string[] | undefined,
        lastAvailabilityDate: ext.last_availability_date as string | undefined,
        pendingCancelId: ext.pending_cancel_appointment_id as string | undefined,
        customerHistory: historySummary,
        misunderstandingCount: state?.consecutive_misunderstandings ?? 0,
        stateSummary: buildStateSummary(state),
      };
      systemPrompt = buildConfigSystemPrompt(mergedConfig, tenant.name, promptContext);
    } else {
      const extraPrompt =
        (bt?.config as { ai_prompt_template?: string })?.ai_prompt_template || "";
      systemPrompt =
        buildSystemPrompt(tenant.name, msgs, extraPrompt) +
        wrapContextInXml(systemContext);
    }

    if (!openai) {
      return {
        reply: "Şu an randevu alamıyorum. Lütfen daha sonra tekrar deneyin.",
      };
    }

    // ── Kademeli zeka: basit niyet → mini, karmaşık → 4o ──
    const routingIntent = await classifyIntentForRouting(effectiveMessage);
    const selectedModel = routingIntent === "complex" ? MODEL_COMPLEX : MODEL_SIMPLE;

    // ── Build OpenAI messages: state summary zaten system prompt'ta; sadece son N tur (bağlam sıkıştırma) ──
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [{ role: "system", content: systemPrompt }];

    const chatHistory = state?.chat_history || [];
    const recentTurns = chatHistory.slice(-(CONTEXT_TURNS_TO_SEND * 2));
    for (const msg of recentTurns) {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }
    openaiMessages.push({ role: "user", content: effectiveMessage });

    // ── Multi-round tool calling loop ──
    let finalReply = "";
    let sessionDeleted = false;
    const mergedSessionUpdate: Partial<ConversationState> = {};
    let promptTokens = 0;
    let completionTokens = 0;
    let llmLatencyMs = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: OpenAI.Chat.Completions.ChatCompletion;
      const llmRoundStart = Date.now();
      try {
        response = await callOpenAI(
          openaiMessages,
          round === 0 ? TOOLS : TOOLS,
          selectedModel
        );
      } catch {
        if (mergedConfig) {
          const errMsg = buildConfigMessage(mergedConfig, "system_error", {});
          if (errMsg) return { reply: errMsg };
        }
        return { reply: getProcessErrorReply(tone) };
      }
      llmLatencyMs += Date.now() - llmRoundStart;
      promptTokens += response.usage?.prompt_tokens ?? 0;
      completionTokens += response.usage?.completion_tokens ?? 0;

      const aiMessage = response.choices[0]?.message;
      if (!aiMessage) {
        const prevMis = state?.consecutive_misunderstandings ?? 0;
        if (prevMis >= 1) {
          return { reply: buildHumanEscalationMessage(tenant, tone) };
        }
        await setSession(tenantId, customerPhone, {
          ...(state || {}),
          tenant_id: tenantId,
          customer_phone: customerPhone,
          flow_type: flowType,
          extracted: state?.extracted || {},
          step: "devam",
          message_count: messageCount,
          consecutive_misunderstandings: 1,
          retry_count: (state?.retry_count ?? 0) + 1,
          window_status: "OPEN",
          last_customer_message_at: new Date().toISOString(),
          timezone: state?.timezone || APP_TIMEZONE,
          chat_history: chatHistory,
          updated_at: new Date().toISOString(),
        });
        return { reply: getMisunderstandReply(tone) };
      }

      // No tool calls → AI responded with text, we're done
      if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
        finalReply = (aiMessage.content || "").trim();
        break;
      }

      // Tool calls present → execute tools and feed results back
      const tcList = aiMessage.tool_calls as Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;

      // Config-driven: create_appointment öncesi zorunlu alan kontrolü
      let requiredFieldsReply = "";
      for (const tc of tcList) {
        if (tc.function.name !== "create_appointment") continue;
        const fnArgs = JSON.parse(tc.function.arguments || "{}");
        const combined = {
          ...(state?.extracted || {}),
          ...fnArgs,
        } as Record<string, unknown>;

        if (mergedConfig) {
          const { complete, nextQuestion } = checkRequiredFields(
            mergedConfig,
            combined
          );
          if (!complete && nextQuestion) {
            requiredFieldsReply = nextQuestion;
            break;
          }
        }

        const cn = combined.customer_name;
        if (cn === undefined || cn === null || String(cn).trim() === "") {
          requiredFieldsReply =
            tone === "siz"
              ? "Randevuyu kimin adına alalım?"
              : "Randevuyu kimin adına alayım?";
          break;
        }
      }
      if (requiredFieldsReply) {
        finalReply = requiredFieldsReply;
        break;
      }

      openaiMessages.push({
        role: "assistant" as const,
        content: aiMessage.content ?? null,
        tool_calls: tcList.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      type TemplateVars = Record<string, string>;
      const confirmationResults: TemplateVars[] = [];
      let templateReply: { key: "cancellation_by_customer" | "rescheduled"; vars: TemplateVars } | null = null;
      for (const tc of tcList) {
        const fnArgs = JSON.parse(tc.function.arguments || "{}");
        const toolExec = await executeToolCall(
          tc.function.name,
          fnArgs,
          tenantId,
          customerPhone,
          effectiveMessage,
          state,
          tenant.config_override,
          mergedConfig ?? undefined
        );

        openaiMessages.push({
          role: "tool" as const,
          tool_call_id: tc.id,
          content: JSON.stringify(toolExec.result),
        });

        if (mergedConfig && tc.function.name === "create_appointment") {
          const res = toolExec.result as { ok?: boolean; date?: string; date_readable?: string; time?: string; customer_name?: string };
          if (res.ok) {
            const serviceVal = (fnArgs.service as string) ?? (fnArgs.extra_data as Record<string, unknown>)?.service as string ?? "";
            confirmationResults.push({
              date: res.date ?? "",
              date_readable: res.date_readable ?? formatDateReadableTr(res.date ?? "", res.time),
              time: res.time ?? "",
              customer_name: res.customer_name ?? "",
              service: typeof serviceVal === "string" ? serviceVal : "",
            });
          }
        }
        if (mergedConfig && tc.function.name === "cancel_appointment") {
          const res = toolExec.result as { ok?: boolean };
          if (res.ok) {
            templateReply = { key: "cancellation_by_customer", vars: {} };
          }
        }
        if (mergedConfig && tc.function.name === "reschedule_appointment") {
          const res = toolExec.result as { ok?: boolean; new_date?: string; new_date_readable?: string; new_time?: string };
          if (res.ok && res.new_date != null) {
            templateReply = {
              key: "rescheduled",
              vars: {
                date: res.new_date ?? "",
                date_readable: res.new_date_readable ?? formatDateReadableTr(res.new_date ?? "", res.new_time),
                time: res.new_time ?? "",
              },
            };
          }
        }

        if (toolExec.sessionDeleted) sessionDeleted = true;
        if (toolExec.sessionUpdate) {
          if (toolExec.sessionUpdate.extracted) {
            mergedSessionUpdate.extracted = {
              ...(mergedSessionUpdate.extracted || {}),
              ...(toolExec.sessionUpdate.extracted as Record<string, unknown>),
            };
          }
          if (toolExec.sessionUpdate.step) {
            mergedSessionUpdate.step = toolExec.sessionUpdate.step;
          }
        }
      }

      if (mergedConfig && (confirmationResults.length > 0 || templateReply)) {
        const parts: string[] = [];
        if (confirmationResults.length > 0) {
          const combined = confirmationResults
            .map((v) => buildConfigMessage(mergedConfig, "confirmation", v))
            .filter(Boolean);
          if (combined.length) parts.push(combined.join("\n\n"));
        }
        if (templateReply) {
          const msg = buildConfigMessage(mergedConfig, templateReply.key, templateReply.vars);
          if (msg) parts.push(msg);
        }
        if (parts.length) {
          finalReply = parts.join("\n\n") || finalReply;
          break;
        }
      }
      // Loop continues → next iteration sends tool results to OpenAI
    }

    if (!finalReply) {
      if (mergedConfig) {
        const errMsg = buildConfigMessage(mergedConfig, "system_error", {});
        if (errMsg) finalReply = errMsg;
      }
      if (!finalReply) finalReply = getProcessErrorReply(tone);
    }
    finalReply = normalizeAssistantReply(finalReply);
    if (!finalReply) finalReply = getProcessErrorReply(tone);
    const metrics: ProcessMessageMetrics = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      model: selectedModel,
      llm_latency_ms: llmLatencyMs,
    };

    // ── Check for human escalation tag ──
    if (finalReply.includes(HUMAN_ESCALATION_TAG)) {
      if (mergedConfig) {
        const msg = buildConfigMessage(mergedConfig, "human_escalation", {
          contact_phone: tenant.contact_phone?.trim() ?? "",
          working_hours: tenant.working_hours_text?.trim() ?? "",
        });
        if (msg) return { reply: msg, metrics };
      }
      return { reply: buildHumanEscalationMessage(tenant, tone), metrics };
    }

    // ── Session management ──
    if (sessionDeleted) {
      await setSession(tenantId, customerPhone, {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        flow_type: flowType,
        extracted: {},
        step: "devam",
        message_count: 0,
        consecutive_misunderstandings: 0,
        retry_count: 0,
        window_status: "OPEN",
        last_customer_message_at: new Date().toISOString(),
        timezone: APP_TIMEZONE,
        chat_history: [
          { role: "user" as const, content: incomingMessage },
          { role: "assistant" as const, content: finalReply },
        ],
        updated_at: new Date().toISOString(),
      });
      return { reply: finalReply, metrics };
    }

    const updatedHistory = trimChatHistory([
      ...chatHistory,
      { role: "user" as const, content: incomingMessage },
      { role: "assistant" as const, content: finalReply },
    ]);

    await setSession(tenantId, customerPhone, {
      ...(state || {}),
      tenant_id: tenantId,
      customer_phone: customerPhone,
      flow_type: flowType,
      extracted: {
        ...(state?.extracted || {}),
        ...(mergedSessionUpdate.extracted || {}),
      },
      step:
        (mergedSessionUpdate.step as string) || state?.step || "devam",
      message_count: messageCount,
      consecutive_misunderstandings: 0,
      retry_count: 0,
      window_status: "OPEN",
      last_customer_message_at: new Date().toISOString(),
      timezone: state?.timezone || APP_TIMEZONE,
      chat_history: updatedHistory,
      updated_at: new Date().toISOString(),
    });

    return { reply: finalReply, metrics };
  } catch (err) {
    console.error("[ai] processMessage:", err);
    return {
      reply: "Bir şeyler ters gitti, biraz sonra tekrar dener misin?",
    };
  }
}
