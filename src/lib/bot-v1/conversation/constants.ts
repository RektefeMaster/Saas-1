import type { TenantMessagesConfig } from "../../database.types";

export const HUMAN_ESCALATION_TAG = "[[INSAN]]";
export const MAX_MESSAGES_BEFORE_ESCALATION = 20;
export const MAX_CHAT_HISTORY_TURNS = 10;
/** API'ye gönderilen sohbet turu sayısı (bağlam sıkıştırma: token tasarrufu). */
export const CONTEXT_TURNS_TO_SEND = 3;
export const MAX_TOOL_ROUNDS = 5;
export const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || "Europe/Istanbul";

export const VALID_STEPS = [
  "INIT",
  "INTENT_ROUTING",
  "COLLECTING_FIELDS",
  "AWAITING_CONFIRMATION",
  "EXECUTING",
  "COMPLETED",
  "PAUSED_FOR_HUMAN",
  "RECOVERY_CHECK",
  "FAILED_SAFE",
  "tenant_bulundu",
  "tarih_saat_bekleniyor",
  "saat_secimi_bekleniyor",
  "iptal_onay_bekleniyor",
  "devam",
] as const;

export type Step = (typeof VALID_STEPS)[number];

export function isValidStep(step: unknown): step is Step {
  return (
    typeof step === "string" &&
    (VALID_STEPS as readonly string[]).includes(step)
  );
}

export const DEFAULT_MESSAGES: TenantMessagesConfig = {
  welcome:
    "Merhaba! Ben {tenant_name} asistanıyım, size nasıl yardımcı olabilirim?",
  tone: "sen",
  personality: "Samimi, kısa ve doğal konuş",
};

export const BUSINESS_SCOPE_KEYWORDS = [
  "randevu",
  "müsait",
  "musait",
  "saat",
  "tarih",
  "iptal",
  "fiyat",
  "hizmet",
  "adres",
  "telefon",
  "isletme",
  "berber",
  "kuafor",
  "sac",
  "sakal",
  "gec kal",
];

export const OFFTOPIC_KEYWORDS = [
  "kac yas",
  "kaç yaş",
  "allah",
  "dolar",
  "siyaset",
  "ask",
  "aşk",
  "sohbet",
  "fikrin ne",
];

export const ABUSIVE_KEYWORDS = [
  "aptal",
  "salak",
  "gerizekali",
  "gerizekalı",
  "mal",
  "lan",
];

export const GREETING_KEYWORDS = [
  "merhaba",
  "selam",
  "slm",
  "mrb",
  "hey",
  "gunaydin",
  "günaydın",
  "iyi gunler",
  "iyi günler",
  "iyi aksamlar",
  "iyi akşamlar",
];

export const SMALLTALK_KEYWORDS = [
  "nasilsin",
  "napıyorsun",
  "napiyorsun",
  "naber",
  "iyiyim",
  "kanka",
];

export const NEGOTIATION_KEYWORDS = [
  "indirim",
  "pazarlik",
  "pazarlık",
  "uygun olur mu",
  "fiyatta",
  "ogrenciyim",
  "öğrenciyim",
  "daha ucuz",
  "son fiyat",
];

export const COMPLEX_KEYWORDS = [
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
  "3 arkadas",
  "3 arkadaş",
  "yanimda",
  "yanımda",
  "ve ben",
  "fiyatta",
  "indirim",
  "pazarlik",
  "pazarlık",
];

export const COMPLEX_PATTERN = /\b(\d{1,2}[:.]?\d{0,2})\b.*\b(\d{1,2}[:.]?\d{0,2})\b/;

export const MODEL_SIMPLE = "gpt-4o-mini";
export const MODEL_COMPLEX = "gpt-4o";

export const TR_DAY_NAMES_FULL = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export const EN_DAY_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export const RATING_MAP: Record<string, number> = {
  beş: 5, dort: 4, dört: 4, uc: 3, üç: 3, iki: 2, bir: 1,
  mükemmel: 5, harika: 5, süper: 5,
  iyi: 4, güzel: 4,
  orta: 3, idare: 3,
  kötü: 2, berbat: 1,
};
