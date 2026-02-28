import OpenAI from "openai";
import { supabase } from "./supabase";
import {
  getSession,
  setSession,
  deleteSession,
  getTenantFromCache,
  setTenantCache,
} from "./redis";
import { checkBlockedDate } from "@/services/blockedDates.service";
import { getCustomerHistory, formatHistoryForPrompt } from "@/services/customerHistory.service";
import {
  getCustomerLastActiveAppointment,
  cancelAppointment,
} from "@/services/cancellation.service";
import { submitReview, hasReview } from "@/services/review.service";
import type {
  Tenant,
  BusinessType,
  ConversationState,
  FlowType,
  ChatMessage,
  TenantMessagesConfig,
} from "./database.types";

// ── OpenAI client ───────────────────────────────────────────────────────────────

const rawKey = process.env.OPENAI_API_KEY ?? "";
const openaiKey = rawKey.replace(/\s/g, "").trim();
const openai =
  openaiKey.length >= 20 && openaiKey.startsWith("sk-")
    ? new OpenAI({ apiKey: openaiKey })
    : null;

// ── Constants ───────────────────────────────────────────────────────────────────

const HUMAN_ESCALATION_TAG = "[[INSAN]]";
const MAX_MESSAGES_BEFORE_ESCALATION = 10;
const MAX_CHAT_HISTORY_TURNS = 2;
const MAX_TOOL_ROUNDS = 3;

const VALID_STEPS = [
  "tenant_bulundu",
  "tarih_saat_bekleniyor",
  "saat_secimi_bekleniyor",
  "iptal_onay_bekleniyor",
  "devam",
] as const;
type Step = (typeof VALID_STEPS)[number];

function isValidStep(step: unknown): step is Step {
  return (
    typeof step === "string" &&
    (VALID_STEPS as readonly string[]).includes(step)
  );
}

// ── Tenant messages config ──────────────────────────────────────────────────────

const DEFAULT_MESSAGES: TenantMessagesConfig = {
  welcome: "Merhaba! {tenant_name} olarak nasıl yardımcı olabilirim?",
  tone: "sen",
  personality: "Samimi, kısa ve doğal konuş",
};

function getMergedMessages(
  tenant: Tenant & { business_types: BusinessType }
): TenantMessagesConfig {
  const bt = Array.isArray(tenant.business_types)
    ? tenant.business_types[0]
    : tenant.business_types;
  const btMessages =
    ((bt as BusinessType | undefined)?.config?.messages as Record<string, unknown>) || {};
  const tenantOverride = (tenant.config_override?.messages ?? {}) as Partial<TenantMessagesConfig>;
  return { ...DEFAULT_MESSAGES, ...btMessages, ...tenantOverride };
}

function getWelcomeMessage(
  msgs: TenantMessagesConfig,
  tenantName: string
): string {
  const w = msgs.welcome ?? DEFAULT_MESSAGES.welcome!;
  const text = Array.isArray(w)
    ? w[Math.floor(Math.random() * w.length)]
    : w;
  return (text as string).replace(/\{tenant_name\}/g, tenantName);
}

function getMisunderstandReply(tone: string): string {
  return tone === "siz"
    ? "Tam anlamadım, ne zaman randevu almak istiyordunuz?"
    : "Tam anlamadım, ne zaman randevu almak istiyordun?";
}

function getProcessErrorReply(tone: string): string {
  return tone === "siz"
    ? "Bir şeyler ters gitti, biraz sonra tekrar dener misiniz?"
    : "Bir şeyler ters gitti, biraz sonra tekrar dener misin?";
}

// ── System prompt builder ───────────────────────────────────────────────────────

