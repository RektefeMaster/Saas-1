-- Backfill conversations from legacy conversation_messages (normalized digits).
-- Safe/idempotent: only creates missing (tenant_id, whatsapp, external_user_id) rows.

UPDATE conversation_messages
SET normalized_phone_digits = regexp_replace(customer_phone_digits, '\D', '', 'g')
WHERE normalized_phone_digits IS NULL
  AND customer_phone_digits IS NOT NULL
  AND customer_phone_digits <> '';

INSERT INTO conversations (
  tenant_id,
  channel,
  external_user_id,
  automation_mode,
  conversation_status,
  last_message_at,
  last_inbound_message_at,
  last_outbound_message_at,
  last_customer_message_at,
  last_message_preview,
  last_message_direction,
  unread_count,
  version,
  created_at,
  updated_at
)
SELECT
  cm.tenant_id,
  'whatsapp',
  cm.normalized_phone_digits,
  'AI_ACTIVE',
  'OPEN',
  MAX(cm.created_at),
  MAX(cm.created_at) FILTER (WHERE cm.direction = 'inbound'),
  MAX(cm.created_at) FILTER (WHERE cm.direction = 'outbound'),
  MAX(cm.created_at) FILTER (WHERE cm.direction = 'inbound'),
  (
    ARRAY_AGG(LEFT(COALESCE(cm.message_text, ''), 160) ORDER BY cm.created_at DESC)
  )[1],
  (
    ARRAY_AGG(cm.direction ORDER BY cm.created_at DESC)
  )[1],
  0,
  1,
  MIN(cm.created_at),
  now()
FROM conversation_messages cm
WHERE cm.tenant_id IS NOT NULL
  AND cm.normalized_phone_digits IS NOT NULL
  AND length(cm.normalized_phone_digits) >= 10
GROUP BY cm.tenant_id, cm.normalized_phone_digits
ON CONFLICT (tenant_id, channel, external_user_id) DO NOTHING;

-- Link messages to conversations where possible
UPDATE conversation_messages cm
SET conversation_id = c.id
FROM conversations c
WHERE cm.conversation_id IS NULL
  AND cm.tenant_id = c.tenant_id
  AND c.channel = 'whatsapp'
  AND cm.normalized_phone_digits = c.external_user_id;
