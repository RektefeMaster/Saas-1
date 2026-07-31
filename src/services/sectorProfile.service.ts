/**
 * Sektör profili: işletme tipinden (business_types.slug/name) türetilen davranış paketi.
 *
 * Neden var: bot promptları ve otomasyon metinleri berber/kuaför varsayımıyla
 * yazılmıştı ("esnaf ağzı", "ustaya ilettim"). Diş kliniği veya lazer epilasyon
 * merkezinde bu ton hem yanlış hem de riskli (tıbbi tavsiye/sonuç garantisi).
 * Sektör profili tek kaynak: hitap, operasyonel kurallar ve sağlık uyumu buradan gelir.
 *
 * `detectBlueprintSlug` de bu tespiti kullanır; iki ayrı keyword listesi tutulmaz.
 */

import type { BlueprintSlug } from "@/types/master-crm.types";
import type { FeatureFlags } from "@/types/feature-flags";

export type SectorKey =
  | "hair-beauty"
  | "nail"
  | "laser-aesthetic"
  | "dental"
  | "veterinary"
  | "auto-service"
  | "home-service"
  | "generic";

/** Canonical product codes (UI labels separate). */
export type CanonicalSectorCode =
  | "barber"
  | "hair_salon"
  | "beauty_center"
  | "laser_aesthetic"
  | "dental_clinic"
  | "nail_salon";

export type SectorCapabilities = {
  booking: boolean;
  staffSelection: boolean;
  servicePackages: boolean;
  sessionTracking: boolean;
  healthcareCompliance: boolean;
  beforeAfterMedia: boolean;
};

export interface SectorProfile {
  key: SectorKey;
  label: string;
  /** CRM/analitik tarafındaki blueprint karşılığı. */
  blueprint: BlueprintSlug;
  /**
   * Sağlık/medikal hizmet mi? True ise bot teşhis koyamaz, tedavi/ilaç öneremez,
   * sonuç garantisi veremez.
   */
  healthcare: boolean;
  /** "Tamam abi, yazdım seni" gibi esnaf ağzı bu sektörde uygun mu? */
  allowCasualSlang: boolean;
  /** İşletme sahibine sohbette nasıl referans verilir ("ustaya" / "ekibimize"). */
  staffNoun: string;
  /** match_service tool açıklamasında kullanılacak örnekler. */
  serviceExamples: string;
  /** Sisteme eklenecek sektöre özel operasyon kuralları (prompt bloğu). */
  operationalRules: string[];
  /** Bu sektörde varsayılan açık gelen özellik bayrakları. */
  defaultFeatureFlags: Partial<FeatureFlags>;
  /** Capability flags — prefer these over `if sector ===`. */
  capabilities: SectorCapabilities;
}

/** Wizard'da gösterilecek business_types.slug değerleri (yan sektörler gizlenir). */
export const WIZARD_ALLOWED_BUSINESS_TYPE_SLUGS = [
  "berber",
  "kuaför",
  "kuafor",
  "kadin-kuafor",
  "guzellik-merkezi",
  "lazer-epilasyon",
  "disci",
  "dis-klinigi",
  "tirnak-salonu",
] as const;

/** Legacy slug → canonical code */
export const SLUG_TO_CANONICAL: Record<string, CanonicalSectorCode> = {
  berber: "barber",
  kuaför: "hair_salon",
  kuafor: "hair_salon",
  "kadin-kuafor": "hair_salon",
  "guzellik-merkezi": "beauty_center",
  "lazer-epilasyon": "laser_aesthetic",
  disci: "dental_clinic",
  "dis-klinigi": "dental_clinic",
  "tirnak-salonu": "nail_salon",
};

const DEFAULT_CAPABILITIES: SectorCapabilities = {
  booking: true,
  staffSelection: false,
  servicePackages: false,
  sessionTracking: false,
  healthcareCompliance: false,
  beforeAfterMedia: false,
};

/** Sağlık/medikal sektörlerde geçerli ortak uyum kuralları. */
const HEALTHCARE_COMPLIANCE_RULES: string[] = [
  "SAĞLIK SINIRI: Sen bir sağlık çalışanı değilsin. Teşhis koyma, tedavi planı önerme, ilaç/doz tavsiye etme, \"şu işlem sana uygun\" deme. Müşteri şikâyetini anlatırsa kısaca anla ve \"Bunu uzmanımız muayenede değerlendirir\" diyerek randevuya yönlendir.",
  "SONUÇ VAADİ YOK: Kaç seansta biter, kalıcı mı, iz kalır mı gibi sorularda kesin rakam veya garanti verme. \"Kişiden kişiye değişir, uzmanımız ilk değerlendirmede net söyler\" de.",
  "HASSAS VERİ: Müşterinin paylaştığı sağlık bilgisini (hastalık, ilaç, gebelik, kronik rahatsızlık) tekrar yazma, özetleme veya teyit amacıyla geri okuma. Sadece \"Not aldım, uzmanımız görüşmede detaylandırır\" de. TC kimlik, sigorta veya kart bilgisi asla isteme; müşteri gönderirse bir daha paylaşmamasını nazikçe söyle.",
];

