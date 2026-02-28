-- Hizmetlere fiyat ve aciklama ekle
ALTER TABLE services ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;

-- Kara liste / no-show takibi
CREATE TABLE IF NOT EXISTS customer_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  no_show_count INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_tenant_phone ON customer_blacklist(tenant_id, customer_phone);

ALTER TABLE customer_blacklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access customer_blacklist" ON customer_blacklist;
CREATE POLICY "Service role full access customer_blacklist" ON customer_blacklist FOR ALL USING (true);
