import OpenAI from "openai";
import { supabase } from "./supabase";
import {
  getSession,
  setSession,
  deleteSession,
  getTenantFromCache,
  setTenantCache,
} from "./redis";
import { sendWhatsAppMessage } from "./whatsapp";
import { getCustomerHistory, formatHistoryForPrompt } from "@/services/customerHistory.service";
import {
  getCustomerLastActiveAppointment,
  cancelAppointment,
} from "@/services/cancellation.service";
import { submitReview, hasReview } from "@/services/review.service";
import { addToWaitlist, notifyWaitlist } from "@/services/waitlist.service";
import {
  createRecurringAppointment,
  dayOfWeekToTurkish,
} from "@/services/recurring.service";
import { isCustomerBlocked } from "@/services/blacklist.service";
import {
  mergeConfig,
  buildMessage as buildConfigMessage,
  checkRequiredFields,
  fillTemplate,
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
const MAX_MESSAGES_BEFORE_ESCALATION = 20;
const MAX_CHAT_HISTORY_TURNS = 10;
/** API'ye gönderilen sohbet turu sayısı (bağlam sıkıştırma: token tasarrufu). */
const CONTEXT_TURNS_TO_SEND = 2;
const MAX_TOOL_ROUNDS = 5;

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
  const raw = msgs.welcome ?? DEFAULT_MESSAGES.welcome!;
  let w: string | string[] = DEFAULT_MESSAGES.welcome!;
  if (Array.isArray(raw) && raw.length > 0) {
    w = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    w = raw;
  }
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

// ── System prompt builder (XML karakter kilidi) ─────────────────────────────────

function buildSystemPrompt(
  tenantName: string,
  msgs: TenantMessagesConfig,
  extraPrompt?: string
): string {
  const tone = msgs.tone ?? "sen";
  const personality = msgs.personality ?? "Samimi, kısa ve doğal konuş";
  const hitap = tone === "siz" ? "siz" : "sen";

  const rol = `Sen bu işletmenin WhatsApp asistanısın. Müşteri direkt bu işletmeye yazıyor. ${personality}. Müşteriye "${hitap}" diye hitap et. İş çözmeye yönelik konuş; randevu al, iptal et, fiyat/adres sorularına cevap ver.`;

  const ton = `Kısa ve doğal cevap ver. Aynı kalıp cümleleri tekrarlama. Resmi veya robotik olma; esnaf gibi samimi ol. Randevu/iptal onayında uzun metin yazma, kısa onay ver (örn. "Tamam abi, yazdım seni").`;

  const kurallar = `BAĞLAM VE HAFIZA: Konuşma geçmişindeki bilgileri kullan. Müşteri adını söylediyse tekrar sorma. "Pazartesi" = en yakın pazartesi (bağlamdaki tarih listesinden YYYY-MM-DD bul). İşlem sonrası konuşma devam eder.
KURALLAR: Randevu öncesi müşteri adını mutlaka öğren; sonra saat belliyse direkt create_appointment. Müşteri adını bir kez öğrendikten sonra kaydet, tekrar yazınca ismiyle seslen. Saat: "6"→18:00, "sabah 10"→10:00, "öğleden sonra 3"→15:00. Tarih: bağlamdaki Bugün/Yarın kullan; "öbür gün"=yarından sonraki, "bu hafta sonu"=Cumartesi. Çalışma saatleri dışında randevu önerme. Çoklu randevu: iki create_appointment arka arkaya. Fiyat→get_services; adres→get_tenant_info. "Geç kalacağım"→notify_late. "İptal"→get_last_appointment sonra cancel_appointment. Yapamayacağın bir şey çıkarsa sadece [[INSAN]] yaz.
MÜSAİTLİK: has_available_slots→saatleri sun; fully_booked→başka gün veya check_week_availability; closed_day/blocked_holiday→"O gün kapalıyız" de. "available" boş olsa bile status'a bak.
ÖRNEKLER: "yarın 6 boş mu?"→check_availability; doluysa "6 dolu ama 5 var, alayım mı?". "tamam 15e al"→create_appointment, "Aldım, yarın 15'te görüşürüz." "randevumu iptal et"→get_last_appointment, cancel_appointment. "bu hafta ne zaman boş?"→check_week_availability. "ne kadar?"→get_services. "neredesiniz?"→get_tenant_info. "geç kalacağım"→notify_late.`;

  let prompt = `<rol>\n${rol}\n</rol>\n\n<ton>\n${ton}\n</ton>\n\n<kurallar>\n${kurallar}\n</kurallar>`;
  if (extraPrompt) {
    prompt += `\n\n${extraPrompt}`;
  }
  return prompt;
}

/** Sistem prompt'un bağlam kısmını XML <bağlam> içinde döndürür (legacy + config ortak). */
function wrapContextInXml(contextBlock: string): string {
  if (!contextBlock.trim()) return "";
  return `\n\n<bağlam>\n${contextBlock.trim()}\n</bağlam>`;
}

// ── System context (dates, availability, history) ───────────────────────────────

const TR_DAY_NAMES_FULL = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

/** Kayan hafıza: mevcut durum özeti (niyet, adım, toplanan bilgiler). API'ye uzun geçmiş yerine bu özet + son birkaç mesaj gider. */
function buildStateSummary(state: ConversationState | null): string {
  if (!state) return "";
  const ext = (state.extracted || {}) as Record<string, unknown>;
  const parts: string[] = [];
  const step = state.step;
  if (step === "saat_secimi_bekleniyor") {
    parts.push("Niyet: Randevu. Müşteri tarih/saat seçiyor.");
  } else if (step === "iptal_onay_bekleniyor") {
    parts.push("Niyet: İptal. Müşteri iptal onayı bekleniyor.");
  } else if (step === "tarih_saat_bekleniyor" || step === "devam") {
    parts.push("Niyet: Randevu veya genel.");
  }
  const customerName = ext.customer_name as string | undefined;
  if (customerName) parts.push(`Müşteri adı: ${customerName}.`);
  const lastDate = ext.last_availability_date as string | undefined;
  const lastSlots = ext.last_available_slots as string[] | undefined;
  if (lastDate && Array.isArray(lastSlots) && lastSlots.length > 0) {
    parts.push(`Son müsait tarih: ${lastDate}, saatler: ${(lastSlots as string[]).join(", ")}.`);
  }
  if (parts.length === 0) return "";
  return `[Durum: ${parts.join(" ")}]`;
}

function buildSystemContext(
  state: ConversationState | null,
  historySummary?: string
): string {
  const today = new Date();
  const todayStr = localDateStr(today);
  const todayDow = today.getDay();

  const nextDays: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = localDateStr(d);
    const dayName = TR_DAY_NAMES_FULL[d.getDay()];
    nextDays.push(`${dayName}=${ds}`);
  }

  const stateSummary = buildStateSummary(state);

  let ctx = stateSummary ? `${stateSummary}\n\n` : "";
  ctx += `Bugün: ${todayStr} (${TR_DAY_NAMES_FULL[todayDow]}).`;
  ctx += ` Önümüzdeki günler: ${nextDays.join(", ")}.`;
  ctx += ` ÖNEMLİ: Müşteri "pazartesi" derse EN YAKIN pazartesiyi kullan (yukarıdaki listeden bak). "Bu hafta" veya "gelecek hafta" derse start_date olarak bugünün tarihini ver.`;

  const ext = (state?.extracted || {}) as Record<string, unknown>;

  const customerName = ext.customer_name as string | undefined;
  if (customerName) {
    ctx += ` Müşterinin adı: ${customerName}. Tekrar sorma, bu bilgiyi kullan.`;
  }

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
          service_slug: {
            type: "string",
            description: "Opsiyonel hizmet slug; süreye göre müsaitlik hesaplanır.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Randevu oluştur. Müşterinin adını mutlaka sor ve customer_name olarak gönder.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
          customer_name: { type: "string", description: "Müşterinin adı soyadı" },
          service_slug: { type: "string", description: "Opsiyonel hizmet slug" },
          extra_data: { type: "object", description: "Opsiyonel ek veri" },
        },
        required: ["date", "time", "customer_name"],
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
  {
    type: "function",
    function: {
      name: "check_week_availability",
      description: "Bu haftanın tüm günlerinin müsaitliğini kontrol et.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Haftanın başlangıç YYYY-MM-DD" },
        },
        required: ["start_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Mevcut randevuyu iptal edip yeni saate al.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          new_date: { type: "string", description: "YYYY-MM-DD" },
          new_time: { type: "string", description: "HH:MM" },
        },
        required: ["appointment_id", "new_date", "new_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_recurring",
      description: "Her hafta aynı gün ve saate tekrar eden randevu oluştur.",
      parameters: {
        type: "object",
        properties: {
          day_of_week: { type: "number", description: "0=Pazar..6=Cumartesi" },
          time: { type: "string", description: "HH:MM" },
        },
        required: ["day_of_week", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_waitlist",
      description: "Dolu güne bekleme listesine ekle, yer açılınca haber ver.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          preferred_time: { type: "string", description: "HH:MM opsiyonel" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_services",
      description: "İşletmenin hizmetlerini ve fiyatlarını listele.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tenant_info",
      description: "İşletmenin adres, telefon, çalışma saatleri bilgilerini getir.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "notify_late",
      description: "Müşterinin geç kalacağını esnafa bildir.",
      parameters: {
        type: "object",
        properties: {
          minutes: { type: "number", description: "Kaç dakika geç" },
          message: { type: "string", description: "Ek mesaj" },
        },
        required: ["minutes"],
      },
    },
  },
];

// ── Notification helpers ─────────────────────────────────────────────────────────

async function notifyMerchant(
  tenantId: string,
  customerPhone: string,
  date: string,
  time: string
): Promise<void> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, contact_phone, config_override")
    .eq("id", tenantId)
    .single();
  if (!tenant?.contact_phone) return;
  const pref =
    (tenant.config_override as Record<string, string>)?.reminder_preference ?? "both";
  if (pref === "off" || pref === "customer_only") return;
  await sendWhatsAppMessage({
    to: tenant.contact_phone,
    text: `Yeni randevu! ${customerPhone} müşterisi ${formatDateTr(date)} saat ${time}'e randevu aldı.`,
  });
}