const SECTOR_PROFILES: Record<SectorKey, SectorProfile> = {
  "hair-beauty": {
    key: "hair-beauty",
    label: "Kuaför / Güzellik Salonu",
    blueprint: "hair-beauty",
    healthcare: false,
    allowCasualSlang: true,
    staffNoun: "ekibimize",
    serviceExamples: "saç kesimi, fön, boya, balyaj, röfle, cilt bakımı, ağda, kaş/kirpik",
    operationalRules: [
      "KOMBİNE İSTEK: \"Kesim + boya\" gibi birden fazla işlem isterse listede birleşik hizmet varsa onu seç; yoksa ana işlemi sor, diğerini nota geç.",
      "UZMAN TERCİHİ: Belirli kuaför isterse staff_id ile bak; müsait değilse alternatif öner.",
      "RENK/GÖRSEL: Model/renk görseli hizmet ipucudur, sonuç taahhüt etme.",
    ],
    defaultFeatureFlags: {
      crm_extended_profile: true,
      staff_preference: true,
      packages: true,
      variable_duration: true,
      combo_services: true,
    },
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      staffSelection: true,
      servicePackages: true,
      sessionTracking: true,
      beforeAfterMedia: true,
    },
  },
  nail: {
    key: "nail",
    label: "Tırnak / Nail Studio",
    blueprint: "hair-beauty",
    healthcare: false,
    allowCasualSlang: true,
    staffNoun: "ekibimize",
    serviceExamples: "manikür, pedikür, jel tırnak, kalıcı oje, protez tırnak, nail art",
    operationalRules: [
      "ÇIKARIM SÜRESİ: Müşteride mevcut protez/jel/kalıcı oje varsa çıkarım ek süre ister. \"Şu an tırnağınızda kalıcı oje/protez var mı?\" diye sor ve varsa hizmet listesinde çıkarım hizmeti mevcutsa onu da hatırlat.",
      "TEKNİSYEN TERCİHİ: Müşteri belirli bir teknisyen isterse o kişiyle müsaitliğe bak (staff_id).",
      "TASARIM TALEBİ: Nail art/desen görseli gönderilirse \"Tasarımın uygulanabilirliğini teknisyenimiz randevuda değerlendirir\" de; süre veya fiyat taahhüdü verme.",
    ],
    defaultFeatureFlags: {
      crm_extended_profile: true,
      staff_preference: true,
      packages: true,
      variable_duration: true,
      combo_services: true,
    },
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      staffSelection: true,
      servicePackages: true,
    },
  },
  "laser-aesthetic": {
    key: "laser-aesthetic",
    label: "Lazer Epilasyon / Medikal Estetik",
    blueprint: "dental-esthetic",
    healthcare: true,
    allowCasualSlang: false,
    staffNoun: "uzmanımıza",
    serviceExamples:
      "lazer epilasyon (bacak, koltuk altı, yüz, tüm vücut), cilt bakımı, leke bakımı, iğneli işlemler",
    operationalRules: [
      ...HEALTHCARE_COMPLIANCE_RULES,
      "SEANS ARALIĞI: Lazer epilasyonda seanslar arasında genelde birkaç hafta beklenir; kesin gün sayısını sen belirleme. Müşteri daha önce seans aldıysa \"Son seansınız ne zamandı?\" diye sor ve çok yakın bir tarih söylerse \"Aralığı uzmanımız belirliyor, uygun günü birlikte ayarlayalım\" de.",
      "SEANS ÖNCESİ HAZIRLIK: Randevu sonrası tek kısa cümle: bölge jiletle tıraş edilmeli; ağda/tüy dökücü ve güneş/solaryum kullanılmamalı.",
      "RİSKLİ DURUM: Gebelik, emzirme, ışığa duyarlı ilaç, aktif enfeksiyon veya yeni bronzlaşma gelirse karar verme; uzman değerlendirmesi + get_tenant_info telefonu.",
    ],
    defaultFeatureFlags: {
      crm_extended_profile: true,
      staff_preference: true,
      packages: true,
      variable_duration: true,
      combo_services: true,
    },
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      staffSelection: true,
      servicePackages: true,
      sessionTracking: true,
      healthcareCompliance: true,
      beforeAfterMedia: true,
    },
  },
  dental: {
    key: "dental",
    label: "Diş Kliniği / Gülüş Estetiği",
    blueprint: "dental-esthetic",
    healthcare: true,
    allowCasualSlang: false,
    staffNoun: "hekimimize",
    serviceExamples:
      "muayene, dolgu, diş taşı temizliği, kanal tedavisi, implant, ortodonti, diş beyazlatma, gülüş tasarımı",
    operationalRules: [
      ...HEALTHCARE_COMPLIANCE_RULES,
      "ACİL DURUM: Şiddetli diş ağrısı, yüzde/diş etinde şişlik, darbe sonrası kırık veya durmayan kanama gibi ifadelerde önce kliniğin telefonunu ver (get_tenant_info) ve \"Hemen arayın, sizi öne alalım\" de; ardından en yakın müsait saati öner. Bu durumda ağrı kesici veya evde uygulanacak bir yöntem önerme.",
      "FİYAT: Tedavi fiyatları ağız içi muayene ve gerekirse röntgen sonrası netleşir. Fiyat listesi varsa get_services ile paylaş, ama \"kesin tutar muayeneden sonra belli olur\" notunu ekle. Liste yoksa kliniği aramaya yönlendir.",
      "ÇOK SEANSLI TEDAVİ: İmplant, ortodonti, kanal tedavisi, gülüş tasarımı gibi tedaviler birden çok seans sürer. İlk adım her zaman muayene/konsültasyondur; randevuyu bunun için aç ve \"Tedavi planını hekimimiz muayenede çıkarır\" de.",
      "HAZIRLIK: Randevu öncesi kullanılan ilaç, kan sulandırıcı veya kronik rahatsızlık bilgisini sen toplama; \"Kullandığınız ilaçları hekimimize muayenede iletin\" demen yeterli.",
    ],
    defaultFeatureFlags: {
      crm_extended_profile: true,
      staff_preference: true,
      packages: true,
      variable_duration: true,
      combo_services: false,
    },
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      staffSelection: true,
      servicePackages: true,
      sessionTracking: true,
      healthcareCompliance: true,
    },
  },
  veterinary: {
    key: "veterinary",
    label: "Veteriner Kliniği",
    blueprint: "generic-local",
    healthcare: true,
    allowCasualSlang: false,
    staffNoun: "veteriner hekimimize",
    serviceExamples: "muayene, aşı, tıraş/bakım, ameliyat kontrolü",
    operationalRules: [
      ...HEALTHCARE_COMPLIANCE_RULES,
      "ACİL DURUM: Zehirlenme, nefes darlığı, kanama, kaza gibi ifadelerde önce klinik telefonunu ver (get_tenant_info) ve hemen aramasını söyle; evde uygulanacak bir yöntem önerme.",
      "HAYVAN BİLGİSİ: Randevu alırken hayvanın türü ve adı işe yarar; kısaca sor ve randevu notuna geçir.",
    ],
    defaultFeatureFlags: { packages: true },
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      servicePackages: true,
      healthcareCompliance: true,
    },
  },
  "auto-service": {
    key: "auto-service",
    label: "Oto Servis",
    blueprint: "auto-service",
    healthcare: false,
    allowCasualSlang: true,
    staffNoun: "ustamıza",
    serviceExamples: "periyodik bakım, yağ değişimi, fren, kaporta, lastik",
    operationalRules: [
      "ARAÇ BİLGİSİ: Randevu alırken aracın marka/model bilgisi işe yarar; kısaca sor ve randevu notuna geçir. Plaka isteme.",
      "ARIZA TESPİTİ: Telefonda arıza teşhisi koyma ve tamir fiyatı taahhüt etme. \"Kesin tutar aracı gördükten sonra belli olur\" de.",
    ],
    defaultFeatureFlags: {},
    capabilities: { ...DEFAULT_CAPABILITIES },
  },
  "home-service": {
    key: "home-service",
    label: "Adrese Hizmet",
    blueprint: "generic-local",
    healthcare: false,
    allowCasualSlang: true,
    staffNoun: "ekibimize",
    serviceExamples: "halı yıkama, koltuk yıkama, temizlik, tadilat",
    operationalRules: [
      "ADRES: Hizmet müşterinin adresinde verilir. Randevu oluşturmadan önce açık adresi mutlaka al ve randevu notuna geçir.",
      "FİYAT: Metrekare/parça sayısı gibi değişkenlere bağlı fiyatlarda kesin tutar verme; \"Kesin tutar yerinde ölçüm sonrası belli olur\" de.",
    ],
    defaultFeatureFlags: {},
    capabilities: { ...DEFAULT_CAPABILITIES },
  },
  generic: {
    key: "generic",
    label: "Genel İşletme",
    blueprint: "generic-local",
    healthcare: false,
    allowCasualSlang: true,
    staffNoun: "ekibimize",
    serviceExamples: "hizmet listesindeki işlemler",
    operationalRules: [],
    defaultFeatureFlags: {},
    capabilities: { ...DEFAULT_CAPABILITIES },
  },
};

