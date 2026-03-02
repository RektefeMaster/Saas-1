import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import type {
  BlueprintDefinition,
  BlueprintSlug,
  ComplianceProfile,
} from "@/types/master-crm.types";

const BASE_MODULES: BlueprintDefinition["modules"] = {
  command_center: true,
  smart_calendar: true,
  crm360: true,
  revenue_os: true,
  retention_automation: true,
  ops_intelligence: true,
};

const BLUEPRINTS: Record<BlueprintSlug, BlueprintDefinition> = {
  "hair-beauty": {
    slug: "hair-beauty",
    label: "Hair & Beauty",
    mainObject: "customer_visit",
    criticalFields: ["service", "duration", "staff", "product_usage"],
    resources: ["chair", "specialist", "device"],
    modules: BASE_MODULES,
    kpis: [
      "monthly_revenue_try",
      "fill_rate_pct",
      "no_show_rate_pct",
      "reactivation_conversion_pct",
      "avg_ticket_try",
    ],
    automationDefaults: {
      reactivation_days: 35,
      review_request_delay_hours: 1,
      no_show_followup_hours: 6,
      slot_fill_trigger_minutes: 30,
    },
    financeDefaults: {
      currency: "TRY",
      tax_mode: "gross",
      fallback_price_label: "Fiyat icin arayin",
    },
  },
  "dental-esthetic": {
    slug: "dental-esthetic",
    label: "Dental & Esthetic",
    mainObject: "patient_episode",
    criticalFields: ["procedure", "treatment_plan", "followup_date", "risk_notes"],
    resources: ["room", "doctor", "device"],
    modules: BASE_MODULES,
    kpis: [
      "monthly_revenue_try",
      "followup_completion_pct",
      "no_show_rate_pct",
      "patient_return_60d_pct",
      "avg_ticket_try",
    ],
    automationDefaults: {
      reactivation_days: 60,
      review_request_delay_hours: 2,
      no_show_followup_hours: 4,
      slot_fill_trigger_minutes: 45,
    },
    financeDefaults: {
      currency: "TRY",
      tax_mode: "gross",
      fallback_price_label: "Muayene ucreti icin arayin",
    },
  },
  "auto-service": {
    slug: "auto-service",
    label: "Auto Service",
    mainObject: "vehicle_job_card",
    criticalFields: ["plate", "odometer", "job_order", "parts"],
    resources: ["lift", "technician"],
    modules: BASE_MODULES,
    kpis: [
      "monthly_revenue_try",
      "job_completion_pct",
      "repeat_maintenance_pct",
      "avg_ticket_try",
      "cancellation_rate_pct",
    ],
    automationDefaults: {
      reactivation_days: 90,
      review_request_delay_hours: 6,
      no_show_followup_hours: 12,
      slot_fill_trigger_minutes: 60,
    },
    financeDefaults: {
      currency: "TRY",
      tax_mode: "gross",
      fallback_price_label: "Is emri fiyati icin arayin",
    },
  },
  "generic-local": {
    slug: "generic-local",
    label: "Generic Local Business",
    mainObject: "customer_interaction",
    criticalFields: ["service", "date", "time"],
    resources: ["other"],
    modules: BASE_MODULES,
    kpis: [
      "monthly_revenue_try",
      "monthly_appointments",
      "no_show_rate_pct",
      "cancellation_rate_pct",
      "avg_ticket_try",
    ],
    automationDefaults: {
      reactivation_days: 45,
      review_request_delay_hours: 2,
      no_show_followup_hours: 8,
      slot_fill_trigger_minutes: 30,
    },
    financeDefaults: {
      currency: "TRY",
      tax_mode: "gross",
      fallback_price_label: "Fiyat icin arayin",
    },
  },
};

function deepMerge<T>(base: T, patch?: Record<string, unknown> | null): T {
  if (!patch || typeof patch !== "object") return base;
  const out = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(prev as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u0131/g, "i")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .trim();
}