async function checkAndNotifyWaitlist(
  tenantId: string,
  dateStr: string,
  configOverride?: Record<string, unknown>
): Promise<void> {
  const avail = await checkAvailability(tenantId, dateStr, configOverride);
  if (avail.available.length === 0) return;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  await notifyWaitlist(tenantId, dateStr, avail.available, tenant?.name || "İşletme");
}

async function getAppointmentDate(appointmentId: string): Promise<string | null> {
  const { data } = await supabase
    .from("appointments")
    .select("slot_start")
    .eq("id", appointmentId)
    .single();
  if (!data) return null;
  return new Date(data.slot_start).toISOString().slice(0, 10);
}

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
  configOverride?: Record<string, unknown>,
  mergedConfig?: MergedConfig | null
): Promise<ToolExecResult> {
  if (name === "check_availability") {
    const dateStr = args.date as string;
    const serviceSlug = (args.service_slug as string | undefined) || undefined;
    const availability = await checkAvailability(
      tenantId,
      dateStr,
      configOverride,
      serviceSlug
    );
    let status: string;
    if (availability.blocked) status = "blocked_holiday";
    else if (availability.closed) status = "closed_day";
    else if (availability.available.length === 0) status = "fully_booked";
    else status = "has_available_slots";

    return {
      result: {
        date: dateStr,
        date_readable: formatDateTr(dateStr),
        status,
        available: availability.available,
        booked_count: availability.booked.length,
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
    const advanceDays = mergedConfig?.advance_booking_days ?? (configOverride?.advance_booking_days as number) ?? 30;
    const today = new Date();
    const todayStr = localDateStr(today);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + advanceDays);
    const maxDateStr = localDateStr(maxDate);
    if (dateStr < todayStr) {
      return {
        result: {
          ok: false,
          error: "Geçmiş bir tarih için randevu alınamaz.",
        },
      };
    }
    if (dateStr > maxDateStr) {
      return {
        result: {
          ok: false,
          error: `En fazla ${advanceDays} gün sonrasına randevu alabilirsiniz.`,
        },
      };
    }
    const customerName = (args.customer_name as string) ||
      (state?.extracted as { customer_name?: string })?.customer_name || "";
    const serviceSlug =
      (args.service_slug as string | undefined) ||
      ((args.extra_data as Record<string, unknown> | undefined)?.service_slug as
        | string
        | undefined);
    const extraData = {
      ...(args.extra_data as Record<string, unknown> || {}),
      ...(customerName ? { customer_name: customerName } : {}),
    };
    const result = await createAppointment(
      tenantId,
      customerPhone,
      dateStr,
      timeStr,
      extraData,
      serviceSlug || null
    );
    if (result.ok) {
      notifyMerchant(tenantId, customerPhone, dateStr, timeStr).catch((e) =>
        console.error("[ai] merchant notify error:", e)
      );
      checkAndNotifyWaitlist(tenantId, dateStr, configOverride).catch((e) =>
        console.error("[ai] waitlist notify error:", e)
      );
      return {
        result: {
          ok: true,
          date: dateStr,
          date_readable: formatDateTr(dateStr),
          time: timeStr,
          customer_name: customerName,
        },
        sessionDeleted: true,
        sessionUpdate: {
          extracted: {
            ...(state?.extracted || {}),
            customer_name: customerName,
          },
        },
      };
    }
    return {
      result: {
        ok: false,
        error: result.error,
        suggested_time: result.suggested_time,
      },
    };
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
    const cancellationHrs = mergedConfig?.cancellation_hours ?? (configOverride?.cancellation_hours as number) ?? 2;
    const hasCancellationRule = mergedConfig != null || (configOverride?.cancellation_hours != null);
    const { data: apt } = await supabase
      .from("appointments")
      .select("slot_start")
      .eq("id", aptId)
      .single();
    if (hasCancellationRule && !apt?.slot_start) {
      return {
        result: {
          ok: false,
          error: "Randevu bilgisi alınamadı, iptal işlemi yapılamıyor.",
        },
      };
    }
    if (apt?.slot_start) {
      const slotTime = new Date(apt.slot_start).getTime();
      const now = Date.now();
      const hoursLeft = (slotTime - now) / (60 * 60 * 1000);
      if (hoursLeft < cancellationHrs) {
        return {
          result: {
            ok: false,
            error: `İptal için randevu saatine en az ${cancellationHrs} saat kala iptal edebilirsiniz.`,
          },
        };
      }
    }
    const cancelResult = await cancelAppointment({
      tenantId,
      appointmentId: aptId,
      cancelledBy: "customer",
      reason: args.reason as string,
    });
    if (cancelResult.ok) {
      // İptal sonrası bekleme listesini bilgilendir
      const aptDate = await getAppointmentDate(aptId);
      if (aptDate) {
        checkAndNotifyWaitlist(tenantId, aptDate, configOverride).catch((e) =>
          console.error("[ai] waitlist notify after cancel:", e)
        );
      }
      return { result: { ok: true }, sessionDeleted: true };
    }
    return { result: { ok: false, error: cancelResult.error } };
  }

  if (name === "check_week_availability") {
    const startDate = args.start_date as string;
    const weekResults: Record<string, string[]> = {};
    const closedDays: string[] = [];
    const parts = startDate.split("-").map(Number);
    if (parts.length !== 3) {
      return { result: { days: {}, message: "Geçersiz tarih formatı" } };
    }
    const [y, m, day] = parts;
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 14; i++) {
      const d = new Date(y, m - 1, day + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (ds < todayStr) continue;
      const avail = await checkAvailability(tenantId, ds, configOverride);
      if (avail.blocked) continue;
      if (avail.closed) { closedDays.push(ds); continue; }
      if (avail.available.length > 0) {
        weekResults[`${ds} (${formatDateTr(ds)})`] = avail.available;
      }
    }
    if (Object.keys(weekResults).length > 0) {
      return { result: { days: weekResults } };
    }
    return {
      result: {
        days: {},
        message: "Önümüzdeki 2 hafta içinde müsait gün bulunamadı.",
        closed_day_count: closedDays.length,
      },
    };
  }

  if (name === "reschedule_appointment") {
    const aptId =
      (args.appointment_id as string) ||
      (state?.extracted as { pending_cancel_appointment_id?: string })
        ?.pending_cancel_appointment_id;
    if (!aptId) {
      return { result: { ok: false, error: "Randevu bulunamadı" } };
    }
    const cancelRes = await cancelAppointment({
      tenantId,
      appointmentId: aptId,
      cancelledBy: "customer",
      reason: "Yeniden planlama",
    });
    if (!cancelRes.ok) {
      return { result: { ok: false, error: cancelRes.error } };
    }
    const newDate = args.new_date as string;
    const newTime = args.new_time as string;
    const todayReschedule = localDateStr(new Date());
    if (newDate < todayReschedule) {
      return {
        result: {
          ok: false,
          error: "Geçmiş bir tarih için randevu alınamaz.",
        },
      };
    }
    const advanceDaysReschedule = mergedConfig?.advance_booking_days ?? (configOverride?.advance_booking_days as number) ?? 30;
    const maxDateReschedule = new Date();
    maxDateReschedule.setDate(maxDateReschedule.getDate() + advanceDaysReschedule);
    if (newDate > localDateStr(maxDateReschedule)) {
      return {
        result: {
          ok: false,
          error: `En fazla ${advanceDaysReschedule} gün sonrasına randevu alabilirsiniz.`,
        },
      };
    }
    const createRes = await createAppointment(tenantId, customerPhone, newDate, newTime);
    if (createRes.ok) {
      notifyMerchant(tenantId, customerPhone, newDate, newTime).catch(() => {});
      return {
        result: {
          ok: true,
          old_cancelled: true,
          new_date: newDate,
          new_date_readable: formatDateTr(newDate),
          new_time: newTime,
        },
        sessionDeleted: true,
      };
    }
    return {
      result: {
        ok: false,
        error: createRes.error || "Yeni randevu oluşturulamadı",
        suggested_time: createRes.suggested_time,
      },
    };
  }

  if (name === "create_recurring") {
    const dow = args.day_of_week as number;
    const time = args.time as string;
    const res = await createRecurringAppointment(tenantId, customerPhone, dow, time);
    if (res.ok) {
      return {
        result: {
          ok: true,
          day: dayOfWeekToTurkish(dow),
          time,
        },
      };
    }
    return { result: { ok: false, error: res.error } };
  }

  if (name === "add_to_waitlist") {
    const date = args.date as string;
    const preferredTime = args.preferred_time as string | undefined;
    const res = await addToWaitlist(tenantId, customerPhone, date, preferredTime);
    if (res.ok) {
      return {
        result: {
          ok: true,
          date,
          date_readable: formatDateTr(date),
        },
      };
    }
    return { result: { ok: false, error: res.error } };
  }

  if (name === "get_services") {
    const [serviceRes, tenantRes] = await Promise.all([
      supabase
        .from("services")
        .select("name, slug, price, description, price_visible, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase.from("tenants").select("contact_phone").eq("id", tenantId).single(),
    ]);

    let services = serviceRes.data as
      | Array<{
          name: string;
          slug: string;
          price: number | null;
          description: string | null;
          price_visible?: boolean | null;
        }>
      | null;
    if (serviceRes.error) {
      const legacyRes = await supabase
        .from("services")
        .select("name, slug, price, description")
        .eq("tenant_id", tenantId);
      services = (legacyRes.data as typeof services) || null;
    }
    const tenantInfo = tenantRes.data;
    const fallbackPhone = tenantInfo?.contact_phone || "işletme telefonu";

    if (!services || services.length === 0) {
      return {
        result: {
          services: [],
          message: `Şu an listede hizmet görünmüyor. Detay için ${fallbackPhone} numarasından bizi arayabilirsin.`,
        },
      };
    }
    return {
      result: {
        services: services.map((s) => ({
          name: s.name,
          price:
            s.price_visible === false || s.price == null
              ? `Fiyat için arayın: ${fallbackPhone}`
              : `${s.price} TL`,
          price_visible: s.price_visible !== false,
          description: s.description || "",
        })),
        fallback_phone: fallbackPhone,
      },
    };
  }

  if (name === "get_tenant_info") {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, contact_phone, working_hours_text, config_override")
      .eq("id", tenantId)
      .single();
    if (!tenant) return { result: { error: "İşletme bulunamadı" } };
    const cfg = (tenant.config_override || {}) as Record<string, unknown>;
    return {
      result: {
        name: tenant.name,
        phone: tenant.contact_phone || "Belirtilmemiş",
        working_hours: tenant.working_hours_text || "Belirtilmemiş",
        address: (cfg.address as string) || "Belirtilmemiş",
        maps_url: (cfg.maps_url as string) || null,
      },
    };
  }

  if (name === "notify_late") {
    const minutes = args.minutes as number;
    const msg = args.message as string | undefined;
    const { data: tenant } = await supabase
      .from("tenants")
      .select("contact_phone, name")
      .eq("id", tenantId)
      .single();
    if (!tenant?.contact_phone) {
      return { result: { ok: false, error: "İşletme iletişim numarası yok" } };
    }
    const lateMsg = `${customerPhone} müşteriniz ${minutes} dakika geç kalacağını bildirdi.${msg ? ` Mesaj: ${msg}` : ""}`;
    await sendWhatsAppMessage({ to: tenant.contact_phone, text: lateMsg });
    await createOpsAlert({
      tenantId,
      type: "delay",
      severity: minutes >= 20 ? "high" : "medium",
      customerPhone,
      message: `${customerPhone} müşterisi ${minutes} dk gecikecek.`,
      meta: { minutes, source: "tool", note: msg || null },
      dedupeKey: `delay:${tenantId}:${customerPhone.replace(/\D/g, "")}:${new Date()
        .toISOString()
        .slice(0, 13)}`,
    }).catch((e) => console.error("[ai] ops alert create error:", e));
    return { result: { ok: true, notified: true } };
  }

  return { result: { error: "Bilinmeyen fonksiyon" } };
}

// ── Chat history helpers ────────────────────────────────────────────────────────

function trimChatHistory(history: ChatMessage[]): ChatMessage[] {
  const maxMessages = MAX_CHAT_HISTORY_TURNS * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(-maxMessages);
}

// ── Kademeli zeka: niyet sınıflandırma (çırak vs usta model) ────────────────────

const COMPLEX_KEYWORDS = [
  "iptal",
  "iptal et",
  "değiştir",
  "ertelemek",
  "ertele",
  "her hafta",
  "her salı",
  "her pazartesi",
  "yan dükkan",
  "iki randevu",
  "ve eşim",
  "ve oğlum",
  "randevumu iptal",
  "randevumu değiştir",
  "yeniden planla",
  "başka güne al",
  "farklı gün",
  "bekleme listesi",
  "yer açılırsa",
];

/** Basit (selam, tek fiyat, tek randevu sorusu) → mini; karmaşık (pazarlık, iptal, çoklu) → 4o. */
async function classifyIntentForRouting(incomingMessage: string): Promise<"simple" | "complex"> {
  const t = incomingMessage.trim().toLowerCase();
  if (COMPLEX_KEYWORDS.some((k) => t.includes(k))) return "complex";

  if (!openai) return "simple";

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Niyet sınıflandırıcı. Müşteri mesajına göre yalnızca SIMPLE veya COMPLEX yaz. SIMPLE: selam, teşekkür, tek soru (fiyat, adres, tek randevu, müsaitlik). COMPLEX: pazarlık, çoklu adım, randevu değiştirme/iptal, tekrarlayan randevu, birden fazla işletme. Başka bir şey yazma.",
        },
        { role: "user", content: t.slice(0, 500) },
      ],
      max_tokens: 10,
    });
    const text = (res.choices[0]?.message?.content ?? "").trim().toUpperCase();
    if (text.includes("COMPLEX")) return "complex";
  } catch (err) {
    console.warn("[ai] classifyIntentForRouting failed, defaulting to simple:", err);
  }
  return "simple";
}

