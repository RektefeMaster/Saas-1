/**
 * CRM genişletilmiş müşteri profili alan tanımları.
 *
 * Neden var: bu alan panelde ham JSON textarea'sıydı. Kuaförden ya da klinik
 * resepsiyonundan `{"cilt_tipi": "..."}` yazmasını beklemek gerçekçi değil;
 * pratikte alan hiç doldurulmuyordu. Sektöre göre hazır alan seti gösterilir,
 * bilinmeyen anahtarlar korunur (gelişmiş JSON modu hâlâ mevcut).
 */

import type { SectorKey } from "@/services/sectorProfile.service";

export type ProfileFieldType = "text" | "textarea" | "select" | "date" | "number";

export interface ProfileField {
  key: string;
  label: { tr: string; en: string };
  type: ProfileFieldType;
  options?: string[];
  placeholder?: { tr: string; en: string };
}

const ALLERGY_FIELD: ProfileField = {
  key: "allergies",
  label: { tr: "Alerji / hassasiyet", en: "Allergies / sensitivities" },
  type: "text",
  placeholder: { tr: "Örn: amonyak hassasiyeti", en: "e.g. ammonia sensitivity" },
};

const PREFERRED_TIME_FIELD: ProfileField = {
  key: "preferred_time",
  label: { tr: "Tercih ettiği zaman", en: "Preferred time" },
  type: "text",
  placeholder: { tr: "Örn: hafta içi akşam", en: "e.g. weekday evenings" },
};

const HAIR_BEAUTY_FIELDS: ProfileField[] = [
  {
    key: "hair_type",
    label: { tr: "Saç tipi", en: "Hair type" },
    type: "select",
    options: ["İnce", "Normal", "Kalın", "Kıvırcık", "Boyalı", "Yıpranmış"],
  },
  {
    key: "color_formula",
    label: { tr: "Renk formülü / oksidan", en: "Color formula" },
    type: "text",
    placeholder: { tr: "Örn: 7.1 + 20 vol", en: "e.g. 7.1 + 20 vol" },
  },
  ALLERGY_FIELD,
  {
    key: "scalp_notes",
    label: { tr: "Saç derisi notu", en: "Scalp notes" },
    type: "text",
  },
  {
    key: "preferred_staff",
    label: { tr: "Tercih ettiği uzman", en: "Preferred specialist" },
    type: "text",
  },
  PREFERRED_TIME_FIELD,
  {
    key: "last_service_notes",
    label: { tr: "Son işlem notu", en: "Last service notes" },
    type: "textarea",
  },
];

const NAIL_FIELDS: ProfileField[] = [
  {
    key: "nail_condition",
    label: { tr: "Tırnak durumu", en: "Nail condition" },
    type: "select",
    options: ["Doğal", "Jel", "Protez", "Kalıcı oje", "Kırılgan"],
  },
  {
    key: "nail_sensitivity",
    label: { tr: "Hassasiyet / mantar öyküsü", en: "Sensitivity" },
    type: "text",
  },
  ALLERGY_FIELD,
  {
    key: "preferred_design",
    label: { tr: "Tercih ettiği tasarım / renk", en: "Preferred design" },
    type: "text",
  },
  {
    key: "preferred_staff",
    label: { tr: "Tercih ettiği teknisyen", en: "Preferred technician" },
    type: "text",
  },
  PREFERRED_TIME_FIELD,
  {
    key: "last_service_notes",
    label: { tr: "Son işlem notu", en: "Last service notes" },
    type: "textarea",
  },
];

const LASER_FIELDS: ProfileField[] = [
  {
    key: "skin_type",
    label: { tr: "Cilt tipi (Fitzpatrick)", en: "Skin type (Fitzpatrick)" },
    type: "select",
    options: ["I", "II", "III", "IV", "V", "VI"],
  },
  {
    key: "hair_color",
    label: { tr: "Kıl rengi / kalınlığı", en: "Hair color / thickness" },
    type: "text",
  },
  {
    key: "treated_areas",
    label: { tr: "Uygulanan bölgeler", en: "Treated areas" },
    type: "text",
    placeholder: { tr: "Örn: bacak, koltuk altı", en: "e.g. legs, underarms" },
  },
  {
    key: "session_number",
    label: { tr: "Tamamlanan seans", en: "Completed sessions" },
    type: "number",
  },
  {
    key: "last_session_date",
    label: { tr: "Son seans tarihi", en: "Last session date" },
    type: "date",
  },
  {
    key: "device",
    label: { tr: "Cihaz / enerji ayarı", en: "Device / energy setting" },
    type: "text",
  },
  ALLERGY_FIELD,
  {
    key: "contraindications",
    label: { tr: "Uzman notu (dikkat edilecekler)", en: "Specialist cautions" },
    type: "textarea",
    placeholder: {
      tr: "Uzmanın uygulamada dikkat etmesi gerekenler",
      en: "Points the specialist should watch for",
    },
  },
  PREFERRED_TIME_FIELD,
];

