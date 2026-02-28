-- İnsan yönlendirme: esnaf iletişim bilgileri
-- contact_phone: esnafın gerçek telefonu (yönlendirme mesajında)
-- working_hours_text: çalışma saatleri metni (örn. "Hafta içi 09:00-18:00")

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS working_hours_text TEXT;

COMMENT ON COLUMN tenants.contact_phone IS 'Esnafın gerçek iletişim telefonu; insan yönlendirme mesajında kullanılır.';
COMMENT ON COLUMN tenants.working_hours_text IS 'Çalışma saatleri metni, örn: Hafta içi 09:00-18:00';
