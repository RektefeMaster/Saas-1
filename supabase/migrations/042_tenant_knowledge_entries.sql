-- Sprint C4: versioned approved knowledge (not for prices — use services table)

CREATE TABLE IF NOT EXISTS tenant_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'faq',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ,
  effective_until TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  source TEXT,
  scope TEXT NOT NULL DEFAULT 'tenant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_knowledge_tenant_status
  ON tenant_knowledge_entries(tenant_id, status, category);

ALTER TABLE tenant_knowledge_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access tenant_knowledge_entries" ON tenant_knowledge_entries;
CREATE POLICY "Service role full access tenant_knowledge_entries"
  ON tenant_knowledge_entries FOR ALL USING (true);

COMMENT ON TABLE tenant_knowledge_entries IS 'Approved text knowledge only; prices stay in services';
