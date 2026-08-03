/**
 * A0 — Critical runtime guardrails.
 * Tool/DB kanıtı olmadan kesin fiyat, randevu onayı, kampanya veya sağlık garantisi
 * müşteriye gitmemeli. Tam evidence envelope C2'de; burada minimum engel katmanı.
 *
 * TASARIM: kural CÜMLE bazında çalışır. Eskiden tek bir dayanaksız ifade cevabın
 * TAMAMINI hazır bir metinle değiştiriyordu; bu yüzden "Ali için randevu
 * oluşturuldu, Veli için saat dolu" cevabı komple silinip müşteriye "İşlemi
 * tamamlayamadım" gidiyordu — oysa Ali'nin randevusu veritabanında duruyordu.
 * Artık yalnızca sorunlu cümle düşer, doğrulanmış kısım müşteriye ulaşır.
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
 * Panelde onaylanan bilgi bankası kayıtları da bir kanıt kaynağıdır.
 * processor bu adla sentetik bir ToolEvidence ekler; aksi halde işletmenin
 * panelde yazdığı kampanya bilgisini bot asla söyleyemezdi (kampanya döndüren
 * bir tool yok).
 */
export const KNOWLEDGE_EVIDENCE_NAME = "tenant_knowledge";

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
  /(?<![\d.,])\d[\d.,]*\s*(?:tl|try|₺)|(?:fiyat(?:ı|i)?|ücret(?:i)?|tutar(?:ı)?)\s*(?:[:.]?\s*)?(?:\d)/i;

const CAMPAIGN_CLAIM_RE =
  /(?:kampanya|indirim|promosyon|fırsat).{0,40}(?:var|geçerli|uyguluyoruz|sunuyoruz)|%\s*\d{1,2}\s*indirim/i;

/**
 * Sağlık garantisi / teşhis iddiası.
 *
 * Eski hali `sonuç|iyileş|geçer|bit(er|ecek)|kalıcı|garanti` alternatiflerini
 * serbest bırakıyordu; "işlem 30 dakikada biter", "bu fiyat bu ay geçerli",
 * "kalıcı dolgu" gibi tamamen masum cümleler eziliyor ve müşteriye alakasız
 * "sonuç kişiye göre değişebilir" metni gidiyordu. Artık gerçekten GARANTİ,
 * TEŞHİS veya TEDAVİ ÖNERİSİ kalıbı aranır.
 */
const HEALTH_GUARANTEE_RE = new RegExp(
  [
    // "kesin(likle) sonuç / geçer / iyileşir / biter"
    "kesin(?:likle)?\\s+(?:sonu[çc]|ge[çc]er|iyile[şs]|biter|bitecek|olur|fayda|d[üu]zel)",
    // "garanti ediyoruz", "sonuç garantili"
    "garanti(?:li|yoruz|ediyoruz|s[iı]|dir)?\\b",
    "%\\s*100",
    // "kalıcı sonuç/çözüm", "sonuç kalıcı"
    "kal[ıi]c[ıi]\\s+(?:sonu[çc]|[çc][öo]z[üu]m|iyile[şs]me)",
    "(?:sonu[çc]|etki|iyile[şs]me)\\s+kal[ıi]c[ıi]",
    // teşhis / tanı koyma
    "te[şs]his\\s*(?:koy|kon)",
    "tan[ıi]\\s*koy",
    // tedavi / ilaç önerisi — olumsuz çekimler ("öneremem") hariç
    "tedavi\\s+[öo]neri(?:yorum|m|si|si)\\b",
    "tedavi\\s+[öo]ner(?:irim|elim|ebilirim)\\b",
    // "ilaç" ek alınca ç→c yumuşar: "ilacı kullanın". Ek serbest bırakılmalı.
    "ila[çc]\\p{L}*\\s+(?:kullan[ıi]n|kullanabilir|al[ıi]n|yaz[ıi]yorum|[öo]neri)",
  ].join("|"),
  // `u` şart: `\p{L}` yalnızca unicode modunda çalışır, aksi halde desen sessizce bozulur.
  "iu"
);

/**
 * İşlem iddiası → o işlemi gerçekleştirebilecek tool'lar.
 * Kısmi başarıda doğru davranmak için iddia tipi ile tool eşlenir: "iptal
 * edildi" cümlesi create_appointment'ın başarısızlığından etkilenmemeli.
 */
