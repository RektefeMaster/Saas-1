-- Kanal hesap defteri ("anahtarlık").
--
-- Bugun WhatsApp tek ortak numaradan calisiyor ve kimlik bilgileri global
-- env/Redis'ten okunuyor. Bu tablo, isletme basina kanal hesabi saklamak icin
-- yeri acar. Satir yoksa davranis degismez: ortak numara kullanilir.
--
-- Instagram icin de ayni tablo kullanilir; orada her isletmenin kendi hesabi
-- zorunlu oldugu icin satir her zaman bulunur.

CREATE TABLE IF NOT EXISTS tenant_channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),

  -- WhatsApp: phone_number_id · Instagram: IG business account id
  external_account_id TEXT NOT NULL,
  -- WhatsApp: display_phone_number · Instagram: @kullaniciadi
  account_handle TEXT,

  auth_method TEXT
    CHECK (auth_method IS NULL OR auth_method IN ('instagram_login', 'facebook_login', 'manual')),

  -- AES-256-GCM ile sifreli. Duz metin ASLA saklanmaz (bkz. src/lib/channel-tokens.ts)
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disconnected', 'token_expired', 'revoked', 'needs_control')),

  connected_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Gelen webhook'tan tenant'a deterministik cozum (tahmin yok).
  UNIQUE (channel, external_account_id),
  -- V1: isletme basina kanal basina tek hesap.
  UNIQUE (tenant_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_tenant_channel_accounts_tenant
  ON tenant_channel_accounts(tenant_id, channel)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_tenant_channel_accounts_expiry
  ON tenant_channel_accounts(token_expires_at)
  WHERE token_expires_at IS NOT NULL AND status = 'active';

ALTER TABLE tenant_channel_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access tenant_channel_accounts"
  ON tenant_channel_accounts;
CREATE POLICY "Service role full access tenant_channel_accounts"
  ON tenant_channel_accounts FOR ALL USING (true);

-- Yeni yonlendirme sebebi: mesajin ULASTIGI hesaptan cozulen tenant.
-- Isletme kendi numarasini bagladiginda icerikten tahmin hic calismaz.
ALTER TABLE tenant_switch_logs
  DROP CONSTRAINT IF EXISTS tenant_switch_logs_switch_reason_check;
ALTER TABLE tenant_switch_logs
  ADD CONSTRAINT tenant_switch_logs_switch_reason_check
  CHECK (switch_reason IN (
    'marker', 'name', 'session', 'customer_history', 'nlp', 'default', 'channel_account'
  ));

COMMENT ON TABLE tenant_channel_accounts IS
  'Isletme basina kanal hesabi. Satir yoksa WhatsApp ortak numaraya duser.';
COMMENT ON COLUMN tenant_channel_accounts.external_account_id IS
  'WhatsApp phone_number_id veya Instagram business account id. Gelen webhook bununla tenant''a cozulur.';
COMMENT ON COLUMN tenant_channel_accounts.access_token_encrypted IS
  'AES-256-GCM sifreli erisim tokeni. Loglara/Sentry''ye asla yazilmaz.';
COMMENT ON COLUMN tenant_channel_accounts.status IS
  'needs_control: Instagram Handover Protocol''de kontrol baska uygulamada.';