function buildSystemPrompt(
  tenantName: string,
  msgs: TenantMessagesConfig,
  extraPrompt?: string
): string {
  const tone = msgs.tone ?? "sen";
  const personality = msgs.personality ?? "Samimi, kısa ve doğal konuş";
  const hitap = tone === "siz" ? "siz" : "sen";

  let prompt = `Sen ${tenantName} işletmesinin WhatsApp asistanısın. ${personality}. Müşteriye '${hitap}' diye hitap et.

Ne yapman gerektiğini kendin anla: müşteri randevu istiyorsa al, iptal istiyorsa iptal et, saat soruyorsa takvime bak söyle.

Kurallar:
- Kısa ve doğal cevap ver. Aynı kalıp cümleleri tekrarlama, her seferinde biraz farklı söyle.
- Müşteri saat söyleyince direkt randevu oluştur, ekstra onay sorma.
- Müşteri randevu aldıktan sonra (randevu aldığı saat)'e randevu alındı diye bilgilendir.
- Saat: "6" → 18:00, "sabah 10" → 10:00, "öğleden sonra 3" → 15:00.
- Tarih: bağlamda Bugün/Yarın verilmiş, onu kullan. "öbür gün" = yarından sonraki gün.
- Çalışma saatleri dışında randevu önerme.
- Yapamayacağın bir şey çıkarsa sadece [[INSAN]] yaz.

Örnek diyaloglar:
Müşteri: "yarın 6 boş mu?" → check_availability çağır. 18:00 doluysa ama 17:00 boşsa: "Yarın 6 dolu ama 5 var, alayım mı?"
Müşteri: "tamam 15e al" → create_appointment çağır. Başarılıysa: "Aldım! Yarın 15'te görüşürüz."
Müşteri: "randevumu iptal et" → get_last_appointment çağır. Bulursa: "Yarın 15'teki randevunu iptal edeyim mi?"
Müşteri: "evet" (iptal bağlamında) → cancel_appointment çağır. "İptal ettim, tekrar almak istersen yaz."`;

  if (extraPrompt) {
    prompt += `\n\n${extraPrompt}`;
  }
  return prompt;
}

// ── System context (dates, availability, history) ───────────────────────────────

function buildSystemContext(
  state: ConversationState | null,
  historySummary?: string
): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  let ctx = `Bugün: ${todayStr}. Yarın: ${tomorrowStr}.`;

  const ext = (state?.extracted || {}) as Record<string, unknown>;
  const lastDate = ext.last_availability_date as string | undefined;
  const lastSlots = ext.last_available_slots as string[] | undefined;
  if (
    lastDate &&
    lastSlots &&
    Array.isArray(lastSlots) &&
    lastSlots.length > 0
  ) {
    ctx += ` Son müsait saatler (${lastDate}): ${lastSlots.join(", ")}.`;
  }

  if (historySummary) {
    ctx += ` ${historySummary}`;
  }
  return ctx;
}

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

function formatDateTr(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString("tr-TR", { weekday: "long" });
    const dayMonth = d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
    });
    return `${weekday} ${dayMonth}`;
  } catch {
    return dateStr;
  }
}

function isHumanEscalationRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  const keywords = [
    "insan",
    "yetkili",
    "sizi aramak istiyorum",
    "gerçek kişi",
    "operatör",
    "müşteri hizmetleri",
    "biriyle görüşmek",
  ];
  return keywords.some((k) => t.includes(k));
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
  configOverride?: Record<string, unknown>
): Promise<{
  available: string[];
  booked: string[];
  blocked?: boolean;
  noSchedule?: boolean;
}> {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { available: [], booked: [] };

  const blocked = await checkBlockedDate(tenantId, dateStr);
  if (blocked) {
    return { available: [], booked: [], blocked: true };
  }

  const { data: slots } = await supabase
    .from("availability_slots")
    .select("day_of_week, start_time, end_time")
    .eq("tenant_id", tenantId);

  let startTime: string | undefined;
  let endTime: string | undefined;

  if (!slots || slots.length === 0) {
    const defaultHours = (configOverride?.default_working_hours ?? null) as {
      start?: string;
      end?: string;
    } | null;
    if (defaultHours?.start && defaultHours?.end) {
      startTime = defaultHours.start;
      endTime = defaultHours.end;
    } else {
      return { available: [], booked: [], noSchedule: true };
    }
  } else {
    const dayOfWeek = date.getDay();
    const daySlot = slots.find((s) => s.day_of_week === dayOfWeek);
    if (!daySlot) return { available: [], booked: [] };
    startTime = daySlot.start_time;
    endTime = daySlot.end_time;
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("slot_start")
    .eq("tenant_id", tenantId)
    .gte("slot_start", `${dateStr}T00:00:00`)
    .lt("slot_start", `${dateStr}T23:59:59`)
    .not("status", "in", "('cancelled')");

  const booked = (appointments || []).map((a) => {
    const d = new Date(a.slot_start);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const [startH, startM] = startTime!.split(":").map(Number);
  const [endH, endM] = endTime!.split(":").map(Number);
  const available: string[] = [];
  for (let h = startH; h < endH || (h === endH && startM < endM); h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h < startH || (h === startH && m < startM)) continue;
      if (h > endH || (h === endH && m >= endM)) break;
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (!booked.includes(time)) available.push(time);
    }
  }
  return { available, booked };
}

// ── Create appointment ──────────────────────────────────────────────────────────

export async function createAppointment(
  tenantId: string,
  customerPhone: string,
  dateStr: string,
  timeStr: string,
  extraData?: Record<string, unknown>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    let time = timeStr.trim();
    if (/^\d{1,2}$/.test(time)) time = `${time.padStart(2, "0")}:00`;
    else if (/^\d{1,2}:\d{1,2}$/.test(time))
      time = time.replace(
        /(\d{1,2}):(\d{1,2})/,
        (_, h, m) => `${h.padStart(2, "0")}:${m.padStart(2, "0")}`
      );
    const slotStart = `${dateStr}T${time}:00`;

    const { data: daySlot } = await supabase
      .from("availability_slots")
      .select("start_time, end_time")
      .eq("tenant_id", tenantId)
      .eq("day_of_week", new Date(dateStr).getDay())
      .limit(1)
      .maybeSingle();

    if (daySlot) {
      const [sH, sM] = daySlot.start_time.split(":").map(Number);
      const [eH, eM] = daySlot.end_time.split(":").map(Number);
      const [tH, tM] = time.split(":").map(Number);
      const slotMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      const timeMin = tH * 60 + tM;
      if (timeMin < slotMin || timeMin >= endMin) {
        return { ok: false, error: "OUTSIDE_HOURS" };
      }
    }

    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("slot_start", slotStart)
      .not("status", "eq", "cancelled")
      .maybeSingle();
    if (existing) {
      return { ok: false, error: "SLOT_TAKEN" };
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        tenant_id: tenantId,
        customer_phone: customerPhone,
        slot_start: slotStart,
        status: "confirmed",
        extra_data: extraData || {},
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "SLOT_TAKEN" };
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[ai] createAppointment:", err);
    return { ok: false, error: "Bir hata oluştu." };
  }
}

// ── Review handling ─────────────────────────────────────────────────────────────

const RATING_MAP: Record<string, number> = {
  beş: 5, dort: 4, dört: 4, uc: 3, üç: 3, iki: 2, bir: 1,
  mükemmel: 5, harika: 5, süper: 5,
  iyi: 4, güzel: 4,
  orta: 3, idare: 3,
  kötü: 2, berbat: 1,
};

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

// ── Tool definitions ────────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "O günün müsait saatlerini kontrol et.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Randevu oluştur.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
          extra_data: { type: "object", description: "Opsiyonel" },
        },
        required: ["date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_last_appointment",
      description: "Müşterinin aktif randevusunu getir.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Randevuyu iptal et.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["appointment_id"],
      },
    },
  },
];

// ── Tool executor ───────────────────────────────────────────────────────────────

