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
  buildSectorRulesPrompt,
  getSectorProfileByKey,
  type SectorProfile,
} from "./sectorProfile.service";
import {
  SERVICE_FIRST_FLOW_RULE,
  SERVICE_SELECTED_CONTINUE_RULE,
  OUT_OF_HOURS_RULE,
  NEGOTIATION_RULE,
  RESCHEDULE_RULE,
  DATE_OPEN_CHECK_RULE,
  RETURNING_CUSTOMER_RULE,
  SCOPE_RULE,
  NO_REPEAT_RULE,
  LEGAL_REQUEST_RULE,
  IMAGE_CONTENT_RULE,
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
  /** Müşterinin gelecekteki aktif randevuları (saatli). */
  upcomingAppointments?: string;
  /** Panel CRM kartı (özet + profil alanları); kısa tutulur. */
  crmProfile?: string;
  /** Önceki konuşmalardan kalıcı hafıza (crm_customers.bot_memory). */
  leadMemory?: string;
  /** Bu turda mevcut randevu iptal edildi; müşteri aynı mesajda yeni saat istedi. */
  justCancelled?: boolean;
  misunderstandingCount: number;
  /** Kayan hafıza: tek cümlelik durum özeti (legacy path ile tutarlılık). */
  stateSummary?: string;
  /**
   * İşletme tipinden türeyen sektör profili. Ton (esnaf ağzı serbest mi) ve
   * sağlık/operasyon kuralları buradan gelir. Verilmezse genel profil kullanılır.
   */
  sector?: SectorProfile;
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
  const sector = context.sector ?? getSectorProfileByKey("generic");
  const persona = buildBotPersona(config, tenantName);
  const examples = buildExamplesPrompt(config);
  const toneInstructions = buildToneInstructions(config, sector);
  const fieldInstructions = buildFieldInstructions(config);
  const toolUsage = buildToolUsageInstructions(sector);
  const sectorRules = buildSectorRulesPrompt(sector);
  const contextBlock = buildContextBlock(context);

  const escalationInstructions = `
Yapamayacağın bir şey çıkarsa nazikçe "Bu konuda yardımcı olamıyorum" de AMA müşteriyi boşlukta bırakma:
konu işletmeyle ilgiliyse (şikâyet, iade, yasal talep, özel durum) get_tenant_info ile iletişim bilgisini paylaş
ve ekibe iletileceğini söyle. Sadece işletmeyle tamamen ilgisiz taleplerde (kod, ödev, genel kültür) kısaca reddet.
Müşteri "insan", "yetkili", "sizi aramak istiyorum" yazarsa iletişim bilgilerini ver. [[INSAN]] yazma.`;

  const kurallar = [
    fieldInstructions,
    toolUsage,
    sectorRules,
    escalationInstructions,
    examples,
  ]
    .filter(Boolean)
    .join("\n\n");

  let out = `<rol>\n${persona.trim()}\n</rol>\n\n<ton>\n${toneInstructions.trim()}\n</ton>\n\n<kurallar>\n${kurallar.trim()}\n</kurallar>`;
  if (contextBlock.trim()) {
    out += `\n\n<bağlam>\n${contextBlock.trim()}\n</bağlam>`;
  }
  return out;
}

