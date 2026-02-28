-- [YENİ] Race condition önleme: Aynı tenant + slot_start için iptal edilmemiş tek kayıt.
-- İki müşteri aynı anda aynı slotu alamaz (unique constraint).
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot
ON appointments(tenant_id, slot_start)
WHERE status != 'cancelled';
