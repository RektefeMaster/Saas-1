-- Package/session tracking foundation

CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_slug TEXT NOT NULL,
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_tenant_active
  ON packages(tenant_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_packages_tenant_service
  ON packages(tenant_id, service_slug);

CREATE TABLE IF NOT EXISTS customer_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
  remaining_sessions INTEGER NOT NULL CHECK (remaining_sessions >= 0),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_packages_tenant_phone
  ON customer_packages(tenant_id, customer_phone, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_packages_tenant_status
  ON customer_packages(tenant_id, status, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_packages_package
  ON customer_packages(package_id);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access packages" ON packages;
CREATE POLICY "Service role full access packages"
  ON packages FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access customer_packages" ON customer_packages;
CREATE POLICY "Service role full access customer_packages"
  ON customer_packages FOR ALL USING (true);

CREATE OR REPLACE FUNCTION consume_customer_package_session(p_customer_package_id UUID)
RETURNS TABLE(id UUID, remaining_sessions INTEGER, status TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE customer_packages cp
  SET remaining_sessions = cp.remaining_sessions - 1,
      status = CASE
        WHEN cp.remaining_sessions - 1 <= 0 THEN 'completed'
        ELSE cp.status
      END,
      updated_at = now()
  WHERE cp.id = p_customer_package_id
    AND cp.status = 'active'
    AND cp.remaining_sessions > 0
    AND (cp.expires_at IS NULL OR cp.expires_at >= now())
  RETURNING cp.id, cp.remaining_sessions, cp.status;
END;
$$;
