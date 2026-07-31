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
    text.includes("iptal etme") ||
    text.includes("vazgectim") ||
    text.includes("iptal istemiyorum")
  );
}

export function isAbusiveMessage(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!text) return false;
  // Word-boundary match avoids false positives ("almak", "normal", "plan").
  return ABUSIVE_KEYWORDS.some((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s|[!?.:,;])`).test(text);
  });
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

function hasHumanEscalationToken(text: string): boolean {
  // text is already normalizeIncomingText (ASCII-folded).
  return (
    /\b(yetkili|operator|canli\s*destek)\b/.test(text) ||
    /\bgercek\s*kisi\b/.test(text) ||
    /\bmusteri\s*hizmet/.test(text) ||
    /\bbiriyle\s*gorusmek\b/.test(text) ||
    /\binsan\s*(destek|mi|misiniz|misin|yonlendir)\b/.test(text)
  );
}

export function isEscalationQuestion(message: string): boolean {
  const text = normalizeIncomingText(message);
  if (!hasHumanEscalationToken(text) && !text.includes("usta") && !text.includes("yetkili")) {
    return false;
  }
  return text.includes("neden") || text.includes("bagla") || text.includes("aktar");
}

export function isHumanEscalationRequest(text: string): boolean {
  const t = normalizeIncomingText(text);
  return hasHumanEscalationToken(t);
}

export type GlobalInterruptIntent =
  | "CANCEL_FLOW"
  | "RESET"
  | "ASK_FAQ"
  | "HUMAN_REQUEST";

export function detectGlobalInterruptIntent(message: string): GlobalInterruptIntent | null {
  const text = normalizeIncomingText(message);
  if (!text) return null;

  if (hasHumanEscalationToken(text) || text.includes("yetkili")) {
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

/** Tüm trafik Luna; kademeli model routing yok. */
export function classifyModelRouting(_incomingMessage: string): {
  tier: "simple" | "complex";
  reason: "simple";
} {
  return { tier: "simple", reason: "simple" };
}

/** @deprecated Prefer classifyModelRouting. Her zaman simple (Luna). */
export async function classifyIntentForRouting(
  _incomingMessage: string
): Promise<"simple" | "complex"> {
  return "simple";
}
