-- Beauty/Nail feature flags + CRM metadata foundation

ALTER TABLE business_types
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN business_types.feature_flags IS
  'Business-type level feature visibility flags (crm_extended_profile, staff_preference, packages, variable_duration, combo_services).';

CREATE INDEX IF NOT EXISTS idx_business_types_feature_flags_gin
  ON business_types USING GIN (feature_flags jsonb_path_ops);

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE crm_customers
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

COMMENT ON COLUMN crm_customers.metadata IS
  'Flexible customer profile metadata (allergies, skin_type, color_history, nail_sensitivity, preferred_staff_id, etc).';

CREATE INDEX IF NOT EXISTS idx_crm_customers_metadata_gin
  ON crm_customers USING GIN (metadata jsonb_path_ops);

-- Baseline flags for current business types when not defined yet.
WITH base_flags AS (
  SELECT
    '{
      "crm_extended_profile": false,
      "staff_preference": false,
      "packages": false,
      "variable_duration": false,
      "combo_services": false
    }'::jsonb AS flags
)
UPDATE business_types bt
SET feature_flags = bf.flags
FROM base_flags bf
WHERE (bt.feature_flags IS NULL OR bt.feature_flags = '{}'::jsonb)
  AND bt.slug IN ('berber', 'kuaför', 'kuafor', 'hali-yikama', 'tamirhane', 'veteriner', 'disci');

-- Healthcare-like operations can optionally use package flows.
UPDATE business_types
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"packages": true}'::jsonb
WHERE slug IN ('disci', 'veteriner');

-- New business type: Kadin Kuafor / Guzellik Salonu
INSERT INTO business_types (name, slug, flow_type, config, bot_config, feature_flags)
VALUES (
  'Kadin Kuafor / Guzellik Salonu',
  'kadin-kuafor',
  'appointment',
  '{}'::jsonb,
  '{
    "bot_persona": "Sen {tenant_name} guzellik salonunun WhatsApp asistanisin. Samimi, net ve guven veren bir dille konus.",
    "opening_message": "Merhaba! Hangi islem icin randevu almak istersiniz?",
    "returning_customer_message": "Tekrar hos geldiniz. Bu sefer hangi islem icin randevu olusturalim?",
    "required_fields": [
      {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gun uygun olur?", "extract_hint": "yarin, cuma, haftaya sali gibi ifadeleri tarihe cevir"},
      {"key": "time", "label": "Saat", "type": "time", "question": "Saat kac uygun?", "extract_hint": "6=18:00, sabah 10=10:00"}
    ],
    "optional_fields": [
      {"key": "service", "label": "Hizmet", "type": "select", "question": "Hangi hizmeti almak istersiniz?", "options": ["Sac kesimi", "Boyama", "Balyaj", "Rofle", "Sac bakimi", "Cilt bakimi", "Manikur", "Pedikur", "Lazer epilasyon", "Kas/Kirpik"]},
      {"key": "preferred_stylist", "label": "Tercih edilen uzman", "type": "text", "question": "Ozellikle tercih ettiginiz bir uzman var mi?"}
    ],
    "messages": {
      "confirmation": "Randevunuz {date} saat {time} icin olusturuldu.",
      "reminder_24h": "Hatirlatalim: yarin saat {time} randevunuz var.",
      "reminder_1h": "1 saat sonra randevunuz var.",
      "cancellation_by_customer": "Randevunuz iptal edildi.",
      "cancellation_by_tenant": "Randevunuz isletme tarafindan iptal edildi. Yeni saat icin yardimci olabilirim.",
      "no_show": "Bugunku randevuya katilim gorunmuyor. Yeni saat isterseniz yardimci olayim.",
      "review_request": "Memnuniyetinizi 1-5 arasi puanlayabilir misiniz?",
      "human_escalation": "Sizi ekibimize yonlendiriyorum: {contact_phone} / Calisma saatleri: {working_hours}",
      "no_availability": "Bu gun uygun saat gorunmuyor. Alternatif bir gun deneyelim mi?",
      "date_blocked": "Bu tarih kapali gorunuyor. Baska bir tarih secelim.",
      "welcome_back": "Tekrar hos geldiniz!",
      "waitlist_added": "Bekleme listesine eklendiniz. Yer acilinca haber verecegiz.",
      "waitlist_available": "Yer acildi. Randevu olusturalim mi?",
      "rescheduled": "Randevunuz {date} {time} saatine tasindi.",
      "daily_summary": "Bugun {count} randevunuz var.",
      "system_error": "Kisa sureli bir sorun yasandi. Lutfen tekrar deneyin."
    },
    "tone": {"style": "samimi", "emoji_set": ["✅"], "use_formal": false, "response_length": "kisa", "use_customer_name": true},
    "examples": [],
    "custom_questions": [],
    "summary_template": "{date} saat {time}",
    "has_services": true,
    "has_slot_count": false,
    "has_address": false,
    "has_pickup_delivery": false,
    "has_item_info": false
  }'::jsonb,
  '{
    "crm_extended_profile": true,
    "staff_preference": true,
    "packages": true,
    "variable_duration": true,
    "combo_services": true
  }'::jsonb
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  flow_type = EXCLUDED.flow_type,
  bot_config = EXCLUDED.bot_config,
  feature_flags = EXCLUDED.feature_flags;

