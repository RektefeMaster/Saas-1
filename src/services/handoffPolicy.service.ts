/**
 * Central handoff evaluation — no scattered if-blocks in processor.
 */

export type HandoffSignalType =
  | "HUMAN_REQUEST"
  | "LOW_CONFIDENCE"
  | "LEGAL_THREAT"
  | "COMPLAINT"
  | "DISCOUNT_LIMIT"
  | "REPEATED_MISUNDERSTANDING"
  | "VIP"
  | "MEDICAL_RISK"
  | "CRISIS_ABUSE";

export type HandoffSeverity = "low" | "medium" | "high" | "critical";

export type HandoffSignal = {
  type: HandoffSignalType;
  severity: HandoffSeverity;
  evidence: string[];
  recommendedAction?: string;
};

export type HandoffContext = {
  humanRequested?: boolean;
  misunderstandingCount?: number;
  isAbusive?: boolean;
  isVip?: boolean;
  healthcare?: boolean;
  medicalRiskLanguage?: boolean;
  legalThreatLanguage?: boolean;
  complaintLanguage?: boolean;
  discountExceedsLimit?: boolean;
  lowConfidence?: boolean;
  messageText?: string;
};

export type HandoffDecision = {
  shouldHandoff: boolean;
  signals: HandoffSignal[];
  primaryReason: string | null;
  priority: "normal" | "high" | "urgent";
  recommendedAction: string | null;
};

const LEGAL_RE =
  /avukat|dava|savc[ıi]|hukuk|tazminat|şikayet\s*edece[ğg]| consumeraffairs|BBB/i;
const COMPLAINT_RE =
  /şikayet|rezalet|paramı\s*iade|berbat|çok\s*kötü|iğrenç|skandal/i;
// Bare "acil" matches scheduling ("acil bir saat"); require medical context.
const MEDICAL_RISK_RE =
  /şiş(ti|miş)|nefes\s*alam[ıi]|bayıl|kanama|çok\s*ağr[ıi]yor|alerji\s*oldu|yüzüm\s*şiş|acil\s*(durum|müdahale|servis|sağlık)|tıbbi\s*acil/i;

export function detectCrisisSignals(messageText: string | undefined): {
  legalThreatLanguage: boolean;
  complaintLanguage: boolean;
  medicalRiskLanguage: boolean;
} {
  const text = messageText || "";
  return {
    legalThreatLanguage: LEGAL_RE.test(text),
    complaintLanguage: COMPLAINT_RE.test(text),
    medicalRiskLanguage: MEDICAL_RISK_RE.test(text),
  };
}

export function evaluateHandoff(ctx: HandoffContext): HandoffDecision {
  const signals: HandoffSignal[] = [];
  const crisis = detectCrisisSignals(ctx.messageText);

  if (ctx.humanRequested) {
    signals.push({
      type: "HUMAN_REQUEST",
      severity: "high",
      evidence: ["customer_requested_human"],
      recommendedAction: "Personel devralsın",
    });
  }

  if ((ctx.misunderstandingCount || 0) >= 2) {
    signals.push({
      type: "REPEATED_MISUNDERSTANDING",
      severity: "medium",
      evidence: [`misunderstandings=${ctx.misunderstandingCount}`],
      recommendedAction: "Kısa özetle personel devam etsin",
    });
  }

  if (ctx.isAbusive) {
    signals.push({
      type: "CRISIS_ABUSE",
      severity: "high",
      evidence: ["abusive_language"],
      recommendedAction: "Sakin tonla yönetici yanıtlasın",
    });
  }

  if (ctx.isVip) {
    signals.push({
      type: "VIP",
      severity: "high",
      evidence: ["vip_customer"],
      recommendedAction: "VIP temsilciye aktar",
    });
  }

  if (ctx.lowConfidence) {
    signals.push({
      type: "LOW_CONFIDENCE",
      severity: "medium",
      evidence: ["model_low_confidence"],
      recommendedAction: "Doğrulayıp cevapla veya aktar",
    });
  }

  if (ctx.discountExceedsLimit) {
    signals.push({
      type: "DISCOUNT_LIMIT",
      severity: "high",
      evidence: ["discount_over_limit"],
      recommendedAction: "Yetkili indirim onayı",
    });
  }

  if (ctx.legalThreatLanguage || crisis.legalThreatLanguage) {
    signals.push({
      type: "LEGAL_THREAT",
      severity: "critical",
      evidence: ["legal_threat_language"],
      recommendedAction: "Yönetici + kayıt altına al",
    });
  }

  if (ctx.complaintLanguage || crisis.complaintLanguage) {
    signals.push({
      type: "COMPLAINT",
      severity: "high",
      evidence: ["complaint_language"],
      recommendedAction: "Şikayet prosedürü ile personel",
    });
  }

  // Medical risk handoff only for healthcare sectors (or explicit medicalRisk flag).
  if (
    ctx.healthcare &&
    (ctx.medicalRiskLanguage || crisis.medicalRiskLanguage)
  ) {
    signals.push({
      type: "MEDICAL_RISK",
      severity: "critical",
      evidence: ["medical_urgency_language"],
      recommendedAction:
        "Acil sağlık ifadesi — bot teşhis koymaz; kliniği aramalarını söyle ve personele aktar",
    });
  }

  if (signals.length === 0) {
    return {
      shouldHandoff: false,
      signals: [],
      primaryReason: null,
      priority: "normal",
      recommendedAction: null,
    };
  }

  const severityRank: Record<HandoffSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  signals.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  const top = signals[0];
  const priority =
    top.severity === "critical" ? "urgent" : top.severity === "high" ? "high" : "normal";

  return {
    shouldHandoff: true,
    signals,
    primaryReason: top.type,
    priority,
    recommendedAction: top.recommendedAction || null,
  };
}

export function buildHandoffSummarySnapshot(input: {
  intent?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  collectedFields?: Record<string, unknown>;
  leadScore?: number | null;
  decision: HandoffDecision;
  plainSummary?: string | null;
}): {
  version: 1;
  generatedAt: string;
  intent?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  collectedFields?: Record<string, unknown>;
  leadScore?: number | null;
  handoffSignals: Array<{ type: string; severity: string; evidence: string[] }>;
  recommendedAction?: string | null;
  plainSummary?: string | null;
} {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    intent: input.intent ?? null,
    serviceId: input.serviceId ?? null,
    serviceName: input.serviceName ?? null,
    collectedFields: input.collectedFields || {},
    leadScore: input.leadScore ?? null,
    handoffSignals: input.decision.signals.map((s) => ({
      type: s.type,
      severity: s.severity,
      evidence: s.evidence,
    })),
    recommendedAction: input.decision.recommendedAction,
    plainSummary: input.plainSummary ?? null,
  };
}