interface ToolExecResult {
  result: Record<string, unknown>;
  sessionDeleted?: boolean;
  sessionUpdate?: Partial<ConversationState>;
}

async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  tenantId: string,
  customerPhone: string,
  state: ConversationState | null,
  configOverride?: Record<string, unknown>
): Promise<ToolExecResult> {
  if (name === "check_availability") {
    const dateStr = args.date as string;
    const availability = await checkAvailability(
      tenantId,
      dateStr,
      configOverride
    );
    return {
      result: {
        date: dateStr,
        date_readable: formatDateTr(dateStr),
        available: availability.available,
        blocked: !!availability.blocked,
        noSchedule: !!availability.noSchedule,
      },
      sessionUpdate: {
        step: "saat_secimi_bekleniyor",
        extracted: {
          ...(state?.extracted || {}),
          last_availability_date: dateStr,
          last_available_slots: availability.available,
        },
      },
    };
  }

  if (name === "create_appointment") {
    const dateStr = args.date as string;
    const timeStr = args.time as string;
    const result = await createAppointment(
      tenantId,
      customerPhone,
      dateStr,
      timeStr,
      args.extra_data as Record<string, unknown>
    );
    if (result.ok) {
      return {
        result: {
          ok: true,
          date: dateStr,
          date_readable: formatDateTr(dateStr),
          time: timeStr,
        },
        sessionDeleted: true,
      };
    }
    return { result: { ok: false, error: result.error } };
  }

  if (name === "get_last_appointment") {
    const last = await getCustomerLastActiveAppointment(
      tenantId,
      customerPhone
    );
    if (last) {
      const d = new Date(last.slot_start);
      const dateStr = d.toLocaleDateString("tr-TR");
      const timeStr = d.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        result: {
          found: true,
          appointment_id: last.id,
          date: dateStr,
          time: timeStr,
        },
        sessionUpdate: {
          step: "iptal_onay_bekleniyor",
          extracted: {
            ...(state?.extracted || {}),
            pending_cancel_appointment_id: last.id,
          },
        },
      };
    }
    return { result: { found: false } };
  }

  if (name === "cancel_appointment") {
    const aptId =
      (args.appointment_id as string) ||
      (state?.extracted as { pending_cancel_appointment_id?: string })
        ?.pending_cancel_appointment_id;
    if (!aptId) {
      return { result: { ok: false, error: "Randevu bulunamadı" } };
    }
    const cancelResult = await cancelAppointment({
      tenantId,
      appointmentId: aptId,
      cancelledBy: "customer",
      reason: args.reason as string,
    });
    if (cancelResult.ok) {
      return { result: { ok: true }, sessionDeleted: true };
    }
    return { result: { ok: false, error: cancelResult.error } };
  }

  return { result: { error: "Bilinmeyen fonksiyon" } };
}

// ── Chat history helpers ────────────────────────────────────────────────────────

function trimChatHistory(history: ChatMessage[]): ChatMessage[] {
  const maxMessages = MAX_CHAT_HISTORY_TURNS * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(-maxMessages);
}

// ── OpenAI call with retry ──────────────────────────────────────────────────────

async function callOpenAI(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await openai!.chat.completions.create({
      model: "gpt-4o-mini",
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
        model: "gpt-4o-mini",
        messages,
        ...(tools ? { tools, tool_choice: "auto" as const } : {}),
      });
    }
    throw err;
  }
}

// ── Main process ────────────────────────────────────────────────────────────────

