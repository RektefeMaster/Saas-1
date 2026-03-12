-- Migration 030: Risky Conversations SQL Aggregation Function
-- Bu migration, conversation_messages tablosunda aggregation yaparak
-- riskli konuşmaları daha verimli şekilde bulmak için bir RPC function oluşturur.
-- 
-- NOT: Bu migration opsiyoneldir. Mevcut kod optimize edilmiş client-side aggregation kullanıyor.
-- Bu function'ı kullanmak için route.ts dosyasında .rpc() çağrısı yapılmalı.

CREATE OR REPLACE FUNCTION get_risky_conversations_aggregated(
  p_from_timestamp TIMESTAMPTZ,
  p_to_timestamp TIMESTAMPTZ,
  p_tenant_id TEXT DEFAULT NULL,
  p_phone_digits TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  tenant_id TEXT,
  customer_phone_digits TEXT,
  message_count BIGINT,
  inbound_count BIGINT,
  outbound_count BIGINT,
  system_count BIGINT,
  last_message_at TIMESTAMPTZ,
  last_inbound_text TEXT,
  last_outbound_text TEXT,
  stage_counts JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.tenant_id::TEXT,
    cm.customer_phone_digits,
    COUNT(*)::BIGINT as message_count,
    COUNT(*) FILTER (WHERE cm.direction = 'inbound')::BIGINT as inbound_count,
    COUNT(*) FILTER (WHERE cm.direction = 'outbound')::BIGINT as outbound_count,
    COUNT(*) FILTER (WHERE cm.direction = 'system')::BIGINT as system_count,
    MAX(cm.created_at) as last_message_at,
    (SELECT message_text 
     FROM conversation_messages cm2 
     WHERE cm2.tenant_id = cm.tenant_id 
       AND cm2.customer_phone_digits = cm.customer_phone_digits
       AND cm2.direction = 'inbound'
       AND cm2.created_at >= p_from_timestamp
       AND cm2.created_at <= p_to_timestamp
     ORDER BY cm2.created_at DESC 
     LIMIT 1) as last_inbound_text,
    (SELECT message_text 
     FROM conversation_messages cm3 
     WHERE cm3.tenant_id = cm.tenant_id 
       AND cm3.customer_phone_digits = cm.customer_phone_digits
       AND cm3.direction = 'outbound'
       AND cm3.created_at >= p_from_timestamp
       AND cm3.created_at <= p_to_timestamp
     ORDER BY cm3.created_at DESC 
     LIMIT 1) as last_outbound_text,
    COALESCE(
      (SELECT jsonb_object_agg(stage, count)
       FROM (
         SELECT stage, COUNT(*) as count
         FROM conversation_messages cm2
         WHERE cm2.tenant_id = cm.tenant_id
           AND cm2.customer_phone_digits = cm.customer_phone_digits
           AND cm2.created_at >= p_from_timestamp
           AND cm2.created_at <= p_to_timestamp
           AND cm2.stage IS NOT NULL
           AND cm2.stage != ''
         GROUP BY cm2.stage
       ) stage_data),
      '{}'::jsonb
    ) as stage_counts
  FROM conversation_messages cm
  WHERE cm.created_at >= p_from_timestamp
    AND cm.created_at <= p_to_timestamp
    AND (p_tenant_id IS NULL OR cm.tenant_id = p_tenant_id)
    AND (p_phone_digits IS NULL OR cm.customer_phone_digits = p_phone_digits)
    AND cm.tenant_id IS NOT NULL
    AND cm.customer_phone_digits IS NOT NULL
  GROUP BY cm.tenant_id, cm.customer_phone_digits
  HAVING COUNT(*) >= 3  -- En az 3 mesaj olan conversation'lar
  ORDER BY message_count DESC, last_message_at DESC
  LIMIT p_limit;
END;
$$;

-- Function'ı public schema'ya ekle
GRANT EXECUTE ON FUNCTION get_risky_conversations_aggregated TO authenticated;
GRANT EXECUTE ON FUNCTION get_risky_conversations_aggregated TO anon;

COMMENT ON FUNCTION get_risky_conversations_aggregated IS 
  'Aggregates conversation_messages by tenant_id and customer_phone_digits for risky conversations analysis. Returns aggregated counts and latest messages.';
