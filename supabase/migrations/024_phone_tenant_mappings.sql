-- Telefon–tenant eşleşmesi (Redis yoksa / serverless fallback)
-- Müşteri ilk mesajda tenant ile eşleşince bu tabloya yazılır.
-- Sonraki mesajlarda Redis miss olursa buradan okunur.

CREATE TABLE IF NOT EXISTS phone_tenant_mappings (
  customer_phone_digits TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_tenant_mappings_tenant_updated
  ON phone_tenant_mappings(tenant_id, updated_at DESC);

COMMENT ON TABLE phone_tenant_mappings IS 'Müşteri telefonu → tenant eşleşmesi; Redis/serverless fallback için kalıcı depolama';

ALTER TABLE phone_tenant_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access phone_tenant_mappings" ON phone_tenant_mappings;
CREATE POLICY "Service role full access phone_tenant_mappings"
  ON phone_tenant_mappings FOR ALL USING (true);
