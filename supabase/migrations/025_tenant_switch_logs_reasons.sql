-- tenant_switch_logs: 'name' ve 'customer_history' reason'larını ekle

ALTER TABLE tenant_switch_logs DROP CONSTRAINT IF EXISTS tenant_switch_logs_switch_reason_check;
ALTER TABLE tenant_switch_logs ADD CONSTRAINT tenant_switch_logs_switch_reason_check
  CHECK (switch_reason IN ('marker', 'name', 'session', 'customer_history', 'nlp', 'default'));
