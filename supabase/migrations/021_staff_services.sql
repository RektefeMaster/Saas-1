-- Staff-service mapping for staff preference workflows

CREATE TABLE IF NOT EXISTS staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, service_slug)
);

CREATE INDEX IF NOT EXISTS idx_staff_services_tenant_staff
  ON staff_services(tenant_id, staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_services_tenant_service
  ON staff_services(tenant_id, service_slug);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access staff_services" ON staff_services;
CREATE POLICY "Service role full access staff_services"
  ON staff_services FOR ALL USING (true);
