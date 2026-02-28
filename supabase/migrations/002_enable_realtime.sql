-- Realtime: appointments tablosu için canlı güncellemeler
-- Supabase Dashboard > Database > Replication'dan da etkinleştirilebilir
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
