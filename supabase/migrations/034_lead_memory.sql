-- Lead hafızası: randevuya dönüşmeyen konuşmalar da CRM'e düşsün ve bot
-- oturum TTL'i (24 saat) dolduktan sonra da müşteriyi hatırlayabilsin.

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT NOT NULL DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bot_memory JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_customers_lifecycle_stage_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_lifecycle_stage_check
      CHECK (lifecycle_stage IN ('lead', 'customer', 'churned'));
  END IF;
END $$;

-- Geçmiş kayıtlar: randevusu olan herkes 'customer'.
UPDATE crm_customers
SET lifecycle_stage = 'customer'
WHERE total_visits > 0 AND lifecycle_stage = 'lead';

CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_stage_contact
  ON crm_customers(tenant_id, lifecycle_stage, last_contact_at DESC);

COMMENT ON COLUMN crm_customers.lifecycle_stage IS
  'lead = konuştu ama randevu almadı, customer = en az bir randevu, churned = uzun süredir yok.';
COMMENT ON COLUMN crm_customers.bot_memory IS
  'Botun bir sonraki konuşmada kullanacağı kısa, yapılandırılmış hafıza (summary + tercihler).';

/**
 * Her müşteri mesajında çağrılır. Kaydı yoksa lead olarak açar, varsa
 * temas bilgilerini günceller. İsim yalnızca doluysa ve kayıtlı isim boşsa yazılır
 * (panelden girilen ismi bot ezmesin).
 */
CREATE OR REPLACE FUNCTION crm_touch_customer(
  p_tenant_id UUID,
  p_customer_phone TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_contact_at TIMESTAMPTZ DEFAULT now(),
  p_new_conversation BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crm_customers AS c (
    tenant_id,
    customer_phone,
    customer_name,
    lifecycle_stage,
    first_contact_at,
    last_contact_at,
    conversation_count,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_customer_phone,
    NULLIF(btrim(COALESCE(p_customer_name, '')), ''),
    'lead',
    p_contact_at,
    p_contact_at,
    CASE WHEN p_new_conversation THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (tenant_id, customer_phone) DO UPDATE
  SET
    customer_name = COALESCE(
      NULLIF(btrim(COALESCE(c.customer_name, '')), ''),
      NULLIF(btrim(COALESCE(EXCLUDED.customer_name, '')), '')
    ),
    first_contact_at = COALESCE(c.first_contact_at, EXCLUDED.first_contact_at),
    last_contact_at = GREATEST(
      COALESCE(c.last_contact_at, EXCLUDED.last_contact_at),
      EXCLUDED.last_contact_at
    ),
    conversation_count = c.conversation_count
      + CASE WHEN p_new_conversation THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION crm_touch_customer IS
  'Bot her müşteri mesajında çağırır; lead kaydını açar/tazeler. Atomik upsert.';
