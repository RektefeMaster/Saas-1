-- Faz 2: Tek kullanimlik magic link altyapisi

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT 'tenant_public_link',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_tenant_created
  ON magic_links(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at
  ON magic_links(expires_at);

COMMENT ON TABLE magic_links IS 'Tek kullanimlik ve sureli onboarding/access linkleri';
COMMENT ON COLUMN magic_links.token IS 'Magic link tokeni (tekil)';
COMMENT ON COLUMN magic_links.purpose IS 'Link amaci: tenant_public_link vb.';
COMMENT ON COLUMN magic_links.expires_at IS 'Linkin gecerlilik sonu';
COMMENT ON COLUMN magic_links.used_at IS 'Linkin tuketildigi an (tek kullanim kontrolu)';

ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access magic_links" ON magic_links;
CREATE POLICY "Service role full access magic_links"
  ON magic_links FOR ALL USING (true);
