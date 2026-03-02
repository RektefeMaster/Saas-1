-- İşletme sahibi telefon doğrulama zamanı
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN tenants.phone_verified_at IS 'Sahip OTP doğrulamasını ilk başarıyla tamamladığında set edilir';

-- Kampanya mesajı log (admin panelden gönderilen kampanyalar)
CREATE TABLE IF NOT EXISTS campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sent_by_admin_id TEXT,
  message_text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'both')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  filter_tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_tenant ON campaign_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_created ON campaign_messages(created_at DESC);