export function detectBlueprintSlug(
  businessTypeSlug?: string | null,
  businessTypeName?: string | null
): BlueprintSlug {
  const text = normalizeText(`${businessTypeSlug || ""} ${businessTypeName || ""}`);

  if (
    text.includes("berber") ||
    text.includes("kuafor") ||
    text.includes("guzellik") ||
    text.includes("salon") ||
    text.includes("hair")
  ) {
    return "hair-beauty";
  }

  if (
    text.includes("dis") ||
    text.includes("dental") ||
    text.includes("estetik") ||
    text.includes("clinic") ||
    text.includes("klinik")
  ) {
    return "dental-esthetic";
  }

  if (
    text.includes("oto") ||
    text.includes("tamir") ||
    text.includes("servis") ||
    text.includes("garage") ||
    text.includes("car")
  ) {
    return "auto-service";
  }

  return "generic-local";
}

function defaultCompliance(
  tenantId: string,
  healthcareMode: boolean
): ComplianceProfile {
  const now = new Date().toISOString();
  return {
    id: "",
    tenant_id: tenantId,
    country_code: "TR",
    kvkk_mode: true,
    gdpr_ready: true,
    healthcare_mode: healthcareMode,
    data_retention_days: healthcareMode ? 3650 : 365,
    config: {},
    created_at: now,
    updated_at: now,
  };
}

export async function getTenantBlueprint(tenantId: string) {
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, business_type_id, config_override")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .single();

  if (tenantError || !tenant) {
    throw new Error(tenantError?.message || "Tenant bulunamadi");
  }

  const { data: bt } = await supabase
    .from("business_types")
    .select("id, name, slug")
    .eq("id", tenant.business_type_id)
    .maybeSingle();

  const blueprintSlug = detectBlueprintSlug(bt?.slug, bt?.name);
  const baseBlueprint = BLUEPRINTS[blueprintSlug];

  let overrideRow: Record<string, unknown> | null = null;
  const overrideRes = await supabase
    .from("tenant_blueprint_overrides")
    .select("modules, kpi_targets, automation_defaults, resource_templates")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!overrideRes.error) {
    overrideRow = (overrideRes.data as Record<string, unknown> | null) || null;
  } else {
    const missing = extractMissingSchemaTable(overrideRes.error);
    if (missing !== "tenant_blueprint_overrides") {
      throw new Error(overrideRes.error.message);
    }
  }

  let compliance = defaultCompliance(
    tenantId,
    blueprintSlug === "dental-esthetic"
  );

  const complianceRes = await supabase
    .from("compliance_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!complianceRes.error && complianceRes.data) {
    compliance = complianceRes.data as ComplianceProfile;
  } else if (complianceRes.error) {
    const missing = extractMissingSchemaTable(complianceRes.error);
    if (missing !== "compliance_profiles") {
      throw new Error(complianceRes.error.message);
    }
  }

  const effectiveBlueprint = deepMerge(baseBlueprint, {
    modules: overrideRow?.modules as Record<string, unknown> | undefined,
    automationDefaults: overrideRow?.automation_defaults as Record<string, unknown> | undefined,
  });

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      business_type_slug: bt?.slug || null,
      business_type_name: bt?.name || null,
    },
    blueprint: effectiveBlueprint,
    kpi_targets:
      (overrideRow?.kpi_targets as Record<string, unknown> | undefined) || {},
    resource_templates:
      (overrideRow?.resource_templates as Record<string, unknown> | undefined) || {},
    compliance,
  };
}

export async function upsertTenantBlueprintOverride(
  tenantId: string,
  payload: {
    modules?: Record<string, unknown>;
    kpi_targets?: Record<string, unknown>;
    automation_defaults?: Record<string, unknown>;
    resource_templates?: Record<string, unknown>;
  }
) {
  const upsertPayload = {
    tenant_id: tenantId,
    modules: payload.modules || {},
    kpi_targets: payload.kpi_targets || {},
    automation_defaults: payload.automation_defaults || {},
    resource_templates: payload.resource_templates || {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("tenant_blueprint_overrides")
    .upsert(upsertPayload, { onConflict: "tenant_id" })
    .select("tenant_id, modules, kpi_targets, automation_defaults, resource_templates")
    .single();

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "tenant_blueprint_overrides") {
      throw new Error("Blueprint modulu hazir degil. Migration 016 uygulanmali.");
    }
    throw new Error(error.message);
  }

  return data;
}

export function listBlueprintCatalog(): BlueprintDefinition[] {
  return Object.values(BLUEPRINTS);
}
