-- Sprint B1–B2: CRM pipeline stages + explainable lead scoring

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT NOT NULL DEFAULT 'new_lead',
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_score_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_membership_id UUID REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS silence_decay_applied_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_customers_pipeline_stage_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_pipeline_stage_check
      CHECK (pipeline_stage IN (
        'new_lead', 'contacted', 'need_identified', 'qualified',
        'appointment_booked', 'offer_sent', 'follow_up', 'won', 'lost'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_pipeline
  ON crm_customers(tenant_id, pipeline_stage, lead_score DESC);

CREATE TABLE IF NOT EXISTS crm_pipeline_transitions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  reason TEXT,
  source_event TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_pipeline_transitions_customer
  ON crm_pipeline_transitions(customer_id, created_at DESC);

ALTER TABLE crm_pipeline_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access crm_pipeline_transitions" ON crm_pipeline_transitions;
CREATE POLICY "Service role full access crm_pipeline_transitions"
  ON crm_pipeline_transitions FOR ALL USING (true);

COMMENT ON COLUMN crm_customers.pipeline_stage IS 'Sales funnel stage; transitions only via transitionPipelineStage';
COMMENT ON COLUMN crm_customers.lead_score_breakdown IS 'Explainable score components';
