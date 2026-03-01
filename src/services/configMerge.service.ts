/**
 * business_type bot_config ile tenant config_override'ı merge eder.
 * Tenant ayarları önceliklidir.
 *
 * @example
 * const config = mergeConfig(
 *   businessType.bot_config,
 *   tenant.config_override
 * )
 */

import type {
  BotConfig,
  BotField,
  BotMessages,
  TenantConfigOverride,
  MergedConfig,
} from "@/types/botConfig.types";

const DEFAULTS = {
  slot_duration_minutes: 30,
  advance_booking_days: 30,
  cancellation_hours: 2,
};

/**
 * Base config ile tenant override'ı birleştirir.
 * messages ve tone deep merge; required_fields = base + extra_fields.
 */
export function mergeConfig(
  baseConfig: BotConfig,
  override?: TenantConfigOverride | null
): MergedConfig {
  if (!override || typeof override !== "object") {
    return {
      ...baseConfig,
      slot_duration_minutes: DEFAULTS.slot_duration_minutes,
      advance_booking_days: DEFAULTS.advance_booking_days,
      cancellation_hours: DEFAULTS.cancellation_hours,
    };
  }

  const messages: BotMessages = {
    ...baseConfig.messages,
    ...(override.messages || {}),
  };

  const tone = {
    ...baseConfig.tone,
    ...(override.tone || {}),
  };

  const required_fields: BotField[] = [
    ...(baseConfig.required_fields || []),
    ...(override.extra_fields || []),
  ];

  const custom_questions = [
    ...(baseConfig.custom_questions || []),
    ...(override.custom_questions || []),
  ];

  return {
    ...baseConfig,
    ...override,
    messages,
    tone,
    required_fields,
    custom_questions,
    slot_duration_minutes:
      override.slot_duration_minutes ?? DEFAULTS.slot_duration_minutes,
    advance_booking_days:
      override.advance_booking_days ?? DEFAULTS.advance_booking_days,
    cancellation_hours:
      override.cancellation_hours ?? DEFAULTS.cancellation_hours,
  };
}

/**
 * Şablondaki {key} placeholder'larını vars ile doldurur.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{${key}}`, val ?? ""),
    template
  );
}

/**
 * Bot persona metnini hazırlar ({tenant_name} doldurulur).
 */
export function buildBotPersona(
  config: MergedConfig,
  tenantName: string
): string {
  return fillTemplate(config.bot_persona, {
    tenant_name: tenantName,
  });
}

/**
 * Mesaj şablonunu key ile alıp placeholder'ları doldurur.
 * Key yoksa boş string döner.
 */
export function buildMessage(
  config: MergedConfig,
  messageKey: keyof BotMessages,
  vars: Record<string, string>
): string {
  const template = config.messages[messageKey];
  if (typeof template !== "string") return "";
  return fillTemplate(template, vars);
}

/**
 * Few-shot örnekleri sistem promptuna eklenecek metne çevirir.
 */
export function buildExamplesPrompt(config: MergedConfig): string {
  if (!config.examples?.length) return "";

  const lines = config.examples.map((ex) => {
    const header = ex.context ? `// ${ex.context}\n` : "";
    const dialogue = ex.exchanges
      .map((e) => `Müşteri: ${e.user}\nBot: ${e.bot}`)
      .join("\n");
    return `${header}${dialogue}`;
  });

  return `Örnek konuşmalar:\n\n${lines.join("\n\n")}`;
}

/**
 * Zorunlu alanların hepsinin toplandığını kontrol eder.
 */
export function checkRequiredFields(
  config: MergedConfig,
  extracted: Record<string, unknown>
): {
  complete: boolean;
  missing: BotField[];
  nextQuestion: string | null;
} {
  const required = config.required_fields || [];
  const missing = required.filter((f) => {
    const val = extracted[f.key];
    if (val === undefined || val === null) return true;
    if (typeof val === "string" && !val.trim()) return true;
    return false;
  });

  return {
    complete: missing.length === 0,
    missing,
    nextQuestion: missing[0]?.question ?? null,
  };
}
