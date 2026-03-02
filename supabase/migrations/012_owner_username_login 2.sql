-- Tenant owner username support (dashboard login with username + password)
-- Safe to run multiple times.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS owner_username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_owner_username_unique
  ON tenants ((lower(owner_username)))
  WHERE owner_username IS NOT NULL AND deleted_at IS NULL;

