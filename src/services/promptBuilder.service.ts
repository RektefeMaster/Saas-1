/**
 * Her konuşma için dinamik sistem promptu üretir.
 * business_type bot_config'inden okunur; tenant override'ları merge edilmiş config ile gelir.
 */

import type { MergedConfig } from "@/types/botConfig.types";
import {
  buildExamplesPrompt,
  buildBotPersona,
} from "./configMerge.service";
import {
  SERVICE_FIRST_FLOW_RULE,
  SERVICE_SELECTED_CONTINUE_RULE,
} from "@/lib/bot-v1/conversation/prompt-rules";

export interface PromptBuilderContext {
  today: string;
  tomorrow: string;
  currentTime?: string;
  timeZone?: string;
  todayLabel?: string;
  tomorrowLabel?: string;
  availableSlots?: string[];
  lastAvailabilityDate?: string;
  selectedServiceSlug?: string;
  selectedServiceName?: string;
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
Yapamayacağın bir şey çıkarsa nazikçe "Bu konuda yardımcı olamıyorum; randevu, fiyat veya müsaitlik için yazabilirsiniz" de.
Müşteri "insan", "yetkili", "sizi aramak istiyorum" yazarsa iletişim bilgilerini ver. [[INSAN]] yazma.`;

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
      ? `Emoji kullanımını minimumda tut. Gerekirse sadece bir tane kullan: ${tone.emoji_set.join(" ")}`
      : "Emoji kullanma.";

  return `
Ton ve stil:
- ${formal}
- ${length}
- ${emojis}
- Resmi ve robotik olma, doğal konuş. İş çözmeye yönelik, kısa ve samimi ol.
- Randevu veya iptal onayında uzun metin yazma; kısa esnaf ağzıyla cevap ver (örn. "Tamam abi, yazdım seni").
- Önceki mesajlarını asla inkâr etme. "Öyle bir şey demedim" gibi cümle kurma.`;
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
  const serviceFirstRuleLine = SERVICE_FIRST_FLOW_RULE.replace(/^HİZMET ÖNCELİKLİ AKIŞ:\s*/u, "");
  return `
Araç kullanımı (ne zaman hangi fonksiyonu çağır):
- RANDEVU AKIŞINDA ÖNCE HİZMET: ${serviceFirstRuleLine}
- ${SERVICE_SELECTED_CONTINUE_RULE}
- Tarih belli değilse veya müşteri "müsait mi?", "boş var mı?" derse → check_availability(date) (YYYY-MM-DD). service_slug ile çağır (hizmete göre süre hesaplanır).
- Müşteri belirli bir personel isterse (Ayşe, belirli uzman vb.) uygun staff_id ile check_availability ve create_appointment çağır.
- Hizmet seçildiyse ve paketli kullanım ihtimali varsa önce check_customer_package(service_slug) çağır.
- check_customer_package sonucu aktif paket dönerse müşteriye "Kalan X seansınızdan 1'i düşülecek, onaylıyor musunuz?" diye sor; onay alırsan create_appointment(..., use_package: true) çağır.
- create_appointment sonucu ACTIVE_PACKAGE_CONFIRMATION_REQUIRED dönerse önce onay sor; müşteri paketi kullanmak istemezse create_appointment(..., use_package: false) ile devam et.
- Tarih + saat + müşteri adı + service_slug toplandıysa → create_appointment(date, time, customer_name, service_slug, ...).
- ÇOKLU RANDEVU: Müşteri "ben ve arkadaşım X için", "2 kişilik", "biz ikimiz için" gibi ifadeler kullandığında TÜM İSİMLERİ AKLINDA TUT. Her kişi için ayrı create_appointment çağır (customer_name parametresini her seferinde doğru isimle doldur). İlk randevuyu aldıktan sonra diğer kişiler için de randevu almayı unutma. Örnek: "ben ve arkadaşım ismail için" dediğinde önce kendi adını öğren, sonra ismail için de randevu al. Tek randevu alıp durma, tüm isimleri işle.
- İptal isteğinde önce get_last_appointment çağır, müşteriden açık onay ("evet iptal") aldıktan sonra cancel_appointment(appointment_id) çağır.
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
Yarın: ${tomorrowDisplay}
Şu an: ${context.currentTime || "bilinmiyor"}
Saat dilimi: ${context.timeZone || "Europe/Istanbul"}`;

  if (context.customerHistory) {
    block += `\n\nMüşteri geçmişi:\n${context.customerHistory}`;
  }

  if (context.selectedServiceSlug || context.selectedServiceName) {
    block += `\n\nSeçili hizmet:
${context.selectedServiceName || context.selectedServiceSlug}
Not: Bu konuşmada tekrar hizmet sormadan aynı hizmetle ilerle.`;
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
