export type BlueprintSlug =
  | "hair-beauty"
  | "dental-esthetic"
  | "auto-service"
  | "generic-local";

export interface BlueprintDefinition {
  slug: BlueprintSlug;
  label: string;
  mainObject: string;
  criticalFields: string[];
  resources: string[];
  modules: {
    command_center: boolean;
    smart_calendar: boolean;
    crm360: boolean;
    revenue_os: boolean;
    retention_automation: boolean;
    ops_intelligence: boolean;
  };
  kpis: string[];
  automationDefaults: {
    reactivation_days: number;
    review_request_delay_hours: number;
    no_show_followup_hours: number;
    slot_fill_trigger_minutes: number;
  };
  financeDefaults: {
    currency: "TRY" | "USD" | "EUR";
    tax_mode: "gross" | "net";
    fallback_price_label: string;
  };
}

export interface ResourceUnit {
  id: string;
  tenant_id: string;
  resource_type:
    | "chair"
    | "specialist"
    | "room"
    | "doctor"
    | "device"
    | "lift"
    | "technician"
    | "other";
  name: string;
  status: "active" | "inactive" | "maintenance";
  capacity: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RevenueEvent {
  id: string;
  tenant_id: string;
  appointment_id: string | null;
  customer_phone: string | null;
  source: "appointment" | "manual" | "package" | "adjustment";
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  currency: string;
  event_at: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface RetentionSegment {
  id: string;
  tenant_id: string;
  customer_phone: string;
  segment_key: "active" | "at_risk" | "churned" | "vip" | "new";
  score: number;
  risk_level: "low" | "medium" | "high";
  metadata: Record<string, unknown>;
  updated_at: string;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  tenant_id: string;
  rule_type: "reactivation" | "review_booster" | "slot_fill" | "no_show_followup";
  status: "active" | "paused" | "archived";
  config: Record<string, unknown>;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceProfile {
  id: string;
  tenant_id: string;
  country_code: string;
  kvkk_mode: boolean;
  gdpr_ready: boolean;
  healthcare_mode: boolean;
  data_retention_days: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CommandCenterAction {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  cta_label: string;
  cta_endpoint: string;
  estimated_impact_try: number;
}

export interface CommandCenterKpis {
  monthly_revenue_try: number;
  monthly_appointments: number;
  no_show_rate_pct: number;
  cancellation_rate_pct: number;
  fill_rate_pct: number;
  avg_ticket_try: number;
  at_risk_customers: number;
  open_ops_alerts: number;
  avg_rating: number;
  north_star_ai_revenue_try: number;
}

export interface CommandCenterSnapshot {
  tenant_id: string;
  generated_at: string;
  blueprint_slug: BlueprintSlug;
  kpis: CommandCenterKpis;
  actions: CommandCenterAction[];
}
