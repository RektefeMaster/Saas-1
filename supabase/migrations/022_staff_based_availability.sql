-- Staff-based availability and slot uniqueness (MVP: room/device capacity postponed)

ALTER TABLE availability_slots
  DROP CONSTRAINT IF EXISTS availability_slots_tenant_id_day_of_week_key;

DROP INDEX IF EXISTS unique_availability_slots_tenant_day_staff;
CREATE UNIQUE INDEX IF NOT EXISTS unique_availability_slots_tenant_day_staff
  ON availability_slots(
    tenant_id,
    day_of_week,
    COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

DROP INDEX IF EXISTS unique_active_slot;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot
  ON appointments(
    tenant_id,
    slot_start,
    COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_staff_slot_active
  ON appointments(tenant_id, staff_id, slot_start)
  WHERE status != 'cancelled';
