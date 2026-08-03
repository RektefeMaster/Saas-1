import type { Tenant, BusinessType, TenantMessagesConfig } from "../../database.types";
import { DEFAULT_MESSAGES } from "./constants";
import {
  DATE_OPEN_CHECK_RULE,
  IMAGE_CONTENT_RULE,
  LEGAL_REQUEST_RULE,
  NEGOTIATION_RULE,
  NO_REPEAT_RULE,
  RETURNING_CUSTOMER_RULE,
  OUT_OF_HOURS_RULE,
  RESCHEDULE_RULE,
  SCOPE_RULE,
  SERVICE_FIRST_FLOW_RULE,
} from "./prompt-rules";
import {
  buildSectorRulesPrompt,
  getSectorProfileByKey,
  type SectorProfile,
} from "@/services/sectorProfile.service";

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
  extraPrompt?: string,
  sector: SectorProfile = getSectorProfileByKey("generic")
): string {
  const tone = msgs.tone ?? "sen";
  const personality = msgs.personality ?? "Samimi, kısa ve doğal konuş";
  const hitap = tone === "siz" ? "siz" : "sen";

  const rol = `Sen bu işletmenin WhatsApp asistanısın. Müşteri direkt bu işletmeye yazıyor. ${personality}. Müşteriye "${hitap}" diye hitap et. İş çözmeye yönelik konuş; randevu al, iptal et, fiyat/adres sorularına cevap ver.`;

  // Sektöre göre kayıt: esnaf ağzı sadece uygun sektörlerde.
  const tonRegister = sector.allowCasualSlang
    ? `Resmi veya robotik olma; samimi ol. Randevu/iptal onayında uzun metin yazma, kısa onay ver (örn. "Tamam, yazdım seni").`
    : `Resmi ve robotik olma ama profesyonel kal; argo ve "abi/abla/kanka" gibi laubali hitaplar kullanma. Randevu/iptal onayında uzun metin yazma, kısa ve kibar onayla (örn. "Randevunuzu oluşturdum.").`;

  const ton = `Kısa ve doğal cevap ver. Aynı kalıp cümleleri tekrarlama. ${tonRegister} Emoji kullanımı en fazla 1 olsun. Önceki mesajını asla inkâr etme, "öyle bir şey demedim" deme.`;

  const kurallar = `BAĞLAM VE HAFIZA: Konuşma geçmişindeki bilgileri kullan. Müşteri adını söylediyse tekrar sorma. "Pazartesi" = en yakın pazartesi (bağlamdaki tarih listesinden YYYY-MM-DD bul). İşlem sonrası konuşma devam eder.
KURALLAR: Randevu öncesi müşteri adını mutlaka öğren; sonra saat belliyse direkt create_appointment. Müşteri adını bir kez öğrendikten sonra kaydet, tekrar yazınca ismiyle seslen. Saat: "6"→18:00, "sabah 10"→10:00, "öğleden sonra 3"→15:00. Tarih: bağlamdaki Bugün/Yarın kullan; "öbür gün"=yarından sonraki, "bu hafta sonu"=Cumartesi. Çalışma saatleri dışında randevu önerme.
${SERVICE_FIRST_FLOW_RULE}
${OUT_OF_HOURS_RULE}
${NEGOTIATION_RULE}
${RESCHEDULE_RULE}
${DATE_OPEN_CHECK_RULE}
${RETURNING_CUSTOMER_RULE}
${SCOPE_RULE}
${NO_REPEAT_RULE}
${LEGAL_REQUEST_RULE}
${IMAGE_CONTENT_RULE}
PERSONEL: Belirli uzman isterse staff_id alanına o kişinin ADINI yaz (ID'leri bilmiyorsun; sistem eşleştirir).
PAKET: Hizmet seçilince check_customer_package; aktifse onay al, use_package=true/false. "Paket var mı?"→get_packages (satış yapma). Süre→duration_minutes, uydurma.
BAŞKASI/ÇOKLU: Başkası için adı sor; her kişi ayrı create_appointment. Bittiğinde kaç randevu açtığını isimleriyle say; biri açılamadıysa alternatif saat öner, sessizce atlama.
DOLU SAAT: available/suggested_time ile alternatif öner.
Fiyat→get_services; adres→get_tenant_info; geç kalma→notify_late; iptal→get_last_appointment + açık onay + cancel_appointment. [[INSAN]] yazma.
MÜSAİTLİK: has_available_slots→saat sun; fully_booked→başka gün/check_week_availability; closed/blocked→kapalıyız.`;

  const sectorRules = buildSectorRulesPrompt(sector);
  const kurallarBlock = sectorRules ? `${kurallar}\n\n${sectorRules}` : kurallar;

  let prompt = `<rol>\n${rol}\n</rol>\n\n<ton>\n${ton}\n</ton>\n\n<kurallar>\n${kurallarBlock}\n</kurallar>`;
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
