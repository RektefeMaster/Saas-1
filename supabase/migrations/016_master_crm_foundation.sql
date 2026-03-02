-- Master CRM foundation (Blueprint + Revenue + Automation + Compliance + Immutable Event Log)
-- Safe to run multiple times.

-- Tenant-level blueprint overrides (business type + tenant customizations)
CREATE TABLE IF NOT EXISTS tenant_blueprint_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  blueprint_slug TEXT,
  modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  kpi_targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  automation_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  resource_templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_blueprint_overrides_tenant
  ON tenant_blueprint_overrides(tenant_id);

-- Operational resources used by sector-specific scheduling/capacity
CREATE TABLE IF NOT EXISTS tenant_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (
    resource_type IN ('chair', 'specialist', 'room', 'doctor', 'device', 'lift', 'technician', 'other')
  ),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  capacity SMALLINT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_resources_tenant_type
  ON tenant_resources(tenant_id, resource_type);

CREATE INDEX IF NOT EXISTS idx_tenant_resources_tenant_status
  ON tenant_resources(tenant_id, status);

-- Revenue ledger (payments, package sales, adjustments)
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  customer_phone TEXT,
  source TEXT NOT NULL CHECK (source IN ('appointment', 'manual', 'package', 'adjustment')),
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_tenant_event_at
  ON revenue_events(tenant_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_events_tenant_source
  ON revenue_events(tenant_id, source, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_events_tenant_customer
  ON revenue_events(tenant_id, customer_phone, event_at DESC);

-- Derived retention risk segmentation
CREATE TABLE IF NOT EXISTS retention_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  segment_key TEXT NOT NULL CHECK (segment_key IN ('active', 'at_risk', 'churned', 'vip', 'new')),
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_phone, segment_key)
);

CREATE INDEX IF NOT EXISTS idx_retention_segments_tenant_risk
  ON retention_segments(tenant_id, risk_level, updated_at DESC);

-- Automation registry (reactivation, review booster, slot fill, no-show follow-up)
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('reactivation', 'review_booster', 'slot_fill', 'no_show_followup')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant_type_status
  ON automation_rules(tenant_id, rule_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_rules_tenant_rule_unique
  ON automation_rules(tenant_id, rule_type);

-- Compliance profile for TR-first and global-ready posture
CREATE TABLE IF NOT EXISTS compliance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL DEFAULT 'TR',
  kvkk_mode BOOLEAN NOT NULL DEFAULT TRUE,
  gdpr_ready BOOLEAN NOT NULL DEFAULT TRUE,
  healthcare_mode BOOLEAN NOT NULL DEFAULT FALSE,
  data_retention_days INTEGER NOT NULL DEFAULT 365,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_profiles_country_healthcare
  ON compliance_profiles(country_code, healthcare_mode);

-- Immutable tenant event log for critical actions (audit + analytics)
CREATE TABLE IF NOT EXISTS tenant_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_event_logs_tenant_created
  ON tenant_event_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_event_logs_tenant_event_type
  ON tenant_event_logs(tenant_id, event_type, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_tenant_event_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'tenant_event_logs is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_event_logs_immutable ON tenant_event_logs;
CREATE TRIGGER trg_tenant_event_logs_immutable
BEFORE UPDATE OR DELETE ON tenant_event_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_tenant_event_logs_mutation();

-- RLS enablement
ALTER TABLE tenant_blueprint_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_event_logs ENABLE ROW LEVEL SECURITY;

-- Service-role full access policies
DROP POLICY IF EXISTS "Service role full access tenant_blueprint_overrides" ON tenant_blueprint_overrides;
CREATE POLICY "Service role full access tenant_blueprint_overrides"
  ON tenant_blueprint_overrides FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access tenant_resources" ON tenant_resources;
CREATE POLICY "Service role full access tenant_resources"
  ON tenant_resources FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access revenue_events" ON revenue_events;
CREATE POLICY "Service role full access revenue_events"
  ON revenue_events FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access retention_segments" ON retention_segments;
CREATE POLICY "Service role full access retention_segments"
  ON retention_segments FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access automation_rules" ON automation_rules;
CREATE POLICY "Service role full access automation_rules"
  ON automation_rules FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access compliance_profiles" ON compliance_profiles;
CREATE POLICY "Service role full access compliance_profiles"
  ON compliance_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access tenant_event_logs" ON tenant_event_logs;
CREATE POLICY "Service role full access tenant_event_logs"
  ON tenant_event_logs FOR ALL USING (true);
