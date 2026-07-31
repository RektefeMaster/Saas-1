-- Domain / outbox events for CRM automation (no Kafka in V1)

CREATE TABLE IF NOT EXISTS domain_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT,
  aggregate_id TEXT,
  idempotency_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_domain_events_idempotency
  ON domain_events (tenant_id, idempotency_key)
  WHERE tenant_id IS NOT NULL AND idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_domain_events_unprocessed
  ON domain_events (created_at ASC)
  WHERE processed_at IS NULL;

ALTER TABLE domain_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access domain_events" ON domain_events;
CREATE POLICY "Service role full access domain_events"
  ON domain_events FOR ALL USING (true);

-- Safe follow-up jobs
CREATE TABLE IF NOT EXISTS followup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  customer_phone_digits TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled', 'sent', 'failed', 'skipped')),
  cancel_reason TEXT,
  trigger_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  template_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_jobs_due
  ON followup_jobs (status, scheduled_for)
  WHERE status = 'scheduled';

ALTER TABLE followup_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access followup_jobs" ON followup_jobs;
CREATE POLICY "Service role full access followup_jobs"
  ON followup_jobs FOR ALL USING (true);
