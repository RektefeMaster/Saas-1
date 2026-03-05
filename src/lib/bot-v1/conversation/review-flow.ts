import { supabase } from "../../supabase";
import {
  submitReview,
  submitReviewSkipped,
  hasReview,
  hasCustomerRatedService,
} from "@/services/review.service";
import { RATING_MAP } from "./constants";
import { normalizeIncomingText } from "./normalizers";

function parseRating(text: string): number | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const lines = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidates = [...new Set([raw, ...lines.slice(-4).reverse()])];

  for (const candidate of candidates) {
    const normalized = normalizeIncomingText(candidate)
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;

    const directDigit = normalized.match(
      /^(?:puan(?:im)?\s*)?([1-5])(?:\s*(?:yildiz|star|puan|\/\s*5))?$/
    );
    if (directDigit) return parseInt(directDigit[1], 10);

    const trailingDigit = normalized.match(/(?:^|\s)([1-5])\s*$/);
    if (trailingDigit) return parseInt(trailingDigit[1], 10);

    const words = normalized
      .replace(/\s*(?:yildiz|star|puan)\s*/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const hasReviewKeyword = /\b(puan|yildiz|degerlendirme|rating)\b/.test(normalized);
    for (const w of words) {
      if (RATING_MAP[w] != null && (hasReviewKeyword || words.length <= 3)) {
        return RATING_MAP[w];
      }
    }
    if (words.length <= 2 && RATING_MAP[normalized] != null) {
      return RATING_MAP[normalized];
    }
  }
  return null;
}

const REVIEW_SKIP_PHRASES = [
  "gec",
  "geç",
  "atla",
  "sonra",
  "istemiyorum",
  "pas",
  "skip",
  "hayır",
  "vazgeçtim",
  "yok",
  "gerek yok",
  "gerekmez",
];

function isReviewSkipMessage(normalizedText: string): boolean {
  if (!normalizedText) return false;
  const compact = normalizedText.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  return REVIEW_SKIP_PHRASES.some((phrase) => {
    const normPhrase = normalizeIncomingText(phrase);
    return (
      compact === normPhrase ||
      compact.startsWith(`${normPhrase} `) ||
      compact.endsWith(` ${normPhrase}`) ||
      compact.includes(` ${normPhrase} `)
    );
  });
}

function hasReviewKeyword(normalizedText: string): boolean {
  return /\b(puan|yildiz|degerlendirme|rating)\b/.test(normalizedText);
}

function isStandaloneRatingMessage(normalizedText: string): boolean {
  if (!normalizedText) return false;
  if (/^[1-5]$/.test(normalizedText)) return true;
  if (/^[1-5]\s*(?:yildiz|star|puan)?$/.test(normalizedText)) return true;
  if (/^(bir|iki|uc|dort|bes|harika|guzel|kotu|berbat)$/.test(normalizedText)) return true;
  return false;
}

export async function tryHandleReview(
  tenantId: string,
  customerPhone: string,
  msg: string
): Promise<{ handled: boolean; reply?: string }> {
  const normalizedMessage = normalizeIncomingText(msg);
  const wantsSkip = isReviewSkipMessage(normalizedMessage);
  const rating = parseRating(msg);
  const hasStarSymbol = /(?:[1-5]\s*[⭐🌟]|[⭐🌟]\s*[1-5])/.test(msg);
  const hasKeywordSignal = hasReviewKeyword(normalizedMessage);
  const isStandaloneSignal = isStandaloneRatingMessage(normalizedMessage);
  if (!wantsSkip && !hasKeywordSignal && !isStandaloneSignal && !hasStarSymbol) {
    return { handled: false };
  }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const { data: apt } = await supabase
    .from("appointments")
    .select("id, service_slug, extra_data")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .lt("slot_start", thirtyMinutesAgo.toISOString())
    .in("status", ["completed", "confirmed"])
    .order("slot_start", { ascending: false })
    .limit(1)
    .single();

  if (!apt) {
    return {
      handled: true,
      reply: "Aktif bir değerlendirme kaydı bulamadım, yine de teşekkürler.",
    };
  }

  const appointmentExtra =
    apt.extra_data && typeof apt.extra_data === "object"
      ? (apt.extra_data as Record<string, unknown>)
      : {};
  const reminderSentAt =
    typeof appointmentExtra.review_reminder_sent_at === "string"
      ? appointmentExtra.review_reminder_sent_at
      : null;

  if (!wantsSkip && !hasKeywordSignal && !hasStarSymbol && isStandaloneSignal && !reminderSentAt) {
    return { handled: false };
  }

  if (await hasReview(apt.id)) {
    return {
      handled: true,
      reply: "Bu hizmet için değerlendirmen zaten kayıtlı, teşekkürler!",
    };
  }

  const serviceSlug =
    typeof apt.service_slug === "string" ? apt.service_slug.trim() : "";
  if (
    serviceSlug &&
    (await hasCustomerRatedService(tenantId, customerPhone, serviceSlug, apt.id))
  ) {
    await supabase
      .from("appointments")
      .update({
        status: "completed",
        extra_data: {
          ...appointmentExtra,
          review_closed_at: new Date().toISOString(),
          review_closed_reason: "service_already_rated",
        },
      })
      .eq("id", apt.id);
    return {
      handled: true,
      reply: "Bu hizmet için puanın zaten kayıtlı. Tekrar puan almıyoruz, teşekkürler.",
    };
  }

  if (wantsSkip) {
    await submitReviewSkipped(tenantId, apt.id, customerPhone);
    await supabase
      .from("appointments")
      .update({
        status: "completed",
        extra_data: {
          ...appointmentExtra,
          review_closed_at: new Date().toISOString(),
          review_closed_reason: "skipped",
        },
      })
      .eq("id", apt.id);
    return { handled: true, reply: "Tamam, değerlendirmeyi kapattım. Teşekkürler!" };
  }

  if (rating == null || rating < 1 || rating > 5) {
    return {
      handled: true,
      reply: "Puan için 1 ile 5 arasında bir sayı yazabilirsin.",
    };
  }

  const result = await submitReview(tenantId, apt.id, customerPhone, rating);
  if (!result.ok) return { handled: false };

  await supabase
    .from("appointments")
    .update({
      status: "completed",
      extra_data: {
        ...appointmentExtra,
        review_closed_at: new Date().toISOString(),
        review_closed_reason: "rated",
        review_rating: rating,
      },
    })
    .eq("id", apt.id);

  return {
    handled: true,
    reply: "Teşekkürler! Değerlendirmen için sağ ol, tekrar bekleriz!",
  };
}
