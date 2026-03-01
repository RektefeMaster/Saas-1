-- bot_config: İşletme tipine göre config-driven bot davranışı
-- Yeni işletme tipi = sadece bu tabloya yeni satır. Kod değişmez.

ALTER TABLE business_types
  ADD COLUMN IF NOT EXISTS bot_config JSONB;

CREATE INDEX IF NOT EXISTS idx_business_types_slug ON business_types(slug);

COMMENT ON COLUMN business_types.bot_config IS 'Config-driven bot: persona, mesajlar, alanlar, ton, örnekler. Null ise eski config kullanılır.';

-- Mevcut Kuaför kaydına bot_config ekle (geriye uyum: mevcut tenant'lar yeni akışa geçer)
UPDATE business_types
SET bot_config = '{
  "bot_persona": "Sen {tenant_name} kuaförünün WhatsApp asistanısın. Samimi, kısa ve doğal konuş.",
  "opening_message": "Merhaba! Ne zaman randevu almak istiyorsunuz?",
  "returning_customer_message": "Tekrar hoşgeldiniz! Ne zaman uğramak istiyorsunuz?",
  "required_fields": [
    {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün geleceksiniz?", "extract_hint": "yarın, bugün, pazartesi gibi ifadeleri tarihe çevir"},
    {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaçta uygun?", "extract_hint": "6 = 18:00, sabah 10 = 10:00"}
  ],
  "optional_fields": [{"key": "service", "label": "Hizmet", "type": "select", "question": "Ne yaptıracaksınız?", "options": ["Saç kesimi", "Sakal", "Saç+Sakal", "Yıkama"]}],
  "messages": {
    "confirmation": "Tamam! {date} saat {time}de bekliyoruz.",
    "reminder_24h": "Merhaba! Yarın saat {time}de randevunuz var.",
    "reminder_1h": "1 saat sonra randevunuz var.",
    "cancellation_by_customer": "Randevunuz iptal edildi. Başka zaman görüşürüz!",
    "cancellation_by_tenant": "Üzgünüz, randevunuzu iptal etmek zorunda kaldık. Yeni randevu için yazabilirsiniz.",
    "no_show": "Bugün randevunuza gelemediniz. Yeni randevu almak ister misiniz?",
    "review_request": "Memnun kaldınız mı? 1-5 arası puan verir misiniz?",
    "human_escalation": "Sizi ustamıza bağlıyorum. {contact_phone} - Çalışma saatleri: {working_hours}",
    "no_availability": "O gün müsait yerimiz yok. Başka bir gün dener misiniz?",
    "date_blocked": "O tarihler kapalı. Başka bir tarih seçer misiniz?",
    "welcome_back": "Tekrar hoşgeldiniz!",
    "waitlist_added": "Bekleme listesine ekledik. Yer açılırsa haber veririz!",
    "waitlist_available": "Yer açıldı. Randevu alayım mı?",
    "rescheduled": "Randevunuz {date} {time}e taşındı.",
    "daily_summary": "Bugün {count} randevunuz var.",
    "system_error": "Şu an küçük bir sorun var. Birazdan tekrar dener misiniz?"
  },
  "tone": {"style": "samimi", "emoji_set": ["✅", "👍"], "use_formal": false, "response_length": "kisa", "use_customer_name": false},
  "examples": [],
  "custom_questions": [],
  "summary_template": "{date} saat {time}",
  "has_services": true,
  "has_slot_count": false,
  "has_address": false,
  "has_pickup_delivery": false,
  "has_item_info": false
}'::jsonb
WHERE slug = 'kuaför';

-- Yeni işletme tipleri (slug yoksa ekle)
INSERT INTO business_types (name, slug, flow_type, config, bot_config)
VALUES (
  'Berber',
  'berber',
  'appointment',
  '{}'::jsonb,
  '{
  "bot_persona": "Sen {tenant_name} berberinin WhatsApp asistanısın. Samimi, kısa ve doğal konuş. Resmi olma.",
  "opening_message": "Merhaba! Ne zaman uğramak istiyordunuz?",
  "returning_customer_message": "Tekrar hoşgeldiniz! Ne zaman uğramak istiyordunuz?",
  "required_fields": [
    {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün geleceksiniz?", "extract_hint": "yarın, bugün, pazartesi gibi ifadeleri tarihe çevir"},
    {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaçta uygun?", "extract_hint": "6 = 18:00, sabah 10 = 10:00"}
  ],
  "optional_fields": [{"key": "service", "label": "Hizmet", "type": "select", "question": "Ne yaptıracaksınız?", "options": ["Saç kesimi", "Sakal", "Saç+Sakal", "Yıkama"]}],
  "messages": {
    "confirmation": "Tamam! {date} saat {time}de bekliyoruz.",
    "reminder_24h": "Merhaba! Yarın saat {time}de randevunuz var.",
    "reminder_1h": "1 saat sonra randevunuz var.",
    "cancellation_by_customer": "Randevunuz iptal edildi. Başka zaman görüşürüz!",
    "cancellation_by_tenant": "Üzgünüz, randevunuzu iptal etmek zorunda kaldık.",
    "no_show": "Bugün randevunuza gelemediniz. Yeni randevu almak ister misiniz?",
    "review_request": "Memnun kaldınız mı? 1-5 arası puan verir misiniz?",
    "human_escalation": "Sizi ustamıza bağlıyorum. {contact_phone} - Çalışma saatleri: {working_hours}",
    "no_availability": "O gün müsait yerimiz yok. Başka bir gün dener misiniz?",
    "date_blocked": "O tarihler kapalı. Başka bir tarih seçer misiniz?",
    "welcome_back": "Tekrar hoşgeldiniz!",
    "waitlist_added": "Bekleme listesine ekledik. Yer açılırsa haber veririz!",
    "waitlist_available": "Yer açıldı. Randevu alayım mı?",
    "rescheduled": "Randevunuz {date} {time}e taşındı.",
    "daily_summary": "Bugün {count} randevunuz var.",
    "system_error": "Şu an küçük bir sorun var. Birazdan tekrar dener misiniz?"
  },
  "tone": {"style": "samimi", "emoji_set": ["✅", "👍"], "use_formal": false, "response_length": "kisa", "use_customer_name": false},
  "examples": [],
  "custom_questions": [],
  "summary_template": "{date} saat {time}",
  "has_services": true,
  "has_slot_count": false,
  "has_address": false,
  "has_pickup_delivery": false,
  "has_item_info": false
}'::jsonb
),
(
  'Dişçi',
  'disci',
  'appointment',
  '{}'::jsonb,
  '{
  "bot_persona": "Sen {tenant_name} diş kliniğinin WhatsApp asistanısın. Profesyonel ve güven veren bir dille konuş.",
  "opening_message": "Merhaba! Randevu almak için hangi gün uygunsunuz?",
  "returning_customer_message": "Tekrar hoşgeldiniz! Ne zaman randevu almak istersiniz?",
  "required_fields": [
    {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün uygunsunuz?", "extract_hint": "tarih ifadelerini çıkar"},
    {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaçta uygun?", "extract_hint": "saat ifadelerini çıkar"}
  ],
  "optional_fields": [{"key": "service", "label": "İşlem", "type": "select", "question": "Hangi işlem için?", "options": ["Kontrol", "Dolgu", "Temizlik", "Kanál tedavisi", "Diğer"]}],
  "messages": {
    "confirmation": "Randevunuz {date} saat {time} için kaydedildi. Görüşmek üzere.",
    "reminder_24h": "Yarın saat {time} randevunuz var. Lütfen unutmayın.",
    "reminder_1h": "1 saat sonra randevunuz var.",
    "cancellation_by_customer": "Randevunuz iptal edildi. İhtiyaç olursa tekrar randevu alabilirsiniz.",
    "cancellation_by_tenant": "Maalesef randevunuz iptal edildi. Yeni randevu için yazabilirsiniz.",
    "no_show": "Randevunuza gelemediniz. Yeni randevu almak ister misiniz?",
    "review_request": "Memnun kaldınız mı? Değerlendirmenizi bekliyoruz.",
    "human_escalation": "Sizi kliniğimize yönlendiriyoruz: {contact_phone}. Çalışma saatleri: {working_hours}",
    "no_availability": "O gün müsait değiliz. Başka bir tarih seçer misiniz?",
    "date_blocked": "O tarihler kapalı.",
    "welcome_back": "Tekrar hoşgeldiniz!",
    "waitlist_added": "Bekleme listesine eklendi. Yer açılırsa haber veririz.",
    "waitlist_available": "Yer açıldı. Randevu alalım mı?",
    "rescheduled": "Randevunuz {date} {time}e taşındı.",
    "daily_summary": "Bugün {count} randevunuz var.",
    "system_error": "Teknik bir sorun oluştu. Lütfen kısa süre sonra tekrar deneyin."
  },
  "tone": {"style": "profesyonel", "emoji_set": ["✅"], "use_formal": true, "response_length": "orta", "use_customer_name": true},
  "examples": [],
  "custom_questions": [],
  "summary_template": "{date} saat {time}",
  "has_services": true,
  "has_slot_count": false,
  "has_address": false,
  "has_pickup_delivery": false,
  "has_item_info": false
}'::jsonb
),
(
  'Veteriner',
  'veteriner',
  'appointment',
  '{}'::jsonb,
  '{
  "bot_persona": "Sen {tenant_name} veteriner kliniğinin WhatsApp asistanısın. Samimi ve güven veren bir dille konuş.",
  "opening_message": "Merhaba! Evcil hayvanınız için randevu almak ister misiniz?",
  "returning_customer_message": "Tekrar hoşgeldiniz! Randevu almak ister misiniz?",
  "required_fields": [
    {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün uygun?", "extract_hint": "tarih çıkar"},
    {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaçta?", "extract_hint": "saat çıkar"}
  ],
  "optional_fields": [{"key": "pet", "label": "Hayvan", "type": "text", "question": "Hangi hayvan için? (tür, yaş)"}],
  "messages": {
    "confirmation": "Randevunuz {date} saat {time} için kaydedildi. Patili dostunuzu bekliyoruz.",
    "reminder_24h": "Yarın saat {time} randevunuz var.",
    "reminder_1h": "1 saat sonra randevunuz var.",
    "cancellation_by_customer": "Randevunuz iptal edildi.",
    "cancellation_by_tenant": "Randevunuz iptal edildi. Yeni randevu için yazabilirsiniz.",
    "no_show": "Randevunuza gelemediniz. Yeni randevu almak ister misiniz?",
    "review_request": "Değerlendirmenizi bekliyoruz.",
    "human_escalation": "Bizi arayabilirsiniz: {contact_phone}. Çalışma saatleri: {working_hours}",
    "no_availability": "O gün müsait değiliz.",
    "date_blocked": "O tarihler kapalı.",
    "welcome_back": "Tekrar hoşgeldiniz!",
    "waitlist_added": "Bekleme listesine eklendi.",
    "waitlist_available": "Yer açıldı.",
    "rescheduled": "Randevunuz {date} {time}e taşındı.",
    "daily_summary": "Bugün {count} randevunuz var.",
    "system_error": "Kısa süre sonra tekrar deneyin."
  },
  "tone": {"style": "sicak", "emoji_set": ["✅", "🐾"], "use_formal": false, "response_length": "orta", "use_customer_name": false},
  "examples": [],
  "custom_questions": [],
  "summary_template": "{date} saat {time}",
  "has_services": true,
  "has_slot_count": false,
  "has_address": false,
  "has_pickup_delivery": false,
  "has_item_info": false
}'::jsonb
),
(
  'Halı Yıkama',
  'hali-yikama',
  'appointment',
  '{}'::jsonb,
  '{
  "bot_persona": "Sen {tenant_name} halı yıkama hizmetinin WhatsApp asistanısın. Samimi ve net konuş.",
  "opening_message": "Merhaba! Halı yıkama için ne zaman uygun?",
  "returning_customer_message": "Tekrar hoşgeldiniz! Randevu almak ister misiniz?",
  "required_fields": [
    {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün?", "extract_hint": "tarih çıkar"},
    {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaçta?", "extract_hint": "saat çıkar"},
    {"key": "address", "label": "Adres", "type": "address", "question": "Adresiniz?"}
  ],
  "optional_fields": [],
  "messages": {
    "confirmation": "Randevunuz {date} saat {time} için kaydedildi. Adres: {address}",
    "reminder_24h": "Yarın saat {time} evinizde olacağız.",
    "reminder_1h": "1 saat sonra adresinizde olacağız.",
    "cancellation_by_customer": "Randevunuz iptal edildi.",
    "cancellation_by_tenant": "Randevunuz iptal edildi.",
    "no_show": "Randevunuza gelemediniz.",
    "review_request": "Memnun kaldınız mı?",
    "human_escalation": "Bizi arayın: {contact_phone}. Çalışma: {working_hours}",
    "no_availability": "O gün müsait değiliz.",
    "date_blocked": "O tarihler kapalı.",
    "welcome_back": "Tekrar hoşgeldiniz!",
    "waitlist_added": "Bekleme listesine eklendi.",
    "waitlist_available": "Yer açıldı.",
    "rescheduled": "Randevunuz {date} {time}e taşındı.",
    "daily_summary": "Bugün {count} randevunuz var.",
    "system_error": "Kısa süre sonra tekrar deneyin."
  },
  "tone": {"style": "samimi", "emoji_set": ["✅"], "use_formal": false, "response_length": "kisa", "use_customer_name": false},
  "examples": [],
  "custom_questions": [],
  "summary_template": "{date} {time} - {address}",
  "has_services": false,
  "has_slot_count": false,
  "has_address": true,
  "has_pickup_delivery": false,
  "has_item_info": false
}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
