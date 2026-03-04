-- Staff notification contact for appointment alerts

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_tenant_phone_e164
  ON staff(tenant_id, phone_e164);
