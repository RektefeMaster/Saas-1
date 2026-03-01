/**
 * Config-driven bot davranış sistemi tip tanımları.
 * Her işletme tipi (business_type) bir BotConfig ile tanımlanır;
 * tenant config_override ile kısmen ezebilir.
 */

export type BotFieldType =
  | "date"
  | "time"
  | "select"
  | "text"
  | "number"
  | "phone"
  | "address"
  | "multiselect";

/** Tek bir toplanacak alan (tarih, saat, hizmet, adres vb.) */
export interface BotField {
  key: string;
  label: string;
  type: BotFieldType;
  question: string;
  options?: string[];
  validation?: string;
  extract_hint?: string;
  skip_phrases?: string[];
  show_when?: string;
  error_message?: string;
  example?: string;
}

/** Tüm mesaj şablonları */
export interface BotMessages {
  confirmation: string;
  reminder_24h: string;
  reminder_1h: string;
  cancellation_by_customer: string;
  cancellation_by_tenant: string;
  no_show: string;
  review_request: string;
  human_escalation: string;
  no_availability: string;
  date_blocked: string;
  welcome_back: string;
  waitlist_added: string;
  waitlist_available: string;
  rescheduled: string;
  daily_summary: string;
  system_error: string;
}

export type BotToneStyle =
  | "samimi"
  | "profesyonel"
  | "enerjik"
  | "sicak"
  | "ciddi";

export type ResponseLength = "kisa" | "orta" | "uzun";

/** Ton ve stil ayarları */
export interface BotTone {
  style: BotToneStyle;
  emoji_set: string[];
  use_formal: boolean;
  response_length: ResponseLength;
  use_customer_name: boolean;
}

/** Few-shot konuşma örneği */
export interface ConversationExample {
  context: string;
  exchanges: Array<{ user: string; bot: string }>;
}

/** Koşullu özel soru */
export interface CustomQuestion {
  key: string;
  question: string;
  type: BotFieldType;
  required: boolean;
  options?: string[];
  show_when?: string;
  show_at_step?: string;
  validation?: string;
  error_message?: string;
}

/** İşletme tipinin bot davranış config'i (DB'de business_types.bot_config) */
export interface BotConfig {
  bot_persona: string;
  opening_message: string;
  returning_customer_message: string;
  required_fields: BotField[];
  optional_fields: BotField[];
  messages: BotMessages;
  tone: BotTone;
  examples: ConversationExample[];
  custom_questions: CustomQuestion[];
  summary_template: string;
  has_services: boolean;
  has_slot_count: boolean;
  has_address: boolean;
  has_pickup_delivery: boolean;
  has_item_info: boolean;
}

/** Tenant'ın config_override tipi; business_type config'ini kısmen ezer */
export interface TenantConfigOverride {
  bot_persona?: string;
  opening_message?: string;
  returning_customer_message?: string;
  messages?: Partial<BotMessages>;
  tone?: Partial<BotTone>;
  custom_questions?: CustomQuestion[];
  extra_fields?: BotField[];
  slot_duration_minutes?: number;
  advance_booking_days?: number;
  cancellation_hours?: number;
  [key: string]: unknown;
}

/** Merge edilmiş final config; sayısal default'lar kesinleşir */
export interface MergedConfig extends BotConfig {
  slot_duration_minutes: number;
  advance_booking_days: number;
  cancellation_hours: number;
}
