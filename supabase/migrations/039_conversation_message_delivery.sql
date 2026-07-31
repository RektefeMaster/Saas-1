-- Sprint A2: message idempotency, delivery status ordering, sender audit

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS event_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IS NULL OR delivery_status IN (
      'queued', 'sent', 'delivered', 'read', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_status TEXT
    CHECK (processing_status IS NULL OR processing_status IN (
      'pending', 'processing', 'processed', 'skipped', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS sender_type TEXT
    CHECK (sender_type IS NULL OR sender_type IN ('AI', 'HUMAN', 'SYSTEM')),
  ADD COLUMN IF NOT EXISTS sender_membership_id UUID REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IS NULL OR source IN (
      'tenant_inbox', 'admin', 'automation', 'bot', 'webhook'
    )),
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Backfill external_message_id from legacy message_id
UPDATE conversation_messages
SET
  provider = COALESCE(provider, 'whatsapp'),
  external_message_id = COALESCE(external_message_id, NULLIF(message_id, ''))
WHERE external_message_id IS NULL
  AND message_id IS NOT NULL
  AND message_id <> '';

-- Legacy logs may share the same WhatsApp message_id across rows.
-- Keep the earliest row; null out duplicates so the unique index can be created.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, COALESCE(provider, 'whatsapp'), external_message_id
      ORDER BY created_at ASC NULLS LAST, ctid ASC
    ) AS rn
  FROM conversation_messages
  WHERE tenant_id IS NOT NULL
    AND external_message_id IS NOT NULL
    AND external_message_id <> ''
)
UPDATE conversation_messages m
SET external_message_id = NULL
FROM ranked r
WHERE m.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_messages_tenant_provider_ext
  ON conversation_messages (tenant_id, provider, external_message_id)
  WHERE tenant_id IS NOT NULL
    AND provider IS NOT NULL
    AND external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
  ON conversation_messages(conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_delivery_status
  ON conversation_messages(tenant_id, delivery_status)
  WHERE delivery_status IS NOT NULL;

COMMENT ON COLUMN conversation_messages.external_message_id IS 'Provider message id; unique per tenant+provider for idempotency';
COMMENT ON COLUMN conversation_messages.delivery_status IS 'queued<sent<delivered<read; failed is side-path';