const CLAIM_OPERATIONS: Array<{ re: RegExp; tools: string[] }> = [
  {
    re: /randevu(?:nuz|n|nı|nu|su)?\s+(?:oluşturuldu|alındı|kaydedildi|onaylandı|ayarlandı)|(?:oluşturdum|kaydettim|onayladım|ayarladım|yazdım)/i,
    tools: ["create_appointment", "create_recurring", "reschedule_appointment"],
  },
  {
    re: /iptal\s+(?:edildi|ettim)/i,
    tools: ["cancel_appointment"],
  },
  {
    re: /(?:taşındı|taşıdım|ertelendi|erteledim|değiştirildi|değiştirdim)/i,
    tools: ["reschedule_appointment"],
  },
  {
    re: /(?:bekleme\s+listesine\s+(?:ekledim|eklendi)|listeye\s+ekledim)/i,
    tools: ["add_to_waitlist"],
  },
  {
    re: /(?:başarıyla|tamamlandı)/i,
    tools: [
      "create_appointment",
      "cancel_appointment",
      "reschedule_appointment",
      "create_recurring",
      "add_to_waitlist",
    ],
  },
];

function softTone(tone: "sen" | "siz" | undefined, sen: string, siz: string): string {
  return tone === "siz" ? siz : sen;
}

function hasSuccessfulTool(evidence: ToolEvidence[], names: string[]): boolean {
  const set = new Set(names);
  return evidence.some((e) => set.has(e.name) && e.ok);
}

function hasFailedTool(evidence: ToolEvidence[], names: string[]): boolean {
  const set = new Set(names);
  return evidence.some((e) => set.has(e.name) && !e.ok);
}

/**
 * "1.500,50" → 1501, "1.500" → 1500, "450" → 450.
 * Türkçe binlik ayracı nokta, ondalık ayracı virgüldür; ham `replace(/\D/g,"")`
 * "1.500,00"u 150000 yapıp doğru fiyatı dayanaksız sayıyordu.
 */
function parseTrAmount(raw: string): number | null {
  const cleaned = (raw || "").replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Eski desen `\d{1,3}(?:[.,]\d{3})*` ayraçsız 4+ haneli tutarları bozuyordu:
 * "1500 TL" içinden yalnızca "500 TL" çıkarılıyor, tool'daki 1500 ile
 * eşleşmediği için DOĞRU fiyat dayanaksız sayılıp cevaptan siliniyordu.
 * Lookbehind sayının başından yakalamayı garanti eder.
 */
function extractPriceMentions(text: string): string[] {
  const withCurrency = text.match(/(?<![\d.,])\d[\d.,]*\s*(?:tl|try|₺)/gi) || [];
  const labeled =
    text.match(
      /(?:fiyat(?:ı|i)?|ücret(?:i)?|tutar(?:ı)?)\s*[:.]?\s*(?<![\d.,])\d[\d.,]*/gi
    ) || [];
  return [...withCurrency, ...labeled].map((m) => m.replace(/\s+/g, "").toLowerCase());
}

function collectPriceTokens(evidence: ToolEvidence[]): Set<number> {
  const priceTokens = new Set<number>();
  for (const e of evidence.filter((x) => x.ok && x.result != null)) {
    const walk = (node: unknown): void => {
      if (node == null) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/price|ücret|fiyat|amount|tutar/i.test(k)) {
            if (typeof v === "number" && Number.isFinite(v)) {
              priceTokens.add(Math.round(v));
            } else if (typeof v === "string") {
              const parsed = parseTrAmount(v);
              if (parsed != null) priceTokens.add(parsed);
            }
          } else {
            walk(v);
          }
        }
      }
    };
    walk(e.result);
  }
  return priceTokens;
}

function pricesGroundedInSentence(sentence: string, priceTokens: Set<number>): boolean {
  const mentions = extractPriceMentions(sentence);
  // PRICE_CLAIM_RE eşleşti ama çıkarılabilir tutar yok → dayanaksız say.
  if (mentions.length === 0) return false;
  if (priceTokens.size === 0) return false;
  return mentions.every((m) => {
    const amount = parseTrAmount(m);
    return amount != null && priceTokens.has(amount);
  });
}

/**
 * Cümlelere böler. Satır sonları korunur ki çok satırlı onay metinleri
 * (şablon çıktıları) parçalanınca okunabilir kalsın.
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

type SentenceRule = {
  reason: string;
  /** Cümle dayanaksız mı? */
  offends: (sentence: string) => boolean;
  /** Cevabın tamamı düşerse gidecek metin. */
  fallback: string;
  /** Temiz cümleler kalırsa sonuna eklenecek kısa açıklama. */
  appendix: string;
};

