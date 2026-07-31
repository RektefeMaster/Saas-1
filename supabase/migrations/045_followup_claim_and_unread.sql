-- Atomic follow-up claim + conversation unread increment helpers

ALTER TABLE followup_jobs
  DROP CONSTRAINT IF EXISTS followup_jobs_status_check;

ALTER TABLE followup_jobs
  ADD CONSTRAINT followup_jobs_status_check
  CHECK (status IN ('scheduled', 'sending', 'cancelled', 'sent', 'failed', 'skipped'));

CREATE OR REPLACE FUNCTION claim_followup_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  updated_id UUID;
BEGIN
  UPDATE followup_jobs
  SET status = 'sending', updated_at = now()
  WHERE id = p_job_id AND status = 'scheduled'
  RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION increment_conversation_unread(
  p_conversation_id UUID,
  p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE conversations
  SET unread_count = COALESCE(unread_count, 0) + 1,
      updated_at = now()
  WHERE id = p_conversation_id AND tenant_id = p_tenant_id
  RETURNING unread_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
