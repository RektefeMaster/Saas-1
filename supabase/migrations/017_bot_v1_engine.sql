-- Bot v1 engine foundations: audit, DLQ, async job visibility, tenant timezone

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS timezone TEXT;

CREATE TABLE IF NOT EXISTS bot_message_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  customer_phone_hash TEXT,
  direction TEXT NOT NULL DEFAULT 'system' CHECK (direction IN ('inbound', 'outbound', 'system')),
  stage TEXT NOT NULL,
  message_id TEXT,
  policy_reason TEXT,
  fsm_state_before TEXT,
  fsm_state_after TEXT,
  tool_name TEXT,
  tool_result JSONB,
  reply_preview TEXT,
  latency_ms INTEGER,
  llm_latency_ms INTEGER,
  db_latency_ms INTEGER,
  lock_wait_ms INTEGER,
  queue_lag_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd NUMERIC(12, 6),
  model TEXT,
  model_pricing_version TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_message_audit_tenant_created
  ON bot_message_audit(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_message_audit_trace
  ON bot_message_audit(trace_id);
CREATE INDEX IF NOT EXISTS idx_bot_message_audit_message
  ON bot_message_audit(message_id);

CREATE TABLE IF NOT EXISTS bot_dlq_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  customer_phone_hash TEXT,
  message_id TEXT,
  payload JSONB,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_dlq_events_tenant_created
  ON bot_dlq_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_dlq_events_trace
  ON bot_dlq_events(trace_id);

CREATE TABLE IF NOT EXISTS message_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  message_id TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  customer_phone_hash TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dlq')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_processing_jobs_tenant_status
  ON message_processing_jobs(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_processing_jobs_message
  ON message_processing_jobs(message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_processing_jobs_trace
  ON message_processing_jobs(trace_id);

ALTER TABLE bot_message_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_dlq_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_processing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access bot_message_audit" ON bot_message_audit;
CREATE POLICY "Service role full access bot_message_audit"
  ON bot_message_audit FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access bot_dlq_events" ON bot_dlq_events;
CREATE POLICY "Service role full access bot_dlq_events"
  ON bot_dlq_events FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access message_processing_jobs" ON message_processing_jobs;
CREATE POLICY "Service role full access message_processing_jobs"
  ON message_processing_jobs FOR ALL USING (true);
