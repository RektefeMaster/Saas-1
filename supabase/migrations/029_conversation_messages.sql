-- Faz 3: Time Machine icin mesaj replay tablosu

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  trace_id TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  customer_phone_digits TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  message_text TEXT,
  message_type TEXT,
  stage TEXT,
  message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_phone_created
  ON conversation_messages(customer_phone_digits, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_tenant_created
  ON conversation_messages(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_trace
  ON conversation_messages(trace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_message_id
  ON conversation_messages(message_id);

COMMENT ON TABLE conversation_messages IS 'WhatsApp sohbet mesaj replay kayitlari (Time Machine debugger)';
COMMENT ON COLUMN conversation_messages.customer_phone_digits IS 'Sadece rakam formatinda telefon (E.164 -> digits)';
COMMENT ON COLUMN conversation_messages.direction IS 'Mesaj yonu: inbound|outbound|system';
COMMENT ON COLUMN conversation_messages.stage IS 'Islem asamasi (rate_limited, message_replied vb.)';

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access conversation_messages" ON conversation_messages;
CREATE POLICY "Service role full access conversation_messages"
  ON conversation_messages FOR ALL USING (true);
