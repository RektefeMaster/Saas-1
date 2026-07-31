-- Pazarlama mesajlarından çıkma (opt-out).
-- KVKK ve WhatsApp Business politikası: toplu/kampanya mesajı alan kişinin
-- tek kelimeyle listeden çıkabilmesi gerekir.
--
-- ÖNEMLİ AYRIM: opt-out yalnızca PAZARLAMA mesajlarını durdurur.
-- Randevu hatırlatma / iptal onayı gibi işlemsel mesajlar etkilenmez.

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marketing_opt_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_opt_out_source TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_customers_tenant_opt_out
  ON crm_customers(tenant_id, marketing_opt_out);

COMMENT ON COLUMN crm_customers.marketing_opt_out IS
  'TRUE ise kampanya/geri kazanım mesajı gönderilmez. Randevu hatırlatmaları etkilenmez.';

/**
 * Müşteri "DUR" yazdığında çağrılır. Kaydı yoksa opt-out ile birlikte açar.
 */
CREATE OR REPLACE FUNCTION crm_set_marketing_opt_out(
  p_tenant_id UUID,
  p_customer_phone TEXT,
  p_opt_out BOOLEAN DEFAULT TRUE,
  p_source TEXT DEFAULT 'whatsapp_keyword'
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
    marketing_opt_out,
    marketing_opt_out_at,
    marketing_opt_out_source,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_customer_phone,
    p_opt_out,
    CASE WHEN p_opt_out THEN now() ELSE NULL END,
    p_source,
    now()
  )
  ON CONFLICT (tenant_id, customer_phone) DO UPDATE
  SET
    marketing_opt_out = EXCLUDED.marketing_opt_out,
    marketing_opt_out_at = EXCLUDED.marketing_opt_out_at,
    marketing_opt_out_source = EXCLUDED.marketing_opt_out_source,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION crm_set_marketing_opt_out IS
  'Pazarlama mesajı tercihini ayarlar. Bot "DUR"/"ÇIKIŞ" kelimelerinde çağırır.';