/** Türkçe karakterleri ASCII'ye indirger; slug ve isim birlikte aranır. */
function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

/**
 * İşletme tipinden sektör anahtarını bulur.
 *
 * Sıra önemli: en spesifik sektör önce denenir. "Gülüş estetiği" hem "estetik"
 * hem "dis" içerir; diş kliniği olarak sınıflanmalı. "Lazer epilasyon" ise
 * "estetik" geçmese bile medikal estetik kurallarına girmeli.
 */
export function detectSectorKey(
  businessTypeSlug?: string | null,
  businessTypeName?: string | null
): SectorKey {
  const text = normalizeText(`${businessTypeSlug || ""} ${businessTypeName || ""}`);
  if (!text) return "generic";

  if (hasAny(text, ["veteriner", "vet ", "petklinik", "pet klinik"])) {
    return "veterinary";
  }

  // Avoid bare "dis" substring (adisyon/disiplin). Use token / compound forms.
  // normalizeText strips diacritics: "diş" → "dis".
  if (
    hasAny(text, [
      "disci",
      "dis-klinigi",
      "dis klinigi",
      "dis klinik",
      "dis ve",
      "dental",
      "ortodonti",
      "implant",
      "gulus tasar",
      "gulus estet",
    ]) ||
    /(^|[^a-z])dis([^a-z]|$)/.test(text)
  ) {
    return "dental";
  }

  if (
    hasAny(text, [
      "lazer",
      "laser",
      "epilasyon",
      "medikal estetik",
      "medikal-estetik",
      "dermo",
      "botoks",
      "dolgu merkezi",
      // "cilt" alone matches beauty "cilt bakımı" — require stronger signal
      "cilt klinigi",
      "cilt kliniği",
      "dermatoloji",
    ])
  ) {
    return "laser-aesthetic";
  }

  if (hasAny(text, ["tirnak", "nail", "manikur", "pedikur"])) {
    return "nail";
  }

  if (
    hasAny(text, [
      "kuafor",
      "berber",
      "guzellik",
      "beauty",
      "hair",
      "salon",
      "spa",
      "bakim merkezi",
    ])
  ) {
    return "hair-beauty";
  }

  if (hasAny(text, ["oto", "tamir", "servis", "garage", "car", "lastik", "kaporta"])) {
    return "auto-service";
  }

  if (hasAny(text, ["hali", "yikama", "temizlik", "tadilat", "nakliyat"])) {
    return "home-service";
  }

  // "estetik" tek başına kaldıysa medikal estetik varsay: sağlık kuralları
  // uygulanır, bu taraf hata yaptığında risk daha düşüktür.
  if (text.includes("estetik") || text.includes("klinik") || text.includes("clinic")) {
    return "laser-aesthetic";
  }

  return "generic";
}