function buildToneInstructions(config: MergedConfig, sector: SectorProfile): string {
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

  // Esnaf ağzı ("Tamam abi, yazdım seni") her sektörde uygun değil: diş kliniği
  // veya lazer merkezinde güven kaybettirir. Sektör profili karar verir.
  const registerLine = sector.allowCasualSlang
    ? '- Randevu veya iptal onayında uzun metin yazma; kısa ve samimi onayla (örn. "Tamam, yazdım seni").'
    : '- Randevu veya iptal onayında uzun metin yazma; kısa, kibar ve profesyonel onayla (örn. "Randevunuzu oluşturdum."). Argo ve "abi/abla/kanka" gibi laubali hitaplar kullanma.';

  return `
Ton ve stil:
- ${formal}
- ${length}
- ${emojis}
- Resmi ve robotik olma, doğal konuş. İş çözmeye yönelik ve net ol.
${registerLine}
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

/**
 * Araç POLİTİKASI — araçların ne olduğu değil, NE ZAMAN ve HANGİ SIRAYLA
 * çağrılacağı. Parametre/açıklama zaten `tools` şemasıyla API'ye ayrıca
 * gidiyor; burada tekrar anlatmak token'ı iki kez ödemek demekti.
 *
 * Bloklar sektöre göre kapatılır: paketi olmayan bir berbere paket kuralları
 * göndermek hem maliyet hem gürültü (model olmayan aracı zorluyordu).
 */
function buildToolUsageInstructions(sector: SectorProfile): string {
  const flags = sector.defaultFeatureFlags;
  const lines: string[] = [
    `ÖNCE HİZMET: ${SERVICE_FIRST_FLOW_RULE.replace(/^HİZMET ÖNCELİKLİ AKIŞ:\s*/u, "")}`,
    SERVICE_SELECTED_CONTINUE_RULE,
    OUT_OF_HOURS_RULE,
    NEGOTIATION_RULE,
    RESCHEDULE_RULE,
    DATE_OPEN_CHECK_RULE,
    RETURNING_CUSTOMER_RULE,
    SCOPE_RULE,
    NO_REPEAT_RULE,
    LEGAL_REQUEST_RULE,
    IMAGE_CONTENT_RULE,
    "GERÇEK KAYNAK ARAÇLARDIR: Müsaitlik, fiyat, süre ve randevu bilgisini ASLA tahmin etme; ilgili aracı çağır ve dönen değeri aynen kullan.",
    'MÜSAİTLİK SONUCU: has_available_slots→saatleri sun. fully_booked→"o gün dolu". too_late_today→"bugün DOLU DEĞİL, kapanışa yetişmiyor" de ve en yakın günü öner. closed_day/blocked_holiday→"o gün kapalıyız". Listede olmayan saate "olur" deme, listedekini "yetmez" diye eleme.',
    "SÜRE: get_services.duration_minutes dışında süre söyleme. create_appointment end_time dönerse bitiş saatini de belirt.",
    'İPTAL: Önce get_last_appointment, sonra açık onay ("evet iptal"), sonra cancel_appointment. Müşteri aynı mesajda yeni saat de istediyse iptalden sonra DURMA, yeni randevuyu da oluştur.',
    // Canlı testte model ilk kişiyi yazıp ikinciyi sessizce düşürüyordu; onay
    // mesajı da tekil olduğu için müşteri eksiği fark etmiyordu.
    "ÇOKLU KİŞİ: Bir mesajda birden fazla isim geçiyorsa AYNI turda her kişi için AYRI create_appointment çağır; ilkini alıp durma. Bittiğinde kaç randevu açtığını isimleriyle say (\"Emre 13:00, Kaan 13:30\"). Biri için saat doluysa o kişiye alternatif saat öner; sessizce atlama. Sadece bir randevu açabildiysen bunu açıkça söyle.",
  ];

  if (flags.staff_preference) {
    lines.push(
      "PERSONEL: Müşteri belirli bir uzman isterse staff_id alanına o kişinin ADINI yaz (ID'leri bilmiyorsun; sistem adı eşleştirir) ve randevuyu onunla aç. Personel tercihini sessizce yok sayma."
    );
  }
  if (flags.packages) {
    lines.push(
      'PAKET: Hizmet seçilince check_customer_package çağır; aktif paket varsa "Kalan X seansınızdan 1 düşülecek, onaylıyor musunuz?" diye sor, onayda use_package:true gönder. ACTIVE_PACKAGE_CONFIRMATION_REQUIRED dönerse önce onay al. "Paket var mı / kaç seans" sorusunda get_packages ile listele; satışı sen tamamlama.'
    );
  }

  return `\nAraç politikası:\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
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

  if (context.upcomingAppointments) {
    block += `\n\n${context.upcomingAppointments}
Bunlar BU müşterinin randevuları; dolu görünürse "orası sizin randevunuz" de. Aynı güne yenisi isterse önce mevcutu hatırlat (taşıma mı, ikinci mi).`;
  }

  if (context.crmProfile) {
    block += `\n\n${context.crmProfile}`;
  }

  if (context.customerHistory) {
    block += `\n\nMüşteri geçmişi:\n${context.customerHistory}`;
  }

  if (context.leadMemory) {
    block += `\n\nÖnceki konuşmalardan hatırladıkların:
${context.leadMemory}
Not: Bunları doğal biçimde kullan, "kayıtlarımda şöyle yazıyor" gibi konuşma.
Emin olmadığın bir şeyi buradan varsayma; gerekirse kısaca teyit et.`;
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

  if (context.justCancelled) {
    block += `\n\nÖNEMLİ: Müşterinin mevcut randevusu BU MESAJDA iptal edildi.
Tekrar iptal etme, "iptal edeyim mi" diye sorma. Müşteri aynı mesajda yeni bir
saat istedi: önce iptali tek cümleyle onayla, sonra istenen saat için
check_availability/create_appointment ile yeni randevuyu oluştur.`;
  }

  if (context.misunderstandingCount > 0) {
    block += `\n\nDikkat: Müşteri ${context.misunderstandingCount} kez anlaşılamadı. Daha basit sor.`;
  }

  return block;
}
