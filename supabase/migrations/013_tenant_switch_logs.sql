-- Phase 1 routing audit log
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS tenant_switch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone TEXT NOT NULL,
  previous_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  next_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  switch_reason TEXT NOT NULL CHECK (switch_reason IN ('marker', 'session', 'nlp', 'default')),
  intent_domain TEXT CHECK (intent_domain IN ('haircare', 'carcare')),
  tenant_code TEXT,
  message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_switch_logs_phone_created
  ON tenant_switch_logs(customer_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_switch_logs_next_tenant_created
  ON tenant_switch_logs(next_tenant_id, created_at DESC);

ALTER TABLE tenant_switch_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access tenant_switch_logs" ON tenant_switch_logs;
CREATE POLICY "Service role full access tenant_switch_logs"
  ON tenant_switch_logs FOR ALL USING (true);