export function getSectorProfile(
  businessTypeSlug?: string | null,
  businessTypeName?: string | null
): SectorProfile {
  return SECTOR_PROFILES[detectSectorKey(businessTypeSlug, businessTypeName)];
}

export function getSectorProfileByKey(key: SectorKey): SectorProfile {
  return SECTOR_PROFILES[key];
}

export function listSectorProfiles(): SectorProfile[] {
  return Object.values(SECTOR_PROFILES);
}

export function isWizardAllowedBusinessTypeSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const normalized = normalizeText(slug).replace(/\s+/g, "-");
  return WIZARD_ALLOWED_BUSINESS_TYPE_SLUGS.some(
    (allowed) => normalizeText(allowed) === normalized
  );
}

export function resolveCanonicalSectorCode(
  slug?: string | null
): CanonicalSectorCode | null {
  if (!slug) return null;
  const direct = SLUG_TO_CANONICAL[slug];
  if (direct) return direct;
  const normalized = normalizeText(slug);
  for (const [key, code] of Object.entries(SLUG_TO_CANONICAL)) {
    if (normalizeText(key) === normalized) return code;
  }
  return null;
}

export function hasCapability(
  profile: SectorProfile,
  capability: keyof SectorCapabilities
): boolean {
  return Boolean(profile.capabilities?.[capability]);
}

/**
 * Sektör kurallarını sistem promptuna girecek metne çevirir.
 * Kural yoksa boş string döner (prompt şişmesin).
 */
export function buildSectorRulesPrompt(profile: SectorProfile): string {
  if (profile.operationalRules.length === 0) return "";
  return [
    `SEKTÖR KURALLARI (${profile.label}):`,
    ...profile.operationalRules.map((rule) => `- ${rule}`),
  ].join("\n");
}
