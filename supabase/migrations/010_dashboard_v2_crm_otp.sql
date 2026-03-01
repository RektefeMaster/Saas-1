-- Dashboard V2 + CRM + Security fields

-- Services: richer pricing model
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS duration_minutes SMALLINT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS price_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS display_order SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_services_tenant_order
  ON services(tenant_id, display_order, created_at);

-- Tenants: owner security + UI preferences
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS owner_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS security_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tenants_owner_phone_e164
  ON tenants(owner_phone_e164);

-- CRM customers
CREATE TABLE IF NOT EXISTS crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes_summary TEXT,
  last_visit_at TIMESTAMPTZ,
  total_visits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_phone
  ON crm_customers(tenant_id, customer_phone);

CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_last_visit
  ON crm_customers(tenant_id, last_visit_at DESC);

-- CRM notes
CREATE TABLE IF NOT EXISTS crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  note TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_tenant_phone_created
  ON crm_notes(tenant_id, customer_phone, created_at DESC);

-- CRM reminders
CREATE TABLE IF NOT EXISTS crm_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL DEFAULT 'panel' CHECK (channel IN ('panel', 'whatsapp', 'both')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_reminders_tenant_remind_at
  ON crm_reminders(tenant_id, remind_at);

CREATE INDEX IF NOT EXISTS idx_crm_reminders_tenant_status
  ON crm_reminders(tenant_id, status);

-- RLS policies align with existing service-role-wide approach
ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access crm_customers" ON crm_customers;
CREATE POLICY "Service role full access crm_customers"
  ON crm_customers FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access crm_notes" ON crm_notes;
CREATE POLICY "Service role full access crm_notes"
  ON crm_notes FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access crm_reminders" ON crm_reminders;
CREATE POLICY "Service role full access crm_reminders"
  ON crm_reminders FOR ALL USING (true);
