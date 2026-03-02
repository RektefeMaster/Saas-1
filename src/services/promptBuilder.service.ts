/**
 * Her konuşma için dinamik sistem promptu üretir.
 * business_type bot_config'inden okunur; tenant override'ları merge edilmiş config ile gelir.
 */

import type { MergedConfig } from "@/types/botConfig.types";
import {
  buildExamplesPrompt,
  buildBotPersona,
} from "./configMerge.service";

export interface PromptBuilderContext {
  today: string;
  tomorrow: string;
  todayLabel?: string;
  tomorrowLabel?: string;
  availableSlots?: string[];
  lastAvailabilityDate?: string;
  pendingCancelId?: string;
  customerHistory?: string;
  misunderstandingCount: number;
  /** Kayan hafıza: tek cümlelik durum özeti (legacy path ile tutarlılık). */
  stateSummary?: string;
}

/**
 * Tek giriş noktası: config + tenant adı + bağlam ile tam sistem promptu üretir.
 * XML blokları ile karakter kilidi: model rol/ton/kurallar/bağlamdan çıkmaz.
 */
export function buildSystemPrompt(
  config: MergedConfig,
  tenantName: string,
  context: PromptBuilderContext
): string {
  const persona = buildBotPersona(config, tenantName);
  const examples = buildExamplesPrompt(config);
  const toneInstructions = buildToneInstructions(config);
  const fieldInstructions = buildFieldInstructions(config);
  const toolUsage = buildToolUsageInstructions();
  const contextBlock = buildContextBlock(context);

  const escalationInstructions = `
Yapamayacağın bir şey çıkarsa, anlamadığın bir durum olursa,
müşteri "insan", "yetkili", "sizi aramak istiyorum" yazarsa:
Sadece [[INSAN]] yaz.`;

  const kurallar = [fieldInstructions, toolUsage, escalationInstructions, examples]
    .filter(Boolean)
    .join("\n\n");

  let out = `<rol>\n${persona.trim()}\n</rol>\n\n<ton>\n${toneInstructions.trim()}\n</ton>\n\n<kurallar>\n${kurallar.trim()}\n</kurallar>`;
  if (contextBlock.trim()) {
    out += `\n\n<bağlam>\n${contextBlock.trim()}\n</bağlam>`;
  }
  return out;
}

function buildToneInstructions(config: MergedConfig): string {
  const { tone } = config;
  const formal = tone.use_formal
    ? 'Müşteriye "siz" diye hitap et.'
    : 'Müşteriye "sen" diye hitap et.';
  const lengthMap: Record<string, string> = {
    kisa: "Çok kısa cevap ver, 1-2 cümle.",
    orta: "Orta uzunlukta cevap ver.",
    uzun: "Gerektiğinde detaylı açıkla.",
  };
  const length =
    lengthMap[tone.response_length] ?? "Orta uzunlukta cevap ver.";

  const emojis =
    tone.emoji_set?.length > 0
      ? `Şu emojileri kullanabilirsin: ${tone.emoji_set.join(" ")}`
      : "Emoji kullanma.";

  return `
Ton ve stil:
- ${formal}
- ${length}
- ${emojis}
- Resmi ve robotik olma, doğal konuş. İş çözmeye yönelik, kısa ve samimi ol.
- Randevu veya iptal onayında uzun metin yazma; kısa esnaf ağzıyla cevap ver (örn. "Tamam abi, yazdım seni").`;
}

function buildFieldInstructions(config: MergedConfig): string {
  const required = config.required_fields || [];
  const lines = required
    .map((f) => `- ${f.label}: ${f.question}`)
    .join("\n");
  const hints = required
    .filter((f) => f.extract_hint)
    .map((f) => `- ${f.label}: ${f.extract_hint}`)
    .join("\n");

  if (!lines) return "";

  return `
Toplaman gereken bilgiler:
${lines}
${hints ? `\nBilgi çıkarma ipuçları:\n${hints}` : ""}`;
}

function buildToolUsageInstructions(): string {
  return `
Araç kullanımı (ne zaman hangi fonksiyonu çağır):
- Tarih belli değilse veya müşteri "müsait mi?", "boş var mı?" derse → check_availability(date) (YYYY-MM-DD).
- Tarih + saat + müşteri adı (ve zorunlu alanlar) toplandıysa → create_appointment(date, time, customer_name, ...).
- İptal / "randevumu iptal et" isteği → önce get_last_appointment, sonra cancel_appointment(appointment_id).
- "Başka gün var mı?", "bu hafta ne zaman boş?" → check_week_availability(start_date).
- Randevu değiştirmek → get_last_appointment, sonra reschedule_appointment veya iptal + create_appointment.
- Her hafta aynı gün/saat → create_recurring(day_of_week, time).
- "Yer açılırsa haber ver" → add_to_waitlist(date, preferred_time).
- Fiyat / hizmet listesi → get_services.
- Adres, telefon, çalışma saatleri → get_tenant_info.
- "Geç kalacağım" → notify_late(minutes, message).
`;
}

function buildContextBlock(context: PromptBuilderContext): string {
  const todayDisplay = context.todayLabel ?? context.today;
  const tomorrowDisplay = context.tomorrowLabel ?? context.tomorrow;
  let block = context.stateSummary ? `${context.stateSummary}\n\n` : "";
  block += `
Bugün: ${todayDisplay}
Yarın: ${tomorrowDisplay}`;

  if (context.customerHistory) {
    block += `\n\nMüşteri geçmişi:\n${context.customerHistory}`;
  }

  if (
    context.lastAvailabilityDate &&
    context.availableSlots?.length
  ) {
    block += `\n\nMüsait saatler gösterildi:
Tarih: ${context.lastAvailabilityDate}
Saatler: ${context.availableSlots.join(", ")}
Müşteri saat söylerse create_appointment çağır.`;
  }

  if (context.pendingCancelId) {
    block += `\n\nİptal bekleyen randevu ID: ${context.pendingCancelId}
Müşteri onaylarsa cancel_appointment çağır.`;
  }

  if (context.misunderstandingCount > 0) {
    block += `\n\nDikkat: Müşteri ${context.misunderstandingCount} kez anlaşılamadı. Daha basit sor.`;
  }

  return block;
}