function buildRules(ctx: GuardrailContext): SentenceRule[] {
  const tone = ctx.tone;
  const rules: SentenceRule[] = [];
  const priceTokens = collectPriceTokens(ctx.toolEvidence);

  // 1) İşlem iddiası — iddia edilen işlemi yapan tool başarılı olmalı.
  rules.push({
    reason: "ungrounded_operation_claim",
    offends: (s) => {
      const op = CLAIM_OPERATIONS.find((o) => o.re.test(s));
      if (!op) return false;
      return !hasSuccessfulTool(ctx.toolEvidence, op.tools);
    },
    fallback: softTone(
      tone,
      "İşlemi tamamlayamadım. Tekrar dener misin veya ekibimize bağlanmanı sağlayayım?",
      "İşlemi tamamlayamadım. Tekrar dener misiniz veya ekibimize bağlanmanızı sağlayayım?"
    ),
    appendix: softTone(
      tone,
      "Bu adımı henüz tamamlayamadım; birlikte netleştirelim.",
      "Bu adımı henüz tamamlayamadım; birlikte netleştirelim."
    ),
  });

  // 2) Fiyat — tool/DB kanıtı şart. Bilgi bankası fiyat kaynağı DEĞİLDİR
  //    (tek doğru kaynak `services`); bu bilinçli bir tasarım kararı.
  rules.push({
    reason: "ungrounded_price",
    offends: (s) => {
      if (!PRICE_CLAIM_RE.test(s)) return false;
      const priceToolsOk = hasSuccessfulTool(ctx.toolEvidence, [
        "get_services",
        "get_packages",
        "match_service",
        "check_customer_package",
      ]);
      if (!priceToolsOk) return true;
      return !pricesGroundedInSentence(s, priceTokens);
    },
    fallback: softTone(
      tone,
      "Güncel fiyatı listeden kontrol ediyorum. Hangi hizmet için bakmamı istersin?",
      "Güncel fiyatı listeden kontrol ediyorum. Hangi hizmet için bakmamı istersiniz?"
    ),
    appendix: softTone(
      tone,
      "Güncel fiyatı hizmet listesinden kontrol edeyim mi?",
      "Güncel fiyatı hizmet listesinden kontrol edeyim mi?"
    ),
  });

  // 3) Kampanya — tool payload'ında veya onaylı bilgi bankasında kanıt şart.
  rules.push({
    reason: "ungrounded_campaign",
    offends: (s) => {
      if (!CAMPAIGN_CLAIM_RE.test(s)) return false;
      const blob = ctx.toolEvidence
        .filter((e) => e.ok)
        .map((e) => JSON.stringify(e.result || {}))
        .join(" ")
        .toLowerCase();
      return !/kampanya|indirim|discount|promo|fırsat|firsat|%\s*\d+/.test(blob);
    },
    fallback: softTone(
      tone,
      "Kampanya bilgisini doğrulamam gerekiyor. Ekibimiz güncel fırsatları paylaşabilir; dilersen yönlendireyim.",
      "Kampanya bilgisini doğrulamam gerekiyor. Ekibimiz güncel fırsatları paylaşabilir; dilerseniz yönlendireyim."
    ),
    appendix: softTone(
      tone,
      "Güncel kampanyaları ekibimiz doğrulayıp paylaşabilir.",
      "Güncel kampanyaları ekibimiz doğrulayıp paylaşabilir."
    ),
  });

  // 4) Sağlık garantisi / teşhis.
  if (ctx.healthcare) {
    rules.push({
      reason: "healthcare_guarantee",
      offends: (s) => HEALTH_GUARANTEE_RE.test(s),
      fallback: softTone(
        tone,
        "Sonuç kişiye ve uygulamaya göre değişebilir. Uzman değerlendirmesi sonrası daha doğru bilgi verilebilir. Uygun bir görüşme planlayabilirim.",
        "Sonuç kişiye ve uygulamaya göre değişebilir. Uzman değerlendirmesi sonrasında daha doğru bilgi verilebilir. Uygun bir görüşme planlayabilirim."
      ),
      appendix: softTone(
        tone,
        "Sonuç kişiye göre değişebilir; net bilgi için uzman değerlendirmesi gerekir.",
        "Sonuç kişiye göre değişebilir; net bilgi için uzman değerlendirmesi gerekir."
      ),
    });
  }

  return rules;
}

/**
 * Outbound öncesi kritik kontrol. Kanıtsız cümleyi düşürür; cevabın
 * doğrulanmış kısmı korunur.
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

  const rules = buildRules(ctx);
  const sentences = splitIntoSentences(text);
  const kept: string[] = [];
  let firstOffence: { rule: SentenceRule; sentence: string } | null = null;

  for (const sentence of sentences) {
    const rule = rules.find((r) => r.offends(sentence));
    if (rule) {
      if (!firstOffence) firstOffence = { rule, sentence };
      continue;
    }
    kept.push(sentence);
  }

  if (!firstOffence) {
    return { action: "allow", reply: text };
  }

  const { rule, sentence } = firstOffence;

  // Geriye dönük uyumluluk: eski `reason` adları izlemede kullanılıyor.
  let reason = rule.reason;
  if (rule.reason === "ungrounded_operation_claim") {
    const op = CLAIM_OPERATIONS.find((o) => o.re.test(sentence));
    reason =
      op && hasFailedTool(ctx.toolEvidence, op.tools)
        ? "tool_failure_success_claim"
        : "ungrounded_appointment_confirm";
  }

  if (kept.length === 0) {
    return { action: "rewrite", reply: rule.fallback, reason };
  }

  return {
    action: "rewrite",
    reply: `${kept.join(" ")} ${rule.appendix}`.trim(),
    reason,
  };
}
