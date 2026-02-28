export type FlowType =
  | "appointment"
  | "appointment_with_extras"
  | "order"
  | "reservation"
  | "hybrid";

export interface BusinessTypeConfig {
  flow_type: FlowType;
  ai_prompt_template: string;
  business_label?: string;
  extra_fields: ExtraField[];
  messages: {
    confirmation: string;
    reminder: string;
    [key: string]: string;
  };
}

export interface ExtraField {
  key: string;
  label: string;
  type: "text" | "number";
  required: boolean;
  validation?: string;
}

export interface BusinessType {
  id: string;
  name: string;
  slug: string;
  flow_type: FlowType;
  config: BusinessTypeConfig;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  business_type_id: string;
  name: string;
  tenant_code: string;
  config_override: Record<string, unknown>;
  status: "active" | "inactive" | "suspended";
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  customer_phone: string;
  slot_start: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  service_slug: string | null;
  extra_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface AvailabilitySlot {
  id: string;
  tenant_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface ConversationState {
  intent?: "randevu_al" | "sipariş_ver" | "rezervasyon" | "bilgi_sor";
  flow_type: FlowType;
  extracted: Record<string, unknown>;
  step: string;
  tenant_id: string;
  customer_phone: string;
  updated_at: string;
}
