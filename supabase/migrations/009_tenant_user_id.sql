-- tenants tablosuna user_id ekle (Supabase Auth bağlantısı)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
