-- Sprint A1: conversations as ownership SoT + tenant memberships

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'staff', 'manager')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status
  ON tenant_memberships(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user
  ON tenant_memberships(user_id);

-- Bootstrap owners from tenants.user_id
INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
SELECT t.id, t.user_id, 'owner', 'active'
FROM tenants t
WHERE t.user_id IS NOT NULL
  AND t.deleted_at IS NULL
ON CONFLICT (tenant_id, user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp')),
  external_user_id TEXT NOT NULL,
  customer_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  assigned_membership_id UUID REFERENCES tenant_memberships(id) ON DELETE SET NULL,
  automation_mode TEXT NOT NULL DEFAULT 'AI_ACTIVE'
    CHECK (automation_mode IN ('AI_ACTIVE', 'HUMAN_ACTIVE', 'AI_ASSIST', 'AUTOMATION_PAUSED')),
  conversation_status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (conversation_status IN ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED')),
  last_message_at TIMESTAMPTZ,
  last_inbound_message_at TIMESTAMPTZ,
  last_outbound_message_at TIMESTAMPTZ,
  last_customer_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_direction TEXT
    CHECK (last_message_direction IS NULL OR last_message_direction IN ('inbound', 'outbound', 'system')),
  last_message_id TEXT,
  service_window_expiry TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  human_takeover_at TIMESTAMPTZ,
  automation_mode_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high', 'urgent')),
  handoff_reason TEXT,
  summary_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_message
  ON conversations(tenant_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status_mode
  ON conversations(tenant_id, conversation_status, automation_mode);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_unread
  ON conversations(tenant_id, unread_count)
  WHERE unread_count > 0;

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_membership
  ON conversations(assigned_membership_id)
  WHERE assigned_membership_id IS NOT NULL;

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access tenant_memberships" ON tenant_memberships;
CREATE POLICY "Service role full access tenant_memberships"
  ON tenant_memberships FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access conversations" ON conversations;
CREATE POLICY "Service role full access conversations"
  ON conversations FOR ALL USING (true);

-- Backfill helper column on legacy messages (nullable; populate in app or follow-up)
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS normalized_phone_digits TEXT;

COMMENT ON TABLE conversations IS 'WhatsApp conversation ownership SoT (automation_mode in Postgres, not Redis)';
COMMENT ON COLUMN conversations.assigned_membership_id IS 'FK to tenant_memberships — never bare auth user_id';
COMMENT ON COLUMN conversations.version IS 'Optimistic locking for atomic takeover';
