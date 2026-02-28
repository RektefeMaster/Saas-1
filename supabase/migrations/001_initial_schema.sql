-- SaaSRandevu Initial Schema
-- Supabase'de çalıştırılacak veya: supabase db push

-- Business types (sektör/vertical tanımları)
CREATE TABLE IF NOT EXISTS business_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('appointment', 'appointment_with_extras', 'order', 'reservation', 'hybrid')),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tenants (kiracılar / esnaflar)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type_id UUID NOT NULL REFERENCES business_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  tenant_code TEXT NOT NULL UNIQUE,  -- AHMET01, HASAN02 - QR/link ile kullanılır
  config_override JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_tenant_code ON tenants(tenant_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_business_type ON tenants(business_type_id);

-- Services (hizmet kategorileri - süre yok)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);

-- Availability slots (çalışma saatleri)
CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Pazar, 1=Pzt...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_tenant ON availability_slots(tenant_id);

-- Appointments (randevular)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  service_slug TEXT,
  extra_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_slot ON appointments(tenant_id, slot_start) WHERE status NOT IN ('cancelled');
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);

-- Orders (sipariş modülü için)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled')),
  extra_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);

-- AI conversations (opsiyonel - tamamlanan konuşma logu)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  context_json JSONB,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant ON ai_conversations(tenant_id);

-- Row Level Security (RLS)
ALTER TABLE business_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Admin/service role tüm tablolara erişebilir (API service key ile)
-- Tenant izolasyonu uygulama katmanında tenant_id ile yapılır
DROP POLICY IF EXISTS "Service role full access business_types" ON business_types;
CREATE POLICY "Service role full access business_types" ON business_types FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access tenants" ON tenants;
CREATE POLICY "Service role full access tenants" ON tenants FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access services" ON services;
CREATE POLICY "Service role full access services" ON services FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access availability_slots" ON availability_slots;
CREATE POLICY "Service role full access availability_slots" ON availability_slots FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access appointments" ON appointments;
CREATE POLICY "Service role full access appointments" ON appointments FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access orders" ON orders;
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (true);
DROP POLICY IF EXISTS "Service role full access ai_conversations" ON ai_conversations;
CREATE POLICY "Service role full access ai_conversations" ON ai_conversations FOR ALL USING (true);

-- Örnek business_type (kuaför)
INSERT INTO business_types (name, slug, flow_type, config) VALUES
  ('Kuaför', 'kuaför', 'appointment', '{"ai_prompt_template": "Sen {tenant_name} kuaförünün WhatsApp asistanısın. Tarih ve saat sor. Türkçe, samimi ve kısa cevap ver.", "extra_fields": [], "messages": {"confirmation": "Randevunuz {date} saat {time} da kaydedildi. 24 saat önce hatırlatacağız.", "reminder": "Merhaba, yarın {time} da randevunuz var. Lütfen unutmayın!"}}'::jsonb),
  ('Tamirhane', 'tamirhane', 'appointment_with_extras', '{"ai_prompt_template": "Sen {tenant_name} oto servisinin WhatsApp asistanısın. Müşteriden aracın plakasını da iste. Türkçe, samimi cevap ver.", "extra_fields": [{"key": "plaka", "label": "Plaka", "type": "text", "required": true}], "messages": {"confirmation": "Randevunuz {date} saat {time} da kaydedildi. Plaka: {plaka}. 24 saat önce hatırlatacağız.", "reminder": "Merhaba, yarın {time} da randevunuz var. Lütfen unutmayın!"}}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
