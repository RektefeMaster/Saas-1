-- Bekleme listesi
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  desired_date DATE NOT NULL,
  desired_time TIME,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, customer_phone, desired_date)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_date ON waitlist(tenant_id, desired_date) WHERE notified = FALSE;

-- Tekrar eden randevu
CREATE TABLE IF NOT EXISTS recurring_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time TIME NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, customer_phone, day_of_week, time)
);

-- RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access waitlist" ON waitlist;
CREATE POLICY "Service role full access waitlist" ON waitlist FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access recurring_appointments" ON recurring_appointments;
CREATE POLICY "Service role full access recurring_appointments" ON recurring_appointments FOR ALL USING (true);
