-- Admin panelinden hangi işletmelerin kampanya gönderebileceğini kontrol eder.
-- false = kısıtlı, işletme panelinde "Kampanya göndermek için bizimle iletişime geçin" gösterilir.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS campaign_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN tenants.campaign_enabled IS 'Admin tarafından belirlenir. false ise işletme kampanya gönderemez, iletişime geçin mesajı gösterilir.';
