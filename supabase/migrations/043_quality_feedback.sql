-- Sprint C5: structured AI quality feedback

CREATE TABLE IF NOT EXISTS conversation_quality_feedback (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id TEXT,
  reported_by UUID,
  category TEXT NOT NULL
    CHECK (category IN (
      'wrong_price',
      'wrong_availability',
      'hallucination',
      'unsafe_health_claim',
      'wrong_policy',
      'tone_issue',
      'failed_handoff',
      'wrong_customer_context',
      'other'
    )),
  comment TEXT,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_feedback_tenant_created
  ON conversation_quality_feedback(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_feedback_category
  ON conversation_quality_feedback(tenant_id, category);

ALTER TABLE conversation_quality_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access conversation_quality_feedback" ON conversation_quality_feedback;
CREATE POLICY "Service role full access conversation_quality_feedback"
  ON conversation_quality_feedback FOR ALL USING (true);