const DENTAL_FIELDS: ProfileField[] = [
  {
    key: "treatment_plan",
    label: { tr: "Tedavi planı", en: "Treatment plan" },
    type: "textarea",
  },
  {
    key: "ongoing_treatment",
    label: { tr: "Devam eden tedavi", en: "Ongoing treatment" },
    type: "text",
    placeholder: { tr: "Örn: ortodonti 4. ay", en: "e.g. orthodontics month 4" },
  },
  {
    key: "next_control_date",
    label: { tr: "Sonraki kontrol", en: "Next control" },
    type: "date",
  },
  ALLERGY_FIELD,
  {
    key: "medical_notes",
    label: { tr: "Hekim notu", en: "Clinician notes" },
    type: "textarea",
  },
  {
    key: "preferred_doctor",
    label: { tr: "Tercih ettiği hekim", en: "Preferred clinician" },
    type: "text",
  },
  PREFERRED_TIME_FIELD,
];

const GENERIC_FIELDS: ProfileField[] = [
  ALLERGY_FIELD,
  {
    key: "preferred_staff",
    label: { tr: "Tercih ettiği personel", en: "Preferred staff" },
    type: "text",
  },
  PREFERRED_TIME_FIELD,
  {
    key: "last_service_notes",
    label: { tr: "Son işlem notu", en: "Last service notes" },
    type: "textarea",
  },
];

const FIELDS_BY_SECTOR: Record<SectorKey, ProfileField[]> = {
  "hair-beauty": HAIR_BEAUTY_FIELDS,
  nail: NAIL_FIELDS,
  "laser-aesthetic": LASER_FIELDS,
  dental: DENTAL_FIELDS,
  veterinary: [
    {
      key: "pet_name",
      label: { tr: "Hayvanın adı", en: "Pet name" },
      type: "text",
    },
    {
      key: "pet_species",
      label: { tr: "Tür / ırk", en: "Species / breed" },
      type: "text",
    },
    ALLERGY_FIELD,
    {
      key: "medical_notes",
      label: { tr: "Veteriner notu", en: "Vet notes" },
      type: "textarea",
    },
    PREFERRED_TIME_FIELD,
  ],
  "auto-service": [
    { key: "vehicle", label: { tr: "Araç", en: "Vehicle" }, type: "text" },
    {
      key: "last_service_notes",
      label: { tr: "Son işlem notu", en: "Last service notes" },
      type: "textarea",
    },
    PREFERRED_TIME_FIELD,
  ],
  "home-service": [
    { key: "address", label: { tr: "Adres", en: "Address" }, type: "textarea" },
    {
      key: "last_service_notes",
      label: { tr: "Son işlem notu", en: "Last service notes" },
      type: "textarea",
    },
    PREFERRED_TIME_FIELD,
  ],
  generic: GENERIC_FIELDS,
};

export function getProfileFields(sectorKey?: string | null): ProfileField[] {
  if (!sectorKey) return GENERIC_FIELDS;
  return FIELDS_BY_SECTOR[sectorKey as SectorKey] ?? GENERIC_FIELDS;
}

/**
 * Formdaki değerleri mevcut metadata ile birleştirir.
 * Form dışındaki anahtarlar (başka bir sektörden ya da elle girilmiş) korunur;
 * boşaltılan alanlar metadata'dan silinir, boş string birikmez.
 */
export function mergeProfileMetadata(
  existing: Record<string, unknown>,
  fields: ProfileField[],
  values: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing };
  for (const field of fields) {
    const raw = (values[field.key] ?? "").trim();
    if (!raw) {
      delete out[field.key];
      continue;
    }
    if (field.type === "number") {
      const num = Number(raw);
      out[field.key] = Number.isFinite(num) ? num : raw;
      continue;
    }
    out[field.key] = raw;
  }
  return out;
}

/** Metadata'dan form değerlerini çıkarır (her zaman string). */
export function extractProfileValues(
  metadata: Record<string, unknown>,
  fields: ProfileField[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = metadata[field.key];
    out[field.key] =
      value == null || typeof value === "object" ? "" : String(value);
  }
  return out;
}

/** Form dışında kalan (bilinmeyen) anahtarlar — kullanıcıya "korunuyor" demek için. */
export function getUnmanagedKeys(
  metadata: Record<string, unknown>,
  fields: ProfileField[]
): string[] {
  const managed = new Set(fields.map((f) => f.key));
  return Object.keys(metadata).filter((key) => !managed.has(key));
}
