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

export function buildFeatureFlags(
  ...candidates: Array<unknown>
): FeatureFlags {
  let out: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  for (const candidate of candidates) {
    out = { ...out, ...coerceFeatureFlags(candidate) };
  }
  return out;
}
