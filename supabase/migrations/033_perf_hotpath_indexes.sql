-- Hot-path indexes for booking availability + tenant routing history.

CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone_updated
  ON appointments(customer_phone, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_availability_slots_tenant_dow
  ON availability_slots(tenant_id, day_of_week);
