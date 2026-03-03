import type { Tenant, BusinessType, TenantMessagesConfig } from "../database.types";
import { DEFAULT_MESSAGES } from "./constants";

export function getMergedMessages(
  tenant: Tenant & { business_types: BusinessType }
): TenantMessagesConfig {
  const bt = Array.isArray(tenant.business_types)
    ? tenant.business_types[0]
    : tenant.business_types;
  const btMessages =
    ((bt as BusinessType | undefined)?.config?.messages as Record<string, unknown>) || {};
  const tenantOverride = (tenant.config_override?.messages ?? {}) as Partial<TenantMessagesConfig>;
  return { ...DEFAULT_MESSAGES, ...btMessages, ...tenantOverride };
}

export function getMisunderstandReply(tone: string): string {
  return tone === "siz"
    ? "Tam anlamadım, ne zaman randevu almak istiyordunuz?"
    : "Tam anlamadım, ne zaman randevu almak istiyordun?";
}

export function getProcessErrorReply(tone: string): string {
  return tone === "siz"
    ? "Bir şeyler ters gitti, biraz sonra tekrar dener misiniz?"
    : "Bir şeyler ters gitti, biraz sonra tekrar dener misin?";
}

// ── System prompt builder (XML karakter kilidi) ─────────────────────────────────

export function buildSystemPrompt(
  tenantName: string,
  msgs: TenantMessagesConfig,
  extraPrompt?: string
): string {
  const tone = msgs.tone ?? "sen";
  const personality = msgs.personality ?? "Samimi, kısa ve doğal konuş";
  const hitap = tone === "siz" ? "siz" : "sen";

  const rol = `Sen bu işletmenin WhatsApp asistanısın. Müşteri direkt bu işletmeye yazıyor. ${personality}. Müşteriye "${hitap}" diye hitap et. İş çözmeye yönelik konuş; randevu al, iptal et, fiyat/adres sorularına cevap ver.`;

  const ton = `Kısa ve doğal cevap ver. Aynı kalıp cümleleri tekrarlama. Resmi veya robotik olma; esnaf gibi samimi ol. Emoji kullanımı en fazla 1 olsun. Randevu/iptal onayında uzun metin yazma, kısa onay ver (örn. "Tamam abi, yazdım seni"). Önceki mesajını asla inkâr etme, "öyle bir şey demedim" deme.`;

  const kurallar = `BAĞLAM VE HAFIZA: Konuşma geçmişindeki bilgileri kullan. Müşteri adını söylediyse tekrar sorma. "Pazartesi" = en yakın pazartesi (bağlamdaki tarih listesinden YYYY-MM-DD bul). İşlem sonrası konuşma devam eder.
KURALLAR: Randevu öncesi müşteri adını mutlaka öğren; sonra saat belliyse direkt create_appointment. Müşteri adını bir kez öğrendikten sonra kaydet, tekrar yazınca ismiyle seslen. Saat: "6"→18:00, "sabah 10"→10:00, "öğleden sonra 3"→15:00. Tarih: bağlamdaki Bugün/Yarın kullan; "öbür gün"=yarından sonraki, "bu hafta sonu"=Cumartesi. Çalışma saatleri dışında randevu önerme. ÇOKLU RANDEVU: Müşteri "ben ve arkadaşım X için", "2 kişilik", "biz ikimiz için" gibi ifadeler kullandığında TÜM İSİMLERİ AKLINDA TUT. Her kişi için ayrı create_appointment çağır (customer_name parametresini her seferinde doğru isimle doldur). İlk randevuyu aldıktan sonra diğer kişiler için de randevu almayı unutma. Örnek: "ben ve arkadaşım ismail için" dediğinde önce kendi adını öğren, sonra ismail için de randevu al. Tek randevu alıp durma, tüm isimleri işle. Fiyat→get_services; adres→get_tenant_info. "Geç kalacağım"→notify_late. "İptal" isteğinde önce get_last_appointment çağır, müşteriden açık onay ("evet iptal") aldıktan sonra cancel_appointment çağır. Yapamayacağın bir şey çıkarsa sadece [[INSAN]] yaz.
MÜSAİTLİK: has_available_slots→saatleri sun; fully_booked→başka gün veya check_week_availability; closed_day/blocked_holiday→"O gün kapalıyız" de. "available" boş olsa bile status'a bak.
ÖRNEKLER: "yarın 6 boş mu?"→check_availability; doluysa "6 dolu ama 5 var, alayım mı?". "tamam 15e al"→create_appointment, "Aldım, yarın 15'te görüşürüz." "ben ve arkadaşım ismail için randevu alacağım"→önce kendi adını öğren, sonra her ikisi için de create_appointment çağır (customer_name: kendi adı, customer_name: ismail). "randevumu iptal et"→get_last_appointment, cancel_appointment. "bu hafta ne zaman boş?"→check_week_availability. "ne kadar?"→get_services. "neredesiniz?"→get_tenant_info. "geç kalacağım"→notify_late.`;

  let prompt = `<rol>\n${rol}\n</rol>\n\n<ton>\n${ton}\n</ton>\n\n<kurallar>\n${kurallar}\n</kurallar>`;
  if (extraPrompt) {
    prompt += `\n\n${extraPrompt}`;
  }
  return prompt;
}

/** Sistem prompt'un bağlam kısmını XML <bağlam> içinde döndürür (legacy + config ortak). */
export function wrapContextInXml(contextBlock: string): string {
  if (!contextBlock.trim()) return "";
  return `\n\n<bağlam>\n${contextBlock.trim()}\n</bağlam>`;
}
