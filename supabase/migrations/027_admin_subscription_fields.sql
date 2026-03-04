-- Faz 2: Abonelik uzatma ve karlilik/rate-limit yonetimi icin tenant alanlari

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS rate_limit_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC(12,2);

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_subscription_plan_check;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_subscription_plan_check
  CHECK (subscription_plan IN ('starter', 'growth', 'pro', 'enterprise', 'custom'));

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_end_at
  ON tenants(subscription_end_at);

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_plan
  ON tenants(subscription_plan);

COMMENT ON COLUMN tenants.subscription_end_at IS 'Abonelik bitis zamani. Admin uzatma operasyonu bu alan uzerinden calisir.';
COMMENT ON COLUMN tenants.subscription_plan IS 'Tenant abonelik paketi (starter/growth/pro/enterprise/custom).';
COMMENT ON COLUMN tenants.rate_limit_override IS 'Tenant bazli mesaj/rate limit override degerleri.';
COMMENT ON COLUMN tenants.monthly_revenue IS 'Aylik gelir (Cuzdan Radari ve profitability hesaplari icin).';
