export const FEATURE_FLAG_KEYS = [
  "crm_extended_profile",
  "staff_preference",
  "packages",
  "variable_duration",
  "combo_services",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  crm_extended_profile: false,
  staff_preference: false,
  packages: false,
  variable_duration: false,
  combo_services: false,
};

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

export function coerceFeatureFlags(input: unknown): Partial<FeatureFlags> {
  if (!input || typeof input !== "object") return {};

  const source = input as Record<string, unknown>;
  const out: Partial<FeatureFlags> = {};

  for (const key of FEATURE_FLAG_KEYS) {
    if (typeof source[key] === "boolean") {
      out[key] = source[key] as boolean;
    }
  }

  return out;
}

export function inferFeatureFlagsByBusinessType(
  businessTypeSlug?: string | null,
  businessTypeName?: string | null
): Partial<FeatureFlags> {
  const text = normalizeText(`${businessTypeSlug || ""} ${businessTypeName || ""}`);

  if (
    text.includes("kadin-kuafor") ||
    text.includes("kadin kuafor") ||
    text.includes("guzellik") ||
    text.includes("beauty")
  ) {
    return {
      crm_extended_profile: true,
      staff_preference: true,
      packages: true,
      variable_duration: true,
      combo_services: true,
    };
  }

  if (
    text.includes("tirnak") ||
    text.includes("nail")
  ) {
    return {
      crm_extended_profile: true,
      staff_preference: true,
      packages: true,
      variable_duration: false,
      combo_services: true,
    };
  }

  if (
    text.includes("disci") ||
    text.includes("dental") ||
    text.includes("veteriner")
  ) {
    return {
      packages: true,
    };
  }

  return {};
}

export function buildFeatureFlags(
  ...candidates: Array<unknown>
): FeatureFlags {
  let out: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  for (const candidate of candidates) {
    out = { ...out, ...coerceFeatureFlags(candidate) };
  }
  return out;
}
