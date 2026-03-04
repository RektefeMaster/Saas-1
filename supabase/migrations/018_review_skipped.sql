-- "Geç" / skip seçimini kaydetmek için reviews tablosuna skipped alanı
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS skipped BOOLEAN DEFAULT false;

-- rating nullable yap (skipped=true iken null)
ALTER TABLE reviews ALTER COLUMN rating DROP NOT NULL;

-- Eski CHECK kaldır (PostgreSQL varsayılan isim: reviews_rating_check)
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;

-- Yeni kural: (skipped=false ve rating 1-5) veya (skipped=true ve rating null)
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_skipped_check CHECK (
  (COALESCE(skipped, false) = false AND rating IS NOT NULL AND rating >= 1 AND rating <= 5)
  OR (skipped = true AND rating IS NULL)
);
