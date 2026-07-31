import type { TenantMessagesConfig } from "../../database.types";

export const HUMAN_ESCALATION_TAG = "[[INSAN]]";
export const MAX_MESSAGES_BEFORE_ESCALATION = 20;
export const MAX_CHAT_HISTORY_TURNS = 15;
/**
 * API'ye gönderilen sohbet turu sayısı. Erken dönüşler artık geçmişe yazıldığı
 * için pencere 4'ten 8'e çıkarıldı: konuşma belirgin şekilde daha akıcı, maliyet
 * artışı sınırlı (durum özeti zaten sıkıştırılmış halde prompt'ta).
 */
export const CONTEXT_TURNS_TO_SEND = 8;
export const MAX_TOOL_ROUNDS = 5;
/**
 * İptal onayı bekleme süresi. Süre dolunca bayrak düşer; müşteri günler sonra
 * yazdığı "tamam" ile randevusunu kaybetmez.
 */
export const PENDING_CANCEL_TTL_MS = 10 * 60 * 1000;
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
  // Randevu niyetini keyword listesi yüzünden kaçırmamak için genişletildi.
  "yer var",
  "bos var",
  "bos yer",
  "gelebilir",
  "gelsem",
  "ugrasam",
  "ugrayabilir",
  "bakabilir",
  "alabilir",
  "ne kadar",
  "kac para",
  "acik mi",
  "kapali mi",
  "calisiyor",
];

/**
 * Kapsam dışı sinyaller. Substring değil, KELİME SINIRI ile eşleşir
 * (bkz. containsWord). "aşk" gibi kısa tokenlar "başka"/"maske" içinde yanlış
 * eşleştiği için buradan kaldırıldı.
 */
export const OFFTOPIC_KEYWORDS = [
  "kac yasindasin",
  "allah",
  "dolar",
  "siyaset",
  "borsa",
  "futbol",
  "fikrin ne",
];

/**
 * Whole-token abusive words only (matched with word boundaries after normalize).
 * "mal" ve "lan" günlük Türkçede nötr kullanıldığı için listede değil.
 */
export const ABUSIVE_KEYWORDS = [
  "aptal",
  "salak",
  "gerizekali",
  "siktir",
  "amk",
  "orospu",
  "pic",
  "yavsak",
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

/** @deprecated Kademeli routing kaldırıldı; Luna-only. */
export const COMPLEX_KEYWORDS: string[] = [];
/** @deprecated Kademeli routing kaldırıldı; Luna-only. */
export const COMPLEX_PATTERN = /$a/;

/** Tek model: tüm sohbet trafiği Luna. COMPLEX alias geriye uyum için aynı default. */
export const MODEL_SIMPLE =
  process.env.OPENAI_CHAT_MODEL_SIMPLE?.trim() || "gpt-5.6-luna";
export const MODEL_COMPLEX =
  process.env.OPENAI_CHAT_MODEL_COMPLEX?.trim() || MODEL_SIMPLE;

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

/** Keys must match normalizeIncomingText output (ASCII-folded Turkish). */
export const RATING_MAP: Record<string, number> = {
  bes: 5,
  dort: 4,
  uc: 3,
  iki: 2,
  bir: 1,
  mukemmel: 5,
  harika: 5,
  super: 5,
  iyi: 4,
  guzel: 4,
  orta: 3,
  idare: 3,
  kotu: 2,
  berbat: 1,
};
