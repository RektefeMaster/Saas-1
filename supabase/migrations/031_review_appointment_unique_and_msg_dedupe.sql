-- Dedupe before UNIQUE indexes (unsafe to add unique while duplicates exist).

-- Keep newest review per appointment_id.
DELETE FROM reviews r
USING reviews newer
WHERE r.appointment_id IS NOT NULL
  AND newer.appointment_id = r.appointment_id
  AND newer.ctid > r.ctid;

-- Keep newest message_processing_jobs row per (provider, message_id).
DELETE FROM message_processing_jobs j
USING message_processing_jobs newer
WHERE newer.provider = j.provider
  AND newer.message_id = j.message_id
  AND newer.ctid > j.ctid;

-- One review row per appointment (rating or skipped).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_appointment_id_unique
  ON reviews(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- Idempotent ingress for WhatsApp/message processing jobs.
CREATE UNIQUE INDEX IF NOT EXISTS message_processing_jobs_provider_message_unique
  ON message_processing_jobs(provider, message_id);

-- CRM reminder claim state for concurrent cron workers.
ALTER TABLE crm_reminders DROP CONSTRAINT IF EXISTS crm_reminders_status_check;
ALTER TABLE crm_reminders
  ADD CONSTRAINT crm_reminders_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'cancelled'));

-- Reclaim stuck "sending" rows (worker crash / timeout) so cron can retry.
UPDATE crm_reminders
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'sending'
  AND updated_at < NOW() - INTERVAL '15 minutes';
