-- Atomic jsonb flag claim/clear (cron reminders / review) without clobbering other keys.
CREATE OR REPLACE FUNCTION claim_appointment_extra_flag(
  p_appointment_id uuid,
  p_flag text,
  p_value text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF p_flag IS NULL OR length(trim(p_flag)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE appointments
  SET extra_data =
        COALESCE(extra_data, '{}'::jsonb)
        || jsonb_build_object(p_flag, to_jsonb(p_value))
  WHERE id = p_appointment_id
    AND (extra_data ->> p_flag) IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION clear_appointment_extra_flag(
  p_appointment_id uuid,
  p_flag text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_flag IS NULL OR length(trim(p_flag)) = 0 THEN
    RETURN;
  END IF;

  UPDATE appointments
  SET extra_data = COALESCE(extra_data, '{}'::jsonb) - p_flag
  WHERE id = p_appointment_id;
END;
$$;

-- Active-slot uniqueness only for bookable statuses (free no_show/completed slots).
DROP INDEX IF EXISTS unique_active_slot;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot
  ON appointments(
    tenant_id,
    slot_start,
    COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('confirmed', 'pending');
