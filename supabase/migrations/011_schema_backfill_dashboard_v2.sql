-- Backfill migration for environments that missed 010
-- Safe to run multiple times.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS owner_phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS security_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tenants_owner_phone_e164
  ON tenants(owner_phone_e164);

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS duration_minutes SMALLINT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS price_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS display_order SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_services_tenant_order
  ON services(tenant_id, display_order, created_at);