export async function processMessage(
  tenantId: string,
  customerPhone: string,
  incomingMessage: string
): Promise<{ reply: string; stateReset?: boolean }> {
  try {
    const tenant = await getTenantWithBusinessType(tenantId);
    if (!tenant) {
      return {
        reply: "Üzgünüm, işletme bulunamadı. Lütfen doğru kodu kullanın.",
      };
    }

    const msgs = getMergedMessages(tenant);
    const tone = msgs.tone ?? "sen";

    if (isHumanEscalationRequest(incomingMessage)) {
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    const reviewResult = await tryHandleReview(
      tenantId,
      customerPhone,
      incomingMessage
    );
    if (reviewResult.handled && reviewResult.reply) {
      return { reply: reviewResult.reply };
    }

    const state = await getSession(tenantId, customerPhone);
    const messageCount = (state?.message_count ?? 0) + 1;
    if (messageCount > MAX_MESSAGES_BEFORE_ESCALATION) {
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    if (state && !isValidStep(state.step)) {
      console.warn("[session] Geçersiz step, sıfırlanıyor:", state.step);
      await deleteSession(tenantId, customerPhone);
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    const bt = (
      Array.isArray(tenant.business_types)
        ? tenant.business_types[0]
        : tenant.business_types
    ) as BusinessType | undefined;
    const flowType = (bt?.config?.flow_type as FlowType) || "appointment";

    // ── First message: welcome ──
    if (state?.step === "tenant_bulundu") {
      const welcome = getWelcomeMessage(msgs, tenant.name);
      await setSession(tenantId, customerPhone, {
        ...(state || {}),
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "tarih_saat_bekleniyor",
        extracted: state?.extracted || {},
        flow_type: flowType,
        message_count: messageCount,
        consecutive_misunderstandings: 0,
        chat_history: [{ role: "assistant", content: welcome }],
        updated_at: new Date().toISOString(),
      });
      return { reply: welcome };
    }

    // ── Build context ──
    const history = await getCustomerHistory(tenantId, customerPhone);
    const historySummary = formatHistoryForPrompt(history);
    const systemContext = buildSystemContext(state, historySummary);

    const extraPrompt =
      (bt?.config as { ai_prompt_template?: string })?.ai_prompt_template || "";
    const systemPrompt =
      buildSystemPrompt(tenant.name, msgs, extraPrompt) +
      "\n\n" +
      systemContext;

    if (!openai) {
      return {
        reply: "Şu an randevu alamıyorum. Lütfen daha sonra tekrar deneyin.",
      };
    }

    // ── Build OpenAI messages with conversation history ──
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [{ role: "system", content: systemPrompt }];

    const chatHistory = state?.chat_history || [];
    for (const msg of chatHistory) {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }
    openaiMessages.push({ role: "user", content: incomingMessage });

    // ── Multi-round tool calling loop ──
    let finalReply = "";
    let sessionDeleted = false;
    let mergedSessionUpdate: Partial<ConversationState> = {};

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await callOpenAI(
          openaiMessages,
          round === 0 ? TOOLS : TOOLS
        );
      } catch {
        return { reply: getProcessErrorReply(tone) };
      }

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
        const fnArgs = JSON.parse(tc.function.arguments || "{}");
        const toolExec = await executeToolCall(
          tc.function.name,
          fnArgs,
          tenantId,
          customerPhone,
          state,
          tenant.config_override
        );

        openaiMessages.push({
          role: "tool" as const,
          tool_call_id: tc.id,
          content: JSON.stringify(toolExec.result),
        });

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

    if (!finalReply) {
      finalReply = getProcessErrorReply(tone);
    }

    // ── Check for human escalation tag ──
    if (finalReply.includes(HUMAN_ESCALATION_TAG)) {
      return { reply: buildHumanEscalationMessage(tenant, tone) };
    }

    // ── Session management ──
    if (sessionDeleted) {
      await deleteSession(tenantId, customerPhone);
      return { reply: finalReply, stateReset: true };
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
      chat_history: updatedHistory,
      updated_at: new Date().toISOString(),
    });

    return { reply: finalReply };
  } catch (err) {
    console.error("[ai] processMessage:", err);
    return {
      reply: "Bir şeyler ters gitti, biraz sonra tekrar dener misin?",
    };
  }
}
