import {
  normalizeIncomingText,
} from "./normalizers";
import {
  BUSINESS_SCOPE_KEYWORDS,
  OFFTOPIC_KEYWORDS,
  ABUSIVE_KEYWORDS,
  GREETING_KEYWORDS,
  SMALLTALK_KEYWORDS,
  NEGOTIATION_KEYWORDS,
  COMPLEX_KEYWORDS,
  COMPLEX_PATTERN,
} from "./constants";

export function isAskNameIntent(message: string): boolean {
  const text = normalizeIncomingText(message);
  return (
    text.includes("ismim ne") ||
    text.includes("adim ne") ||
    text.includes("adimi biliyor musun") ||
    text.includes("beni hangi isimle kaydettin")
  );
}

export function isCancelConfirmation(message: string): boolean {
  const text = normalizeIncomingText(message);
  return (
    text === "evet" ||
    text === "onay" ||
    text === "tamam" ||
    text.includes("evet iptal") ||
    text.includes("iptali onayliyorum") ||
    text.includes("iptal onay")
  );
}

export function isCancelReject(message: string): boolean {
  const text = normalizeIncomingText(message);
  return (
    text === "hayir" ||
    text === "hayır" ||
    text.includes("iptal etme") ||
    text.includes("vazgectim") ||
    text.includes("vazgectım") ||
    text.includes("iptal istemiyorum")
  );
}

export function isAbusiveMessage(message: string): boolean {
  const text = normalizeIncomingText(message);
  return ABUSIVE_KEYWORDS.some((word) => text.includes(word));
}

export function isOutOfScopeMessage(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  if (BUSINESS_SCOPE_KEYWORDS.some((word) => text.includes(word))) return false;
  return OFFTOPIC_KEYWORDS.some((word) => text.includes(word));
}

export function isGreetingOrSmallTalkOnly(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  if (BUSINESS_SCOPE_KEYWORDS.some((word) => text.includes(word))) return false;
  const hasGreeting = GREETING_KEYWORDS.some((word) => text.includes(word));
  const hasSmallTalk = SMALLTALK_KEYWORDS.some((word) => text.includes(word));
  return hasGreeting || hasSmallTalk;
}

export function isNegotiationMessage(message: string): boolean {
  const text = normalizeIncomingText(message);
  return NEGOTIATION_KEYWORDS.some((word) => text.includes(word));
}

export function isEscalationQuestion(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text.includes("usta") && !text.includes("yetkili") && !text.includes("insan")) {
    return false;
  }
  return text.includes("neden") || text.includes("bagla") || text.includes("aktar");
}

export function isHumanEscalationRequest(text: string): boolean {
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

export type GlobalInterruptIntent =
  | "CANCEL_FLOW"
  | "RESET"
  | "ASK_FAQ"
  | "HUMAN_REQUEST";

export function detectGlobalInterruptIntent(message: string): GlobalInterruptIntent | null {
  const text = normalizeIncomingText(message);
  if (!text) return null;

  if (
    text.includes("insan") ||
    text.includes("yetkili") ||
    text.includes("operatör") ||
    text.includes("operator")
  ) {
    return "HUMAN_REQUEST";
  }

  if (
    text === "vazgectim" ||
    text === "vazgeçtim" ||
    text.includes("vazgectim") ||
    text.includes("vazgeçtim") ||
    text.includes("bosver") ||
    text.includes("boşver")
  ) {
    return "CANCEL_FLOW";
  }

  if (
    text.includes("sifirla") ||
    text.includes("sıfırla") ||
    text.includes("yeniden basla") ||
    text.includes("reset")
  ) {
    return "RESET";
  }

  if (
    text.includes("fiyat") ||
    text.includes("ucret") ||
    text.includes("ücret") ||
    text.includes("adres") ||
    text.includes("neredesiniz") ||
    text.includes("hizmet")
  ) {
    return "ASK_FAQ";
  }

  return null;
}

/** Basit (selam, tek fiyat, tek randevu sorusu) → mini; karmaşık (pazarlık, çoklu adım, iptal) → 4o. */
export async function classifyIntentForRouting(incomingMessage: string): Promise<"simple" | "complex"> {
  const t = normalizeIncomingText(incomingMessage);
  if (COMPLEX_KEYWORDS.some((k) => t.includes(k))) return "complex";
  if (COMPLEX_PATTERN.test(t)) return "complex";
  if (t.includes(" ve ") && (t.includes("yarin") || t.includes("bugun") || t.includes("hafta"))) {
    return "complex";
  }
  return "simple";
}
