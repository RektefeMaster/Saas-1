export interface ServiceV2 {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  duration_minutes: number;
  is_active: boolean;
  price_visible: boolean;
  display_order: number;
  created_at: string;
}

export interface CrmCustomer {
  id: string;
  tenant_id: string;
  customer_phone: string;
  customer_name: string | null;
  tags: string[];
  notes_summary: string | null;
  last_visit_at: string | null;
  total_visits: number;
  created_at: string;
  updated_at: string;
}

export interface CrmNote {
  id: string;
  tenant_id: string;
  customer_phone: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

export type ReminderChannel = "panel" | "whatsapp" | "both";
export type ReminderStatus = "pending" | "sent" | "cancelled";

export interface CrmReminder {
  id: string;
  tenant_id: string;
  customer_phone: string;
  title: string;
  note: string | null;
  remind_at: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantUiPreferences {
  themePreset?: "classic" | "modern" | "midnight";
  primaryColor?: string;
  accentColor?: string;
  moduleVisibility?: Record<string, boolean>;
  moduleOrder?: string[];
  logoUrl?: string;
}

export interface TenantPricingPreferences {
  fallbackMode?: "show_call" | "hide";
  fallbackLabel?: string;
  fallbackPhone?: string;
  currency?: "TRY" | "USD" | "EUR";
}

export interface AdminTenantWizardPayload {
  name: string;
  tenant_code: string;
  business_type_id: string;
  status?: "active" | "inactive" | "suspended";
  owner_username: string;
  password: string;
  email?: string;
  owner_phone_e164?: string;
  security_config?: {
    sms_2fa_enabled?: boolean;
  };
  scheduling?: {
    slot_duration_minutes?: number;
    advance_booking_days?: number;
    cancellation_hours?: number;
    weekly_slots?: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
    blocked_dates?: Array<{
      start_date: string;
      end_date: string;
      reason?: string;
    }>;
  };
  pricing_preferences?: TenantPricingPreferences;
  services?: Array<{
    name: string;
    slug?: string;
    description?: string;
    price?: number | null;
    duration_minutes?: number;
    is_active?: boolean;
    price_visible?: boolean;
    display_order?: number;
  }>;
  crm?: {
    default_tags?: string[];
    reminder_channel?: ReminderChannel;
  };
  ui_preferences?: TenantUiPreferences;
  config_override?: Record<string, unknown>;
}
