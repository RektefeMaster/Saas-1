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
import {
  getCustomerHistory,
  formatHistoryForPrompt,
  getCustomerUpcomingAppointments,
  formatUpcomingForPrompt,
} from "@/services/customerHistory.service";
import {
  formatCrmProfileForPrompt,
  getCrmCustomer,
} from "@/services/crmCustomer.service";
import {
  touchLeadContact,
  getLeadMemory,
  formatLeadMemoryForPrompt,
} from "@/services/leadMemory.service";
import {
  getCustomerLastActiveAppointment,
  cancelAppointment,
} from "@/services/cancellation.service";
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
import { getSectorProfile } from "@/services/sectorProfile.service";
import {
  detectConsentIntent,
  setMarketingOptOut,
} from "@/services/marketingConsent.service";
import { phonesMatch } from "@/lib/phone";
import {
  applyCriticalGuardrails,
  type ToolEvidence,
} from "./critical-guardrails";
import {
  evaluateHandoff,
  buildHandoffSummarySnapshot,
} from "@/services/handoffPolicy.service";
import {
  applyHandoffToConversation,
  ensureConversation,
  getConversationAutomationMode,
  isAutomationSoftPaused,
  linkConversationCustomer,
  resumeConversationToAi,
} from "@/services/conversation.service";
import {
  formatKnowledgeForPrompt,
  listApprovedKnowledgeForBot,
} from "@/services/tenantKnowledge.service";
import { emitTurnCrmEvents } from "./crm-events";
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
  CONTEXT_TURNS_TO_SEND,
  MAX_TOOL_ROUNDS,
  APP_TIMEZONE,
  isValidStep,
  MODEL_SIMPLE,
  PENDING_CANCEL_TTL_MS,
} from "./constants";
import {
  normalizeHalfHourRequest,
  normalizeAssistantReply,
} from "./normalizers";
import {
  isAskNameIntent,
  isCancelConfirmation,
  isCancelReject,
  isSoftAffirmation,
  isAbusiveMessage,
  isGreetingOrSmallTalkOnly,
  isEscalationQuestion,
  isHumanEscalationRequest,
  detectGlobalInterruptIntent,
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
  getSelectedServiceFromExtracted,
  formatSlotDateTimeTr,
} from "./context-builder";
import {
  formatDateReadableTr,
  getKnownCustomerName,
  trimChatHistory,
} from "./helpers";
import { TOOLS } from "./tools/definitions";
import { executeToolCall } from "./tools/executor";
import { validateToolArgs } from "./tools/tool-schemas";
import { getValidNextStep } from "../fsm/bot-state-machine";
import { withRetry } from "@/lib/retry";
import { isLiveHumanTakeoverReason } from "@/lib/human-takeover";
import { tryHandleReview } from "./review-flow";

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
  serviceSlug?: string,
  staffId?: string
): Promise<{
  available: string[];
  booked: string[];
  blocked?: boolean;
  noSchedule?: boolean;
  closed?: boolean;
}> {
  const daily = await getDailyAvailability(tenantId, dateStr, {
    configOverride,
    staffId,
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
  serviceSlug?: string | null,
  staffId?: string | null
): Promise<{ ok: boolean; id?: string; error?: string; suggested_time?: string }> {
  try {
    const result = await reserveAppointment({
      tenantId,
      customerPhone,
      date: dateStr,
      time: timeStr,
      staffId: staffId || null,
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

/**
 * Reasoning modellerinde (gpt-5.x ailesi) chat/completions üzerinden function
 * tool kullanmak için reasoning_effort "none" olmalı; aksi halde API 400 döner:
 * "Function tools with reasoning_effort are not supported ... set reasoning_effort to 'none'".
 * Farklı bir davranış istenirse OPENAI_REASONING_EFFORT ile ayarlanabilir.
 */
const REASONING_EFFORT = (process.env.OPENAI_REASONING_EFFORT?.trim() ||
  "none") as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming["reasoning_effort"];

const CHAT_TEMPERATURE = (() => {
  const raw = Number(process.env.OPENAI_TEMPERATURE);
  return Number.isFinite(raw) ? raw : 0.4;
})();

function buildChatParams(
  model: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  options?: { withTemperature?: boolean }
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  return {
    model,
    messages,
    ...(options?.withTemperature === false ? {} : { temperature: CHAT_TEMPERATURE }),
    ...(REASONING_EFFORT ? { reasoning_effort: REASONING_EFFORT } : {}),
    ...(tools ? { tools, tool_choice: "auto" as const } : {}),
  };
}

/** Model bu parametreyi desteklemiyor mu? (400 mesajından anlaşılır) */
function mentionsUnsupportedTemperature(message: string): boolean {
  return /temperature/i.test(message) && /unsupported|not support|does not support/i.test(message);
}

async function callOpenAI(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[],
  model: string = MODEL_SIMPLE
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return withRetry(
    async () => {
      try {
        return await openai!.chat.completions.create(
          buildChatParams(model, messages, tools)
        );
      } catch (err: unknown) {
        const e = err as { status?: number; error?: { message?: string }; message?: string };
        const errorMessage = e?.error?.message ?? e?.message ?? "";
        console.error("[ai] OpenAI error", "status:", e?.status, "message:", errorMessage);

        // Bazı modeller temperature kabul etmiyor; parametresiz tek bir tekrar dene.
        if (e?.status === 400 && mentionsUnsupportedTemperature(errorMessage)) {
          return await openai!.chat.completions.create(
            buildChatParams(model, messages, tools, { withTemperature: false })
          );
        }

        if (e?.status === 429) {
          await new Promise((r) => setTimeout(r, 1500));
          return await openai!.chat.completions.create(
            buildChatParams(model, messages, tools)
          );
        }
        throw err;
      }
    },
    { retries: 3 }
  );
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
  incomingMessage: string,
  options?: { existingSession?: ConversationState | null; messageId?: string | null }
): Promise<{ reply: string; stateReset?: boolean; metrics?: ProcessMessageMetrics }> {
  try {
    const [tenant, sessionPrefetch, blocked] = await Promise.all([
      getTenantWithBusinessType(tenantId),
      options && "existingSession" in options
        ? Promise.resolve(options.existingSession ?? null)
        : getSession(tenantId, customerPhone),
      isCustomerBlocked(tenantId, customerPhone),
    ]);

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
    const flowType = (bt?.config?.flow_type as FlowType) || "appointment";
    // Sektör profili: ton (esnaf ağzı) ve sağlık/operasyon kuralları buradan.
    const sector = getSectorProfile(bt?.slug, bt?.name);

    // ── Oturum başlatma (tek yerde, her erken dönüşten ÖNCE) ───────────────────
    let state: ConversationState | null = sessionPrefetch;

    if (state && !isValidStep(state.step)) {
      console.warn("[session] Geçersiz step, sıfırlanıyor:", state.step);
      await deleteSession(tenantId, customerPhone);
      state = null;
    }

    // tenant_bulundu adımı sadece tenant bağlama içindir; müşteriye her seferinde
    // "hoş geldiniz" dönmemek için konuşmayı "devam" moduna geçir.
    if (state?.step === "tenant_bulundu") {
      state = { ...state, step: "devam" };
    }

    if (!state) {
      state = {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "devam",
        extracted: {},
        flow_type: flowType,
        message_count: 0,
        consecutive_misunderstandings: 0,
        retry_count: 0,
        window_status: "OPEN",
        last_customer_message_at: new Date().toISOString(),
        timezone: APP_TIMEZONE,
        chat_history: [],
        updated_at: new Date().toISOString(),
      };
    }

    const messageCount = (state.message_count ?? 0) + 1;
    const isFirstMessage = messageCount === 1 && (state.chat_history?.length ?? 0) === 0;

    // Randevu alsın almasın konuşan herkes CRM'e lead olarak düşer.
    // Kara listedekiler hariç: onlar pazarlama havuzuna girmemeli.
    // Bloklamaz: hata olursa sohbet normal devam eder.
    if (!blocked) {
      void touchLeadContact(tenantId, customerPhone, {
        customerName:
          ((state.extracted as { customer_name?: string } | undefined)?.customer_name) ?? null,
        newConversation: isFirstMessage,
      }).catch((e) => console.warn("[ai] lead touch:", e));
    }

    /**
     * Tek çıkış noktası: cevabı döndürmeden önce oturumu ve sohbet geçmişini yazar.
     * Eskiden ~12 erken `return` geçmişe hiç yazmıyordu; bot o turları yaşanmamış
     * sayıp kendini tekrar ediyor ve söylediklerini inkâr ediyordu.
     */
    const persistAndReply = async (
      replyText: string,
      patch: Partial<ConversationState> = {},
      options: { recordHistory?: boolean } = {}
    ): Promise<{ reply: string }> => {
      const nowIso = new Date().toISOString();
      const base = state as ConversationState;
      const history = base.chat_history || [];
      const nextHistory =
        options.recordHistory === false
          ? history
          : trimChatHistory([
              ...history,
              { role: "user" as const, content: incomingMessage },
              { role: "assistant" as const, content: replyText },
            ]);

      const nextState: ConversationState = {
        ...base,
        ...patch,
        tenant_id: tenantId,
        customer_phone: customerPhone,
        flow_type: base.flow_type || flowType,
        extracted: patch.extracted ?? base.extracted ?? {},
        step: patch.step ?? base.step ?? "devam",
        message_count: messageCount,
        window_status: "OPEN",
        last_customer_message_at: nowIso,
        timezone: base.timezone || APP_TIMEZONE,
        chat_history: nextHistory,
        updated_at: nowIso,
      };
      state = nextState;
      await setSession(tenantId, customerPhone, nextState);
      return { reply: replyText };
    };

    // Pazarlama izni: "DUR" / "BAŞLA". Tam eşleşme arar, LLM'e gitmez.
    // Randevu hatırlatmaları bundan etkilenmez (işlemsel mesaj).
    const consentIntent = detectConsentIntent(effectiveMessage);
    if (consentIntent) {
      const optOut = consentIntent === "opt_out";
      const consentResult = await setMarketingOptOut(tenantId, customerPhone, optOut);
      if (!consentResult.ok && consentResult.error !== "migration_missing") {
        console.warn("[ai] opt-out kaydedilemedi:", consentResult.error);
      }
      return persistAndReply(
        optOut
          ? "Tamam, bundan sonra kampanya mesajı göndermeyeceğim. Randevu hatırlatmaların devam eder. Tekrar açmak istersen \"BAŞLA\" yaz."
          : "Tamam, kampanya mesajlarını tekrar açtım."
      );
    }

    // Soft-pause BEFORE handoff — otherwise sticky pause re-escalates every turn.
    {
      const pausedConv = await ensureConversation({
        tenantId,
        externalUserId: customerPhone,
      });
      const pgMode =
        pausedConv?.automation_mode ||
        (await getConversationAutomationMode(tenantId, customerPhone));
      const softPaused = isAutomationSoftPaused(pgMode);

      if (softPaused) {
        if (isLiveHumanTakeoverReason(state.pause_reason)) {
          return persistAndReply(
            "Bu sohbet şu an insan destek ekibinde. Botu yalnızca yönetici yeniden devreye alabilir.",
            {},
            { recordHistory: false }
          );
        }
        const pausedAt = pausedConv?.automation_mode_updated_at
          ? new Date(pausedConv.automation_mode_updated_at).getTime()
          : state.updated_at
            ? new Date(state.updated_at).getTime()
            : 0;
        const inactiveMs = Date.now() - pausedAt;
        const wantsBotResume =
          /\bbot(?:u)?\s+devam(?:\s+ettir)?\b|\bgeri\s+d[öo]n(?:ün)?\b/i.test(
            effectiveMessage
          );
        const autoResume =
          Number.isFinite(pausedAt) &&
          pausedAt > 0 &&
          inactiveMs >= 2 * 60 * 60 * 1000;
        if (!wantsBotResume && !autoResume) {
          if (state.step !== "PAUSED_FOR_HUMAN") {
            state = {
              ...state,
              step: "PAUSED_FOR_HUMAN",
              pause_reason: state.pause_reason || "automation_paused",
              updated_at: new Date().toISOString(),
            };
            await setSession(tenantId, customerPhone, state);
          }
          return persistAndReply(
            tone === "siz"
              ? "Bu sohbet şu an insan desteğinde. Botu tekrar devreye almak için \"bot devam\" yazabilirsiniz."
              : "Bu sohbet şu an insan desteğinde. Botu tekrar devreye almak için \"bot devam\" yazabilirsin.",
            { step: "PAUSED_FOR_HUMAN" },
            { recordHistory: false }
          );
        }
        if (pausedConv?.id && pausedConv.automation_mode === "AUTOMATION_PAUSED") {
          const resumed = await resumeConversationToAi({
            actor: { kind: "admin", canAccessAllTenants: true },
            tenantId,
            conversationId: pausedConv.id,
            expectedVersion: pausedConv.version,
          }).catch((err) => {
            console.warn("[ai] bot-resume PG clear failed", err);
            return null;
          });
          if (!resumed || resumed.automation_mode !== "AI_ACTIVE") {
            return persistAndReply(
              tone === "siz"
                ? "Botu henüz yeniden açamadım. Lütfen biraz sonra \"bot devam\" yazın veya ekibimizi bekleyin."
                : "Botu henüz yeniden açamadım. Lütfen biraz sonra \"bot devam\" yaz veya ekibi bekle.",
              { step: "PAUSED_FOR_HUMAN" },
              { recordHistory: false }
            );
          }
        }
        state = {
          ...state,
          step: "RECOVERY_CHECK",
          pause_reason: null,
          updated_at: new Date().toISOString(),
        };
        await setSession(tenantId, customerPhone, state);
      }
    }

    // Handoff policy (human request + crisis / medical risk, etc.)
    {
      const handoffDecision = evaluateHandoff({
        humanRequested: isHumanEscalationRequest(effectiveMessage),
        misunderstandingCount: state?.consecutive_misunderstandings ?? 0,
        isAbusive: isAbusiveMessage(effectiveMessage),
        healthcare: sector.healthcare,
        messageText: effectiveMessage,
      });
      if (handoffDecision.shouldHandoff && handoffDecision.primaryReason) {
        let escalationReply = "";
        if (mergedConfig) {
          escalationReply = buildConfigMessage(
            mergedConfig,
            "human_escalation",
            {
              contact_phone: tenant.contact_phone?.trim() ?? "",
              working_hours: tenant.working_hours_text?.trim() ?? "",
            },
            tenant.name
          );
        }
        if (!escalationReply) {
          if (handoffDecision.primaryReason === "MEDICAL_RISK") {
            escalationReply =
              tone === "siz"
                ? "Bu durumda sağlık değerlendirmesi gerekir; lütfen kliniğimizi arayın veya acilse 112'yi arayın. Sizi ekibimize de iletiyorum."
                : "Bu durumda sağlık değerlendirmesi gerekir; lütfen kliniğimizi ara veya acilse 112'yi ara. Seni ekibimize de iletiyorum.";
          } else {
            escalationReply = buildHumanEscalationMessage(tenant, tone);
          }
        }
        const selected = getSelectedServiceFromExtracted(
          (state?.extracted || {}) as Record<string, unknown>
        );
        const snapshot = buildHandoffSummarySnapshot({
          intent: handoffDecision.primaryReason,
          serviceName: selected.name || null,
          serviceId: selected.slug || null,
          collectedFields: (state?.extracted || {}) as Record<string, unknown>,
          decision: handoffDecision,
          plainSummary: `Aktarım: ${handoffDecision.primaryReason}`,
        });
        // Worker already touched inbound; do NOT upsert-inbound again (unread++).
        const conv = await ensureConversation({
          tenantId,
          externalUserId: customerPhone,
        });
        let handoffOk = false;
        if (conv?.id) {
          const handed = await applyHandoffToConversation({
            tenantId,
            conversationId: conv.id,
            reason: handoffDecision.primaryReason,
            summarySnapshot: snapshot,
            priority: handoffDecision.priority,
          }).catch((err) => {
            console.warn("[ai] handoff conversation update failed", err);
            return null;
          });
          handoffOk = Boolean(
            handed &&
              (handed.automation_mode === "AUTOMATION_PAUSED" ||
                handed.automation_mode === "HUMAN_ACTIVE")
          );
        }
        void emitTurnCrmEvents({
          tenantId,
          customerPhone,
          messageText: effectiveMessage,
          customerName:
            ((state?.extracted as { customer_name?: string } | undefined)
              ?.customer_name as string) || null,
          handoffReason: handoffDecision.primaryReason,
          messageId: options?.messageId,
        })
          .then((customerId) => {
            if (customerId && conv?.id) {
              return linkConversationCustomer({
                tenantId,
                conversationId: conv.id,
                customerId,
              });
            }
            return undefined;
          })
          .catch(() => undefined);

        // Always escalate to the customer. Pause Redis only when Postgres landed
        // (prevents Redis PAUSED + PG AI_ACTIVE split-brain).
        if (!handoffOk) {
          console.warn("[ai] handoff PG failed — escalate without Redis pause");
          return persistAndReply(escalationReply);
        }
        return persistAndReply(escalationReply, {
          step: "PAUSED_FOR_HUMAN",
          pause_reason: handoffDecision.primaryReason.toLowerCase(),
        });
      }
    }

    if (blocked) {
      return persistAndReply(
        tone === "siz"
          ? "Üzgünüz, şu an randevu hizmeti veremiyoruz. Lütfen işletmeyi doğrudan arayın."
          : "Üzgünüm, şu an randevu hizmeti veremiyorum. Lütfen işletmeyi doğrudan ara.",
        {},
        { recordHistory: false }
      );
    }

    const reviewResult = await tryHandleReview(
      tenantId,
      customerPhone,
      effectiveMessage
    );
    if (reviewResult.handled && reviewResult.reply) {
      return persistAndReply(reviewResult.reply);
    }

    const globalInterrupt = detectGlobalInterruptIntent(effectiveMessage);
    if (globalInterrupt === "RESET" || globalInterrupt === "CANCEL_FLOW") {
      const replyText =
        tone === "siz"
          ? "Tamam, mevcut akışı kapattım. İsterseniz baştan başlayabiliriz."
          : "Tamam, mevcut akışı kapattım. İstersen baştan başlayabiliriz.";
      return persistAndReply(replyText, {
        step: "devam",
        extracted: {},
        retry_count: 0,
        consecutive_misunderstandings: 0,
      });
    }
    if (globalInterrupt === "ASK_FAQ") {
      state = {
        ...state,
        step: "devam",
      };
    }

    // retry_count: anlaşılmayan mesaj sayacı. Tam otonomi için limit yükseltildi (3→8).
    // 8 kez üst üste anlaşılamazsa yine insan devralmıyor; bot "Farklı bir şekilde sorabilir misin?" ile devam eder.
    if ((state.retry_count ?? 0) >= 8) {
      const softReply =
        tone === "siz"
          ? "Tam anlamadım. İsterseniz 'randevu almak istiyorum', 'yarın müsait misiniz?' veya 'fiyatlar ne?' gibi yazabilirsiniz."
          : "Tam anlamadım. İstersen 'randevu almak istiyorum', 'yarın müsait misin?' veya 'fiyatlar ne?' gibi yazabilirsin.";
      return persistAndReply(softReply, {
        step: "devam",
        retry_count: 0,
        consecutive_misunderstandings: 0,
      });
    }

    const extracted = (state.extracted || {}) as Record<string, unknown>;
    const pendingCancelRaw = extracted.pending_cancel_appointment_id as string | undefined;
    const pendingCancelSetAt = Number(extracted.pending_cancel_set_at ?? 0);
    const pendingCancelExpired =
      Boolean(pendingCancelRaw) &&
      (!Number.isFinite(pendingCancelSetAt) ||
        pendingCancelSetAt <= 0 ||
        Date.now() - pendingCancelSetAt > PENDING_CANCEL_TTL_MS);

    if (pendingCancelExpired) {
      // Süresi geçen iptal beklemesi konuşmayı rehin almasın.
      state = {
        ...state,
        step: state.step === "iptal_onay_bekleniyor" ? "devam" : state.step,
        extracted: {
          ...extracted,
          pending_cancel_appointment_id: null,
          pending_cancel_set_at: null,
        },
      };
    }

    const pendingCancelId = pendingCancelExpired ? undefined : pendingCancelRaw;

    if (pendingCancelId) {
      // Yumuşak onay ("evet"/"tamam") burada geçerli: bu bekleme yalnızca AÇIK
      // iptal talebiyle başlatılıyor, artık masum bir sorgudan doğmuyor.
      const cancelConfirmed =
        isCancelConfirmation(effectiveMessage) || isSoftAffirmation(effectiveMessage);
      if (cancelConfirmed) {
        const { data: pendingApt } = await supabase
          .from("appointments")
          .select("id, slot_start, customer_phone")
          .eq("id", pendingCancelId)
          .eq("tenant_id", tenantId)
          .in("status", ["confirmed", "pending"])
          .maybeSingle();

        if (!pendingApt || !phonesMatch(customerPhone, pendingApt.customer_phone)) {
          return persistAndReply(
            tone === "siz"
              ? "İptal bekleyen aktif randevu bulunamadı. Yeni bir randevu planlayabiliriz."
              : "İptal bekleyen aktif randevu görünmüyor. Yeni randevu planlayalım mı?",
            {
              step: "devam",
              extracted: {
                ...extracted,
                pending_cancel_appointment_id: null,
                pending_cancel_set_at: null,
              },
            }
          );
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
          // Bayrağı temizle: aksi halde müşteri sonsuza kadar iptal onayı
          // ekranında kilitli kalıyordu.
          const contactPhone = tenant.contact_phone?.trim();
          return persistAndReply(
            (tone === "siz"
              ? `İptal için randevu saatine en az ${cancellationHrs} saat kala bildirmeniz gerekiyor, o yüzden buradan iptal edemiyorum.`
              : `İptal için randevu saatine en az ${cancellationHrs} saat kala haber vermen gerekiyor, o yüzden buradan iptal edemiyorum.`) +
              (contactPhone
                ? ` İşletmeyi doğrudan arayabilirsin: ${contactPhone}`
                : ""),
            {
              step: "devam",
              extracted: {
                ...extracted,
                pending_cancel_appointment_id: null,
                pending_cancel_set_at: null,
              },
            }
          );
        }

        const cancelResult = await cancelAppointment({
          tenantId,
          appointmentId: pendingCancelId,
          cancelledBy: "customer",
          customerPhone,
          reason: "Müşteri onaylı iptal",
        });

        if (!cancelResult.ok) {
          return persistAndReply(
            tone === "siz"
              ? "İptal işlemi şu an tamamlanamadı. Lütfen tekrar deneyin."
              : "İptal işlemi şu an tamamlanamadı, tekrar dener misin?"
          );
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

        return persistAndReply(
          tone === "siz"
            ? "Randevunuzu iptal ettim. İsterseniz yeni bir saat planlayalım."
            : "Randevunu iptal ettim. İstersen yeni bir saat planlayalım.",
          {
            step: "devam",
            extracted: {
              ...extracted,
              pending_cancel_appointment_id: null,
              pending_cancel_set_at: null,
            },
          }
        );
      }

      if (isCancelReject(effectiveMessage)) {
        return persistAndReply(
          tone === "siz"
            ? "İptal isteğinizi kapattım. Randevunuz aktif olarak duruyor."
            : "Tamam, iptali kapattım. Randevun aktif olarak duruyor.",
          {
            step: "devam",
            extracted: {
              ...extracted,
              pending_cancel_appointment_id: null,
              pending_cancel_set_at: null,
            },
          }
        );
      }

      // Onay da ret de değil → müşteri konuyu değiştirmiş olabilir. Eskiden burada
      // "evet iptal yaz" duvarı vardı ve konuşma kilitleniyordu. Artık mesaj normal
      // akışa devam eder; bekleyen iptal bağlam olarak prompt'a gider ve TTL ile düşer.
    }

    if (isEscalationQuestion(effectiveMessage)) {
      return persistAndReply(
        tone === "siz"
          ? "Az önce burada çözemediğim bir konuda insan desteği önermiştim. İsterseniz randevu, fiyat veya müsaitlik işlemlerine burada devam edebiliriz."
          : "Az önce burada çözemediğim bir konuda insan desteği önermiştim. İstersen randevu, fiyat veya müsaitlik işlemlerine burada devam edebiliriz."
      );
    }

    if (isAskNameIntent(effectiveMessage)) {
      const knownName = await getKnownCustomerName(tenantId, customerPhone, state);
      if (knownName) {
        return persistAndReply(
          tone === "siz"
            ? `Sizi ${knownName} adıyla kayıtlı görüyorum.`
            : `Seni ${knownName} adıyla kayıtlı görüyorum.`,
          { extracted: { ...extracted, customer_name: knownName } }
        );
      }
      return persistAndReply(
        tone === "siz"
          ? "Ad bilginizi bu konuşmada henüz almadım. Adınızı yazarsanız kaydedebilirim."
          : "Ad bilgisini henüz almadım. Adını yazarsan kaydedeyim."
      );
    }

    if (isAbusiveMessage(effectiveMessage)) {
      return persistAndReply(
        tone === "siz"
          ? "Hakaret içeren mesajlarda devam edemiyorum. Randevu veya işletme bilgisi için yardımcı olabilirim."
          : "Hakaret içeren mesajlarda devam edemiyorum. Randevu veya işletme bilgisi için yardımcı olabilirim.",
        {},
        { recordHistory: false }
      );
    }

    // Sadece ilk mesaj tamamen selamsa sabit karşılama gönder. Eskiden içinde
    // gerçek talep olan her selamlı mesaj ("merhaba, yarın yer var mı?") burada
    // kesiliyor ve talep tamamen düşüyordu.
    if (isFirstMessage && isGreetingOrSmallTalkOnly(effectiveMessage)) {
      const welcomeRaw = msgs.welcome;
      const welcomeStr = Array.isArray(welcomeRaw) ? welcomeRaw[0] ?? "" : (welcomeRaw ?? "");
      const welcomeText = welcomeStr
        .replace(/\{tenant_name\}/g, tenant.name)
        .replace(/\{işletme_adınız\}/g, tenant.name);
      if (welcomeText.trim()) return persistAndReply(welcomeText);
    }

    // NOT: Pazarlık ve "kapsam dışı" mesajları artık burada kesilmiyor.
    // Fiyat politikası ve kapsam kuralı sistem promptunda tanımlı; bu konuları
    // LLM doğal dille yönetiyor (keyword listeleri gerçek talepleri yiyordu).

    // ── Deterministic intent handling (cancel / delay) ──
    const deterministicIntent = detectDeterministicIntent(effectiveMessage);
    if (deterministicIntent?.type === "cancel") {
      const last = await getCustomerLastActiveAppointment(tenantId, customerPhone);
      if (!last) {
        return persistAndReply(
          tone === "siz"
            ? "Aktif bir randevunuz görünmüyor. Yeni bir randevu almak ister misiniz?"
            : "Aktif bir randevun görünmüyor. Yeni randevu alalım mı?"
        );
      }

      const slotDateTime = formatSlotDateTimeTr(last.slot_start);
      const dateStr = slotDateTime.date || "-";
      const timeStr = slotDateTime.time || "-";

      return persistAndReply(
        tone === "siz"
          ? `${dateStr} ${timeStr} randevunuz var. İptal edeyim mi? Onaylarsanız "evet iptal" yazmanız yeterli.`
          : `${dateStr} ${timeStr} randevun var. İptal edeyim mi? Onaylıyorsan "evet iptal" yaz.`,
        {
          step: "iptal_onay_bekleniyor",
          extracted: {
            ...extracted,
            pending_cancel_appointment_id: last.id,
            pending_cancel_set_at: Date.now(),
          },
          consecutive_misunderstandings: 0,
        }
      );
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

      // "usta" her sektörde uygun değil; hitap sektör profilinden gelir.
      return persistAndReply(
        tone === "siz"
          ? `Bilgiyi ${sector.staffNoun} ilettim. Geldiğinizde program yoğunluğuna göre kısa bir bekleme olabilir.`
          : `Bilgiyi ${sector.staffNoun} ilettim. Geldiğinde program yoğunluğuna göre kısa bir bekleme olabilir.`
      );
    }

    // ── Build context ──
    const [history, customerProfile, leadMemory, upcoming, knowledgeEntries] =
      await Promise.all([
        getCustomerHistory(tenantId, customerPhone),
        getCrmCustomer(tenantId, customerPhone),
        getLeadMemory(tenantId, customerPhone),
        getCustomerUpcomingAppointments(tenantId, customerPhone),
        listApprovedKnowledgeForBot(tenantId),
      ]);
    const historySummary = formatHistoryForPrompt(history);
    const leadMemoryText = formatLeadMemoryForPrompt(leadMemory);
    const upcomingText = formatUpcomingForPrompt(upcoming);
    const crmProfileText = formatCrmProfileForPrompt(customerProfile);
    const knowledgeText = formatKnowledgeForPrompt(knowledgeEntries);

    const selectedForEvents = getSelectedServiceFromExtracted(
      (state?.extracted || {}) as Record<string, unknown>
    );
    void emitTurnCrmEvents({
      tenantId,
      customerPhone,
      messageText: effectiveMessage,
      customerName:
        customerProfile?.customer_name ||
        ((state?.extracted as { customer_name?: string } | undefined)
          ?.customer_name as string) ||
        null,
      serviceSelected: Boolean(selectedForEvents.slug),
      messageId: options?.messageId,
    })
      .then(async (customerId) => {
        if (!customerId) return;
        const conv = await ensureConversation({
          tenantId,
          externalUserId: customerPhone,
        });
        if (conv?.id) {
          await linkConversationCustomer({
            tenantId,
            conversationId: conv.id,
            customerId,
          });
        }
      })
      .catch(() => undefined);

    if (customerProfile?.customer_name && !(state?.extracted as { customer_name?: string })?.customer_name) {
      const ext = (state?.extracted || {}) as Record<string, unknown>;
      state = {
        ...(state || {}),
        extracted: { ...ext, customer_name: customerProfile.customer_name },
      } as ConversationState;
      await setSession(tenantId, customerPhone, { ...state, updated_at: new Date().toISOString() });
    }

    const systemContext = buildSystemContext(
      state,
      historySummary,
      effectiveMessage,
      customerProfile,
      leadMemoryText,
      upcomingText,
      crmProfileText
    );

    let systemPrompt: string;
    if (mergedConfig) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const ext = (state?.extracted || {}) as Record<string, unknown>;
      const selectedService = getSelectedServiceFromExtracted(ext);
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
        selectedServiceSlug: selectedService.slug,
        selectedServiceName: selectedService.name,
        pendingCancelId: ext.pending_cancel_appointment_id as string | undefined,
        customerHistory: historySummary,
        upcomingAppointments: upcomingText,
        crmProfile: crmProfileText,
        leadMemory: leadMemoryText,
        misunderstandingCount: state?.consecutive_misunderstandings ?? 0,
        stateSummary: buildStateSummary(state),
        sector,
      };
      systemPrompt = buildConfigSystemPrompt(mergedConfig, tenant.name, promptContext);
    } else {
      const extraPrompt =
        (bt?.config as { ai_prompt_template?: string })?.ai_prompt_template || "";
      systemPrompt =
        buildSystemPrompt(tenant.name, msgs, extraPrompt, sector) +
        wrapContextInXml(systemContext);
    }
    if (knowledgeText) {
      systemPrompt = `${systemPrompt}\n\n${knowledgeText}`;
    }

    if (!openai) {
      return {
        reply: "Şu an randevu alamıyorum. Lütfen daha sonra tekrar deneyin.",
      };
    }

    // Tek model: gpt-5.6-luna. Zeka artışı prompt/tool ile.
    const selectedModel = MODEL_SIMPLE;

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
    const toolEvidence: ToolEvidence[] = [];
    type TemplateVars = Record<string, string>;
    // Döngü DIŞINDA toplanır: onay şablonu üretildiği anda break edilirse
    // modelin sonraki tool çağrıları (örn. ikinci kişinin randevusu) hiç çalışmıyordu.
    const confirmationResults: TemplateVars[] = [];
    let templateReply:
      | { key: "cancellation_by_customer" | "rescheduled"; vars: TemplateVars }
      | null = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: OpenAI.Chat.Completions.ChatCompletion;
      const llmRoundStart = Date.now();
      try {
        response = await callOpenAI(
          openaiMessages,
          // Keep tools available every round so multi-step tool loops remain valid.
          TOOLS,
          selectedModel
        );
      } catch {
        let errMsg = "";
        if (mergedConfig) {
          errMsg = buildConfigMessage(mergedConfig, "system_error", {}, tenant.name);
        }
        return persistAndReply(errMsg || getProcessErrorReply(tone), {}, {
          recordHistory: false,
        });
      }
      llmLatencyMs += Date.now() - llmRoundStart;
      promptTokens += response.usage?.prompt_tokens ?? 0;
      completionTokens += response.usage?.completion_tokens ?? 0;

      const aiMessage = response.choices[0]?.message;
      if (!aiMessage) {
        const prevMis = state?.consecutive_misunderstandings ?? 0;
        const nextMis = prevMis + 1;
        if (nextMis >= 2) {
          const esc = buildHumanEscalationMessage(tenant, tone);
          const conv = await ensureConversation({
            tenantId,
            externalUserId: customerPhone,
          });
          if (conv?.id) {
            await applyHandoffToConversation({
              tenantId,
              conversationId: conv.id,
              reason: "REPEATED_MISUNDERSTANDING",
              priority: "high",
            }).catch(() => undefined);
          }
          return persistAndReply(esc, {
            step: "PAUSED_FOR_HUMAN",
            pause_reason: "repeated_misunderstanding",
            consecutive_misunderstandings: nextMis,
          });
        }
        return persistAndReply(getMisunderstandReply(tone), {
          step: "devam",
          consecutive_misunderstandings: nextMis,
          retry_count: (state?.retry_count ?? 0) + 1,
        });
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
        let fnArgs: Record<string, unknown>;
        try {
          fnArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          fnArgs = {};
        }
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

      for (const tc of tcList) {
        let fnArgs: Record<string, unknown>;
        try {
          fnArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          fnArgs = {};
        }
        const validation = validateToolArgs(tc.function.name, fnArgs);
        if (!validation.success) {
          openaiMessages.push({
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: validation.error }),
          });
          continue;
        }
        const toolExec = await executeToolCall(
          tc.function.name,
          validation.data,
          tenantId,
          customerPhone,
          effectiveMessage,
          state,
          tenant.config_override,
          mergedConfig ?? undefined
        );

        const toolOk = toolExec.result?.ok !== false && !toolExec.result?.error;
        toolEvidence.push({
          name: tc.function.name,
          ok: Boolean(toolOk),
          result: toolExec.result || {},
        });

        openaiMessages.push({
          role: "tool" as const,
          tool_call_id: tc.id,
          content: JSON.stringify(toolExec.result),
        });

        if (mergedConfig && tc.function.name === "create_appointment") {
          const res = toolExec.result as { ok?: boolean; date?: string; date_readable?: string; time?: string; customer_name?: string };
          if (res.ok) {
            const serviceVal =
              (fnArgs.service_slug as string) ??
              ((fnArgs.extra_data as Record<string, unknown>)?.service_slug as string) ??
              "";
            const readableWithTime =
              res.date_readable ?? formatDateReadableTr(res.date ?? "", res.time);
            // {date} SAAT İÇERMEZ. Şablonlar "{date} saat {time}de bekliyoruz"
            // biçiminde; saatli okunabilir forma bağlanınca müşteriye
            // "yarın 1 Ağustosta saat 15.00'a saat 15:00de bekliyoruz" gidiyordu.
            const readableDateOnly = formatDateReadableTr(res.date ?? "");
            confirmationResults.push({
              date: readableDateOnly || res.date || "",
              date_iso: res.date ?? "",
              date_readable: readableWithTime,
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
            const readableWithTime =
              res.new_date_readable ??
              formatDateReadableTr(res.new_date ?? "", res.new_time);
            const readableDateOnly = formatDateReadableTr(res.new_date ?? "");
            templateReply = {
              key: "rescheduled",
              vars: {
                // Saat ayrı {time} ile geliyor; {date} saatsiz olmalı.
                date: readableDateOnly || res.new_date || "",
                date_iso: res.new_date ?? "",
                date_readable: readableWithTime,
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

      // Loop continues → next iteration sends tool results to OpenAI
    }

    // Tool döngüsü bittikten SONRA şablon cevabı kurulur; böylece model aynı turda
    // birden fazla randevu/işlem yapabiliyor ve hiçbiri düşmüyor.
    if (mergedConfig && (confirmationResults.length > 0 || templateReply)) {
      const parts: string[] = [];
      if (confirmationResults.length > 0) {
        const combined = confirmationResults
          .map((v) => buildConfigMessage(mergedConfig, "confirmation", v, tenant.name))
          .filter(Boolean);
        if (combined.length) parts.push(combined.join("\n\n"));
      }
      if (templateReply) {
        const msg = buildConfigMessage(
          mergedConfig,
          templateReply.key,
          templateReply.vars,
          tenant.name
        );
        if (msg) parts.push(msg);
      }
      if (parts.length) finalReply = parts.join("\n\n");
    }

    // Yeni randevu alındıysa/ertelendiyse bekleyen iptal onayı anlamını yitirir.
    if (confirmationResults.length > 0 || templateReply) {
      mergedSessionUpdate.extracted = {
        ...(mergedSessionUpdate.extracted || {}),
        pending_cancel_appointment_id: null,
        pending_cancel_set_at: null,
      };
    }

    // Tool döngüsü tükendiği halde model hâlâ tool çağırıyorsa elimizde metin
    // kalmıyordu ve müşteriye "sistem hatası" gidiyordu. Son bir kez TOOL'SUZ
    // çağırıp modelin topladığı bilgiyle doğal bir cevap yazmasını istiyoruz.
    if (!finalReply) {
      try {
        const closingResponse = await callOpenAI(
          [
            ...openaiMessages,
            {
              role: "system",
              content:
                "Artık araç çağırma. Şimdiye kadar topladığın bilgiyle müşteriye kısa ve net bir cevap yaz. Bilgi eksikse tek bir soru sor.",
            },
          ],
          undefined,
          selectedModel
        );
        promptTokens += closingResponse.usage?.prompt_tokens ?? 0;
        completionTokens += closingResponse.usage?.completion_tokens ?? 0;
        finalReply = (closingResponse.choices[0]?.message?.content || "").trim();
      } catch (err) {
        console.error("[ai] closing call failed:", err);
      }
    }

    if (!finalReply) {
      if (mergedConfig) {
        const errMsg = buildConfigMessage(
          mergedConfig,
          "system_error",
          {},
          tenant.name
        );
        if (errMsg) finalReply = errMsg;
      }
      if (!finalReply) finalReply = getProcessErrorReply(tone);
    }
    finalReply = normalizeAssistantReply(finalReply);
    if (!finalReply) finalReply = getProcessErrorReply(tone);

    // A0 — Critical runtime guardrails (tool/DB evidence required for hard claims)
    const guardrail = applyCriticalGuardrails(finalReply, {
      healthcare: sector.healthcare,
      toolEvidence,
      tone,
    });
    if (guardrail.action !== "allow") {
      console.warn("[ai] guardrail_blocked", {
        reason: guardrail.reason,
        tenant_id: tenantId,
      });
      finalReply = guardrail.reply;
    }

    const metrics: ProcessMessageMetrics = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      model: selectedModel,
      llm_latency_ms: llmLatencyMs,
    };

    // ── Check for human escalation tag (legacy; LLM artık [[INSAN]] yazmıyor) ──
    if (finalReply.includes(HUMAN_ESCALATION_TAG)) {
      const softMsg =
        tone === "siz"
          ? "Bu konuda yardımcı olamıyorum; randevu, fiyat veya müsaitlik için yazabilirsiniz."
          : "Bu konuda yardımcı olamıyorum; randevu, fiyat veya müsaitlik için yazabilirsin.";
      const persisted = await persistAndReply(softMsg);
      return { ...persisted, metrics };
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
      step: getValidNextStep(
        state?.step || "INIT",
        (mergedSessionUpdate.step as string) || state?.step || "devam"
      ),
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
