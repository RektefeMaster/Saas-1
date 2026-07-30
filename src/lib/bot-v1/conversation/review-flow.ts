import { supabase } from "../../supabase";
import {
  submitReview,
  submitReviewSkipped,
  hasReview,
  hasCustomerRatedService,
} from "@/services/review.service";
import { phoneVariants } from "@/lib/phone";
import { RATING_MAP } from "./constants";
import { normalizeIncomingText } from "./normalizers";

/** Ambiguous tokens that must not rate alone / in long booking phrases. */
const AMBIGUOUS_RATING_WORDS = new Set(["bir", "iki", "uc", "iyi", "guzel"]);

const STRONG_RATING_WORDS = new Set([
  "bes",
  "dort",
  "mukemmel",
  "harika",
  "super",
  "orta",
  "idare",
  "kotu",
  "berbat",
]);

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

    const hasReviewKeyword = /\b(puan|yildiz|degerlendirme|rating)\b/.test(normalized);
    const words = normalized
      .replace(/\s*(?:yildiz|star|puan)\s*/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    // Short rating-focused messages only; never scan long sentences for ambiguous words.
    if (words.length > 3 && !hasReviewKeyword) continue;

    for (const w of words) {
      if (AMBIGUOUS_RATING_WORDS.has(w)) {
        if (hasReviewKeyword && words.length <= 3) return RATING_MAP[w] ?? null;
        continue;
      }
      if (STRONG_RATING_WORDS.has(w) && RATING_MAP[w] != null) {
        if (hasReviewKeyword || words.length <= 2) return RATING_MAP[w];
      }
      if (RATING_MAP[w] != null && hasReviewKeyword && words.length <= 3) {
        return RATING_MAP[w];
      }
    }
  }
  return null;
}

/** Exact skip only when a review reminder is outstanding — bare "hayir"/"gec" must not hijack chat. */
const REVIEW_SKIP_EXACT = new Set([
  "gec",
  "atla",
  "pas",
  "skip",
  "puan vermek istemiyorum",
  "degerlendirmek istemiyorum",
  "degerlendirme istemiyorum",
  "puan istemiyorum",
]);

function isReviewSkipMessage(normalizedText: string): boolean {
  if (!normalizedText) return false;
  const compact = normalizedText.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!compact) return false;
  if (REVIEW_SKIP_EXACT.has(compact)) return true;
  return /^(?:puan|degerlendirme)\s+(?:istemiyorum|atla|gec)$/.test(compact);
}

function hasReviewKeyword(normalizedText: string): boolean {
  return /\b(puan|yildiz|degerlendirme|rating)\b/.test(normalizedText);
}

function isStandaloneRatingMessage(normalizedText: string): boolean {
  if (!normalizedText) return false;
  if (/^[1-5]$/.test(normalizedText)) return true;
  if (/^[1-5]\s*(?:yildiz|star|puan)?$/.test(normalizedText)) return true;
  // Strong words only as standalone; exclude bir/iki/uc/iyi/guzel alone.
  if (/^(bes|dort|harika|mukemmel|super|orta|kotu|berbat)$/.test(normalizedText)) {
    return true;
  }
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

  // Cover cron delay up to 48h + reply buffer.
  const lookbackStart = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const phoneKeys = phoneVariants(customerPhone);
  let aptQuery = supabase
    .from("appointments")
    .select("id, service_slug, extra_data, customer_phone")
    .eq("tenant_id", tenantId)
    .lt("slot_start", thirtyMinutesAgo.toISOString())
    .gte("slot_start", lookbackStart.toISOString())
    .in("status", ["completed", "confirmed"])
    .order("slot_start", { ascending: false })
    .limit(1);
  if (phoneKeys.length > 0) {
    aptQuery = aptQuery.in("customer_phone", phoneKeys);
  } else {
    aptQuery = aptQuery.eq("customer_phone", customerPhone);
  }
  const { data: apt } = await aptQuery.maybeSingle();

  if (!apt) {
    // Don't hijack normal chat when there is no recent reviewable appointment.
    if (!hasKeywordSignal && !hasStarSymbol && !wantsSkip) {
      return { handled: false };
    }
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

  // Standalone ratings AND skip phrases require an outstanding review reminder.
  if (!hasKeywordSignal && !hasStarSymbol && !reminderSentAt) {
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
