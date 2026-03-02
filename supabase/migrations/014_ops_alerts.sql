-- Phase 3: Operational alerts (delay / cancellation / no-show)
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS ops_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('delay', 'cancellation', 'no_show', 'system')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  customer_phone TEXT,
  message TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_tenant_status_created
  ON ops_alerts(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_tenant_type_created
  ON ops_alerts(tenant_id, type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_alerts_tenant_dedupe_key_unique
  ON ops_alerts(tenant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access ops_alerts" ON ops_alerts;
CREATE POLICY "Service role full access ops_alerts"
  ON ops_alerts FOR ALL USING (true);
