-- İptal, tatil/izin, yorum, çoklu çalışan schema değişiklikleri

-- Appointments: iptal alanları ve staff_id
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'tenant')),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS staff_id UUID;

-- Staff tablosu (çoklu çalışan, şimdilik sadece schema)
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);

-- Appointments.staff_id foreign key (staff tablosu oluşturulduktan sonra)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_staff_id_fkey'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_staff_id_fkey
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Availability_slots: staff_id
ALTER TABLE availability_slots ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE CASCADE;

-- Blocked dates (tatil/izin)
CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_tenant ON blocked_dates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_range ON blocked_dates(tenant_id, start_date, end_date);

-- Reviews (yorum/değerlendirme)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_tenant ON reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_appointment ON reviews(appointment_id);

-- RLS
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access blocked_dates" ON blocked_dates;
CREATE POLICY "Service role full access blocked_dates" ON blocked_dates FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access reviews" ON reviews;
CREATE POLICY "Service role full access reviews" ON reviews FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access staff" ON staff;
CREATE POLICY "Service role full access staff" ON staff FOR ALL USING (true);