-- New business type: Tirnak Salonu
INSERT INTO business_types (name, slug, flow_type, config, bot_config, feature_flags)
VALUES (
  'Tirnak Salonu',
  'tirnak-salonu',
  'appointment',
  '{}'::jsonb,
  '{
    "bot_persona": "Sen {tenant_name} tirnak salonunun WhatsApp asistanisin. Kisa, net ve estetik odakli cevap ver.",
    "opening_message": "Merhaba! Hangi tirnak hizmeti icin randevu almak istersiniz?",
    "returning_customer_message": "Tekrar hos geldiniz. Bu sefer hangi tirnak islemi icin randevu olusturalim?",
    "required_fields": [
      {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gun uygunsunuz?", "extract_hint": "yarin, pazartesi gibi ifadeleri tarihe cevir"},
      {"key": "time", "label": "Saat", "type": "time", "question": "Saat kac uygun?", "extract_hint": "6=18:00, ogleden sonra 3=15:00"}
    ],
    "optional_fields": [
      {"key": "service", "label": "Hizmet", "type": "select", "question": "Hangi hizmeti almak istersiniz?", "options": ["Manikur", "Pedikur", "Jel tirnak", "Akrilik", "Nail art", "Kalici oje", "Protez cikarimi"]},
      {"key": "technician_preference", "label": "Teknisyen tercihi", "type": "text", "question": "Tercih ettiginiz teknisyen var mi?"}
    ],
    "messages": {
      "confirmation": "Randevunuz {date} saat {time} icin olusturuldu.",
      "reminder_24h": "Hatirlatalim: yarin saat {time} randevunuz var.",
      "reminder_1h": "1 saat sonra randevunuz var.",
      "cancellation_by_customer": "Randevunuz iptal edildi.",
      "cancellation_by_tenant": "Randevunuz isletme tarafindan iptal edildi. Yeni saat olusturabiliriz.",
      "no_show": "Randevuya katilim gorunmuyor. Yeni bir saat isterseniz yazin.",
      "review_request": "Deneyiminizi 1-5 arasi puanlayabilir misiniz?",
      "human_escalation": "Sizi ekibimize yonlendiriyorum: {contact_phone} / Calisma saatleri: {working_hours}",
      "no_availability": "Bu gun uygun saat kalmadi. Alternatif bir gun deneyelim mi?",
      "date_blocked": "Bu tarih kapali gorunuyor. Baska bir tarih secelim.",
      "welcome_back": "Tekrar hos geldiniz!",
      "waitlist_added": "Bekleme listesine eklendiniz.",
      "waitlist_available": "Yer acildi. Randevu olusturalim mi?",
      "rescheduled": "Randevunuz {date} {time} saatine tasindi.",
      "daily_summary": "Bugun {count} randevunuz var.",
      "system_error": "Kisa sureli bir teknik sorun yasandi. Lutfen tekrar deneyin."
    },
    "tone": {"style": "enerjik", "emoji_set": ["✅"], "use_formal": false, "response_length": "kisa", "use_customer_name": true},
    "examples": [],
    "custom_questions": [],
    "summary_template": "{date} saat {time}",
    "has_services": true,
    "has_slot_count": false,
    "has_address": false,
    "has_pickup_delivery": false,
    "has_item_info": false
  }'::jsonb,
  '{
    "crm_extended_profile": true,
    "staff_preference": true,
    "packages": true,
    "variable_duration": false,
    "combo_services": true
  }'::jsonb
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  flow_type = EXCLUDED.flow_type,
  bot_config = EXCLUDED.bot_config,
  feature_flags = EXCLUDED.feature_flags;
