/**
 * A0 — Critical runtime guardrails.
 * Tool/DB kanıtı olmadan kesin fiyat, randevu onayı, kampanya veya sağlık garantisi
 * müşteriye gitmemeli. Tam evidence envelope C2'de; burada minimum engel katmanı.
 */

export type ToolEvidence = {
  name: string;
  ok: boolean;
  result: Record<string, unknown>;
};

export type GuardrailContext = {
  healthcare: boolean;
  toolEvidence: ToolEvidence[];
  tone?: "sen" | "siz";
};

export type GuardrailVerdict =
  | { action: "allow"; reply: string }
  | { action: "rewrite"; reply: string; reason: string }
  | { action: "block"; reply: string; reason: string };

/** C2 — structured claim evidence (optional; strengthens A0). */
export type ResponseClaim = {
  type: "price" | "campaign" | "appointment" | "availability" | "other";
  value: string;
  source?: { tool: string; recordId?: string };
};

export type ResponseEvidenceEnvelope = {
  message: string;
  claims?: ResponseClaim[];
  requiresHuman?: boolean;
};

/**
 * Validate claims against tool evidence for the current request.
 * Missing/mismatched source → rewrite.
 */
export function validateEvidenceEnvelope(
  envelope: ResponseEvidenceEnvelope,
  toolEvidence: ToolEvidence[],
  tone?: "sen" | "siz"
): GuardrailVerdict {
  if (envelope.requiresHuman) {
    return {
      action: "rewrite",
      reply: softTone(
        tone,
        "Bu konuda ekibimizi devreye alıyorum.",
        "Bu konuda ekibimizi devreye alıyorum."
      ),
      reason: "requires_human",
    };
  }

  const claims = envelope.claims || [];
  if (!claims.length) {
    return applyCriticalGuardrails(envelope.message, {
      healthcare: false,
      toolEvidence,
      tone,
    });
  }

  for (const claim of claims) {
    if (claim.type === "price" || claim.type === "campaign" || claim.type === "appointment") {
      const toolName = claim.source?.tool;
      if (!toolName) {
        return {
          action: "rewrite",
          reply: softTone(
            tone,
            "Güncel bilgiyi doğrulamak için sizi ekibe aktarıyorum.",
            "Güncel bilgiyi doğrulamak için sizi ekibe aktarıyorum."
          ),
          reason: "claim_missing_source",
        };
      }
      const match = toolEvidence.find((e) => e.name === toolName && e.ok);
      if (!match) {
        return {
          action: "rewrite",
          reply: softTone(
            tone,
            "Güncel bilgiyi doğrulamak için sizi ekibe aktarıyorum.",
            "Güncel bilgiyi doğrulamak için sizi ekibe aktarıyorum."
          ),
          reason: "claim_tool_missing",
        };
      }
      const blob = JSON.stringify(match.result).toLowerCase();
      const valueDigits = claim.value.replace(/\D/g, "");
      if (valueDigits && !blob.includes(valueDigits) && !blob.includes(claim.value.toLowerCase())) {
        return {
          action: "rewrite",
          reply: softTone(
            tone,
            "Güncel fiyat bilgisini doğrulamak için sizi ekibe aktarıyorum.",
            "Güncel fiyat bilgisini doğrulamak için sizi ekibe aktarıyorum."
          ),
          reason: "claim_mismatch",
        };
      }
    }
  }

  return { action: "allow", reply: envelope.message };
}

const PRICE_CLAIM_RE =
  /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:tl|try|₺)|(?:fiyat(?:ı|i)?|ücret(?:i)?|tutar(?:ı)?)\s*(?:[:.]?\s*)?(?:\d)/i;

const APPOINTMENT_CONFIRM_RE =
  /randevu(?:nuz|n|nı|nu)?\s+(?:oluşturuldu|alındı|kaydedildi|onaylandı)|(?:oluşturdum|aldım|kaydettim|onayladım).*randevu/i;

const CAMPAIGN_CLAIM_RE =
  /(?:kampanya|indirim|promosyon|fırsat).{0,40}(?:var|geçerli|uyguluyoruz|sunuyoruz)|%\s*\d{1,2}\s*indirim/i;

const HEALTH_GUARANTEE_RE =
  /(?:kesin(?:likle)?\s+)?(?:sonuç|iyileş|geçer|bit(?:er|ecek)|kalıcı|garanti)|teşhis|tedavi\s+öner|ilaç\s+(?:kullan|al)|sana\s+uygun/i;

const TOOL_SUCCESS_CLAIM_RE =
  /(?:başarıyla|tamamlandı|oluşturuldu|kaydedildi|iptal\s+edildi|taşındı)/i;

function softTone(tone: "sen" | "siz" | undefined, sen: string, siz: string): string {
  return tone === "siz" ? siz : sen;
}

function hasSuccessfulTool(evidence: ToolEvidence[], names: string[]): boolean {
  const set = new Set(names);
  return evidence.some((e) => set.has(e.name) && e.ok);
}

function toolFailed(evidence: ToolEvidence[], names: string[]): boolean {
  const set = new Set(names);
  return evidence.some((e) => set.has(e.name) && !e.ok);
}

function extractPriceMentions(text: string): string[] {
  const withCurrency =
    text.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:tl|try|₺)/gi) || [];
  const labeled =
    text.match(
      /(?:fiyat(?:ı|i)?|ücret(?:i)?|tutar(?:ı)?)\s*[:.]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi
    ) || [];
  return [...withCurrency, ...labeled].map((m) => m.replace(/\s+/g, "").toLowerCase());
}

