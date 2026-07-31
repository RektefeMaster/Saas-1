-- Bekleme listesi: hangi hizmet için beklendiği tutulmuyordu.
--
-- Sonuç: yer açıldığında slot her zaman 30 dk'lık varsayılan süreyle tutuluyor
-- ve müşteriye 2,5 saatlik işleme yetmeyen bir saat öneriliyordu. Hizmet
-- bilindiğinde hem doğru süre tutuluyor hem de yalnızca o işleme GERÇEKTEN
-- sığan boşluklarda bildirim gidiyor.
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS service_slug TEXT;

COMMENT ON COLUMN waitlist.service_slug IS
  'Müşterinin beklediği hizmet. Yer açıldığında müsaitlik ve slot tutma bu hizmetin süresiyle hesaplanır. NULL ise varsayılan slot süresi kullanılır.';

-- Bildirim taraması (tenant + gün + bildirilmemiş) için mevcut kısmi indeks
-- yeterli; hizmet kırılımı tarama sonrası bellekte yapılıyor.

-- ─────────────────────────────────────────────────────────────────────────────
-- recurring_appointments kaldırıldı.
--
-- Tablo, takvimde görünmeyen ve hiçbir yerden iptal edilemeyen "görünmez blok"
-- üretiyordu: randevu satırı oluşmadığı için işletme müşterinin geleceğini
-- göremiyor, slot ise her hafta kapalı kalıyordu. Tekrarlayan randevu artık
-- gerçek randevu satırları üretilerek kuruluyor (bkz. appointmentSeries.service).
--
-- Tablo boş olduğu doğrulandıktan sonra düşürülür; dolu ise migration
-- veri kaybetmemek için tabloyu bırakır.
DO $$
DECLARE
  row_count BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recurring_appointments'
  ) THEN
    EXECUTE 'SELECT count(*) FROM recurring_appointments' INTO row_count;
    IF row_count = 0 THEN
      DROP TABLE recurring_appointments;
      RAISE NOTICE 'recurring_appointments düşürüldü (0 kayıt).';
    ELSE
      RAISE NOTICE 'recurring_appointments % kayıt içeriyor, düşürülmedi.', row_count;
    END IF;
  END IF;
END $$;
