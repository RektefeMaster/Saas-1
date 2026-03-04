-- Realtime: appointments tablosu için canlı güncellemeler
-- Supabase Dashboard > Database > Replication'dan da etkinleştirilebilir
-- Zaten publication'da ise hata vermeden geç
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Zaten ekli
END $$;