function pricesGroundedInTools(reply: string, evidence: ToolEvidence[]): boolean {
  const mentions = extractPriceMentions(reply);
  // PRICE_CLAIM_RE matched but no extractable amount → treat as ungrounded.
  if (mentions.length === 0) return false;

  const priceTokens = new Set<string>();
  for (const e of evidence.filter((x) => x.ok && x.result != null)) {
    const walk = (node: unknown): void => {
      if (node == null) return;
      if (typeof node === "number" && Number.isFinite(node)) {
        priceTokens.add(String(Math.round(node)));
        return;
      }
      if (typeof node === "string") {
        const n = node.replace(/[^\d]/g, "");
        if (n && /price|ücret|fiyat|amount|tutar/i.test(node) === false) {
          // keep numeric strings from structured fields via parent keys below
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/price|ücret|fiyat|amount|tutar/i.test(k)) {
            if (typeof v === "number") priceTokens.add(String(Math.round(v)));
            else if (typeof v === "string") {
              const digits = v.replace(/[^\d]/g, "");
              if (digits) priceTokens.add(digits);
            }
          } else {
            walk(v);
          }
        }
      }
    };
    walk(e.result);
  }

  if (priceTokens.size === 0) return false;

  return mentions.every((m) => {
    const digits = m.replace(/\D/g, "");
    if (!digits) return false;
    return priceTokens.has(digits);
  });
}

/**
 * Outbound öncesi kritik kontrol. Kanıt yoksa yumuşatır veya engeller.
 */
export function applyCriticalGuardrails(
  reply: string,
  ctx: GuardrailContext
): GuardrailVerdict {
  const text = (reply || "").trim();
  if (!text) {
    return {
      action: "block",
      reply: softTone(
        ctx.tone,
        "Şu an net bilgiye ulaşamadım, biraz sonra tekrar dener misin?",
        "Şu an net bilgiye ulaşamadım, biraz sonra tekrar dener misiniz?"
      ),
      reason: "empty_reply",
    };
  }

  // Tool failure + başarı iddiası
  const mutatingTools = [
    "create_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "create_recurring",
    "add_to_waitlist",
  ];
  if (toolFailed(ctx.toolEvidence, mutatingTools) && TOOL_SUCCESS_CLAIM_RE.test(text)) {
    return {
      action: "rewrite",
      reply: softTone(
        ctx.tone,
        "İşlemi tamamlayamadım. Tekrar dener misin veya ekibimize bağlanmanı sağlayayım?",
        "İşlemi tamamlayamadım. Tekrar dener misiniz veya ekibimize bağlanmanızı sağlayayım?"
      ),
      reason: "tool_failure_success_claim",
    };
  }

  // Randevu onayı tool başarısı olmadan
  if (
    APPOINTMENT_CONFIRM_RE.test(text) &&
    !hasSuccessfulTool(ctx.toolEvidence, [
      "create_appointment",
      "reschedule_appointment",
      "create_recurring",
    ])
  ) {
    return {
      action: "rewrite",
      reply: softTone(
        ctx.tone,
        "Randevuyu henüz kaydetmedim. Uygun gün ve saati birlikte netleştirelim.",
        "Randevuyu henüz kaydetmedim. Uygun gün ve saati birlikte netleştirelim."
      ),
      reason: "ungrounded_appointment_confirm",
    };
  }

  // Fiyat iddiası tool/DB kanıtı olmadan
  if (PRICE_CLAIM_RE.test(text)) {
    const priceToolsOk = hasSuccessfulTool(ctx.toolEvidence, [
      "get_services",
      "get_packages",
      "match_service",
      "check_customer_package",
    ]);
    if (!priceToolsOk || !pricesGroundedInTools(text, ctx.toolEvidence)) {
      return {
        action: "rewrite",
        reply: softTone(
          ctx.tone,
          "Güncel fiyatı listeden kontrol ediyorum. Hangi hizmet için bakmamı istersin?",
          "Güncel fiyatı listeden kontrol ediyorum. Hangi hizmet için bakmamı istersiniz?"
        ),
        reason: "ungrounded_price",
      };
    }
  }

  // Kampanya iddiası — tool payload'da kampanya/indirim kanıtı şart
  if (CAMPAIGN_CLAIM_RE.test(text)) {
    const campaignBlob = ctx.toolEvidence
      .filter((e) => e.ok)
      .map((e) => JSON.stringify(e.result || {}))
      .join(" ")
      .toLowerCase();
    const hasCampaignEvidence =
      /kampanya|indirim|discount|promo|fırsat|%\s*\d+/.test(campaignBlob);
    if (!hasCampaignEvidence) {
      return {
        action: "rewrite",
        reply: softTone(
          ctx.tone,
          "Kampanya bilgisini doğrulamam gerekiyor. Ekibimiz güncel fırsatları paylaşabilir; dilersen yönlendireyim.",
          "Kampanya bilgisini doğrulamam gerekiyor. Ekibimiz güncel fırsatları paylaşabilir; dilerseniz yönlendireyim."
        ),
        reason: "ungrounded_campaign",
      };
    }
  }

  // Sağlık garantisi / teşhis
  if (ctx.healthcare && HEALTH_GUARANTEE_RE.test(text)) {
    return {
      action: "rewrite",
      reply: softTone(
        ctx.tone,
        "Sonuç kişiye ve uygulamaya göre değişebilir. Uzman değerlendirmesi sonrası daha doğru bilgi verilebilir. Uygun bir görüşme planlayabilirim.",
        "Sonuç kişiye ve uygulamaya göre değişebilir. Uzman değerlendirmesi sonrasında daha doğru bilgi verilebilir. Uygun bir görüşme planlayabilirim."
      ),
      reason: "healthcare_guarantee",
    };
  }

  return { action: "allow", reply: text };
}