const MODEL_SIMPLE = "gpt-4o-mini";
const MODEL_COMPLEX = "gpt-4o";

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

    if (isHumanEscalationRequest(incomingMessage)) {
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

    const flowType = (bt?.config?.flow_type as FlowType) || "appointment";

    // ── First message: welcome ──
    if (state?.step === "tenant_bulundu") {
      let welcome: string;
      if (mergedConfig) {
        const history = await getCustomerHistory(tenantId, customerPhone);
        const hasHistory = Array.isArray(history) && history.length > 0;
        let raw = hasHistory
          ? mergedConfig.returning_customer_message
          : mergedConfig.opening_message;
        if (typeof raw !== "string" || !raw.trim()) {
          raw =
            "Merhaba! {tenant_name} olarak nasıl yardımcı olabilirim?";
        }
        welcome = fillTemplate(raw, {
          tenant_name: tenant.name,
          customer_name: "",
        });
      } else {
        welcome = getWelcomeMessage(msgs, tenant.name);
      }
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

    // ── Session yoksa yeniden oluştur (returning customer) ──
    if (!state) {
      await setSession(tenantId, customerPhone, {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        step: "tarih_saat_bekleniyor",
        extracted: {},
        flow_type: flowType,
        message_count: 1,
        consecutive_misunderstandings: 0,
        chat_history: [],
        updated_at: new Date().toISOString(),
      });
    }

    // ── Deterministic intent handling (cancel / delay) ──
    const deterministicIntent = detectDeterministicIntent(incomingMessage);
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

      const configOverride = (tenant.config_override || {}) as Record<string, unknown>;
      const cancellationHrs =
        mergedConfig?.cancellation_hours ??
        (configOverride?.cancellation_hours as number) ??
        2;
      const hasCancellationRule =
        mergedConfig != null || configOverride?.cancellation_hours != null;
      const slotTime = new Date(last.slot_start).getTime();
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
        appointmentId: last.id,
        cancelledBy: "customer",
        reason: "Mesajdan otomatik iptal",
      });

      if (!cancelResult.ok) {
        return {
          reply:
            tone === "siz"
              ? "İptal işlemi yapılamadı. Lütfen tekrar deneyin."
              : "İptal işlemi yapılamadı, tekrar dener misin?",
        };
      }

      await createOpsAlert({
        tenantId,
        type: "cancellation",
        severity: "medium",
        customerPhone,
        message: `${customerPhone} müşterisi randevusunu iptal etti.`,
        meta: { appointment_id: last.id, source: "deterministic_intent" },
        dedupeKey: `cancel:${tenantId}:${last.id}`,
      }).catch((e) => console.error("[ai] ops alert create error:", e));

      return {
        reply:
          tone === "siz"
            ? "Randevunuzu iptal ettim. Uygun olduğunuz yeni bir saat yazarsanız hemen yardımcı olurum."
            : "Randevunu iptal ettim. Uygun olduğun yeni bir saat yaz, hemen yardımcı olayım.",
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
        todayLabel: `${localDateStr(today)} (${today.toLocaleDateString("tr-TR", { weekday: "long" })})`,
        tomorrowLabel: `${localDateStr(tomorrow)} (${tomorrow.toLocaleDateString("tr-TR", { weekday: "long" })})`,
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
    const routingIntent = await classifyIntentForRouting(incomingMessage);
    const selectedModel = routingIntent === "complex" ? MODEL_COMPLEX : MODEL_SIMPLE;

    // ── Build OpenAI messages: state summary zaten system prompt'ta; sadece son N tur (bağlam sıkıştırma) ──
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [{ role: "system", content: systemPrompt }];

    const chatHistory = state?.chat_history || [];
    const recentTurns = chatHistory.slice(-(CONTEXT_TURNS_TO_SEND * 2));
    for (const msg of recentTurns) {
      openaiMessages.push({ role: msg.role, content: msg.content });
    }
    openaiMessages.push({ role: "user", content: incomingMessage });

    // ── Multi-round tool calling loop ──
    let finalReply = "";
    let sessionDeleted = false;
    const mergedSessionUpdate: Partial<ConversationState> = {};

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: OpenAI.Chat.Completions.ChatCompletion;
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

      // Config-driven: create_appointment öncesi zorunlu alan kontrolü
      let requiredFieldsReply = "";
      if (mergedConfig) {
        for (const tc of tcList) {
          if (tc.function.name === "create_appointment") {
            const fnArgs = JSON.parse(tc.function.arguments || "{}");
            const combined = {
              ...(state?.extracted || {}),
              ...fnArgs,
            } as Record<string, unknown>;
            const { complete, nextQuestion } = checkRequiredFields(
              mergedConfig,
              combined
            );
            if (!complete && nextQuestion) {
              requiredFieldsReply = nextQuestion;
              break;
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
              date_readable: res.date_readable ?? formatDateTr(res.date ?? ""),
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
                date_readable: res.new_date_readable ?? formatDateTr(res.new_date ?? ""),
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

    // ── Check for human escalation tag ──
    if (finalReply.includes(HUMAN_ESCALATION_TAG)) {
      if (mergedConfig) {
        const msg = buildConfigMessage(mergedConfig, "human_escalation", {
          contact_phone: tenant.contact_phone?.trim() ?? "",
          working_hours: tenant.working_hours_text?.trim() ?? "",
        });
        if (msg) return { reply: msg };
      }
      return { reply: buildHumanEscalationMessage(tenant, tone) };
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
        chat_history: [
          { role: "user" as const, content: incomingMessage },
          { role: "assistant" as const, content: finalReply },
        ],
        updated_at: new Date().toISOString(),
      });
      return { reply: finalReply };
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
