-- Sektör kapsamı: lazer epilasyon, güzellik/medikal estetik merkezi ve
-- diş kliniği / gülüş estetiği için işletme tipi + bot_config + feature_flags.
--
-- Not: 019'daki kayıtlar ASCII yazılmıştı ("Randevunuz olusturuldu"); müşteriye
-- giden metinler burada düzgün Türkçe ile tanımlanır.

-- ─────────────────────────────────────────────────────────────────────────────
-- Lazer Epilasyon / Medikal Estetik
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO business_types (name, slug, flow_type, config, bot_config, feature_flags)
VALUES (
  'Lazer Epilasyon Merkezi',
  'lazer-epilasyon',
  'appointment',
  '{}'::jsonb,
  '{
    "bot_persona": "Sen {tenant_name} lazer epilasyon merkezinin WhatsApp asistanısın. Net, kibar ve güven veren bir dille konuş. Tıbbi tavsiye vermezsin; değerlendirmeyi uzmana bırakırsın.",
    "opening_message": "Merhaba! Hangi bölge için randevu oluşturalım?",
    "returning_customer_message": "Tekrar hoş geldiniz! Bu seans için hangi bölgeyi planlayalım?",
    "required_fields": [
      {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün uygun olur?", "extract_hint": "yarın, cuma, haftaya salı gibi ifadeleri tarihe çevir"},
      {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaç uygun?", "extract_hint": "6=18:00, sabah 10=10:00"}
    ],
    "optional_fields": [
      {"key": "service", "label": "Bölge", "type": "select", "question": "Hangi bölge için randevu alalım?", "options": ["Tüm vücut", "Bacak", "Kol", "Koltuk altı", "Bikini", "Yüz", "Sırt", "Cilt bakımı"]},
      {"key": "preferred_specialist", "label": "Tercih edilen uzman", "type": "text", "question": "Tercih ettiğiniz bir uzman var mı?"}
    ],
    "messages": {
      "confirmation": "Randevunuz {date} saat {time} için oluşturuldu. İşlem bölgesini randevudan önce jiletle tıraş etmeniz yeterli; ağda ve tüy dökücü krem kullanmayın.",
      "reminder_24h": "Hatırlatalım: yarın saat {time} randevunuz var. İşlem bölgesini tıraş etmeyi unutmayın, güneş ve solaryumdan uzak durun.",
      "reminder_1h": "1 saat sonra randevunuz var, bekliyoruz.",
      "cancellation_by_customer": "Randevunuz iptal edildi. Yeni bir seans planlamak isterseniz buradan yazabilirsiniz.",
      "cancellation_by_tenant": "Randevunuz merkezimiz tarafından iptal edildi. Uygun yeni bir saat için yardımcı olayım.",
      "no_show": "Bugünkü seansınıza katılım göremedik. Yeni bir seans planlamak ister misiniz?",
      "review_request": "Seansınızdan memnun kaldınız mı? Deneyiminizi 1-5 arası puanlayabilir misiniz?",
      "human_escalation": "Sizi uzman ekibimize yönlendiriyorum: {contact_phone} / Çalışma saatleri: {working_hours}",
      "no_availability": "O gün uygun saatimiz görünmüyor. Başka bir gün bakalım mı?",
      "date_blocked": "O tarih kapalı görünüyor. Başka bir tarih seçelim.",
      "welcome_back": "Tekrar hoş geldiniz!",
      "waitlist_added": "Bekleme listesine eklendiniz. Yer açılınca haber vereceğiz.",
      "waitlist_available": "Yer açıldı. Randevunuzu oluşturalım mı?",
      "rescheduled": "Randevunuz {date} {time} saatine taşındı.",
      "daily_summary": "Bugün {count} randevunuz var.",
      "system_error": "Kısa süreli bir sorun oluştu. Birazdan tekrar dener misiniz?"
    },
    "tone": {"style": "profesyonel", "emoji_set": [], "use_formal": true, "response_length": "kisa", "use_customer_name": true},
    "examples": [
      {
        "context": "Seans sayısı sorusu — garanti verilmez",
        "exchanges": [
          {"user": "kaç seansta biter?", "bot": "Seans sayısı cilt ve kıl yapısına göre kişiden kişiye değişiyor. Uzmanımız ilk değerlendirmede size net bir plan çıkarıyor. Değerlendirme için randevu oluşturalım mı?"}
        ]
      },
      {
        "context": "Riskli durum — karar bota ait değil",
        "exchanges": [
          {"user": "hamileyim lazer yaptırabilir miyim?", "bot": "Bu durumu uzmanımızın değerlendirmesi gerekiyor, ben karar veremiyorum. Merkezimizi arayıp uzmanımıza danışabilirsiniz."}
        ]
      },
      {
        "context": "Paket sorusu",
        "exchanges": [
          {"user": "paketiniz var mı", "bot": "Evet, seans paketlerimiz var. Hangi bölge için bakalım?"}
        ]
      }
    ],
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Güzellik Merkezi (cilt bakımı + medikal estetik ağırlıklı)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO business_types (name, slug, flow_type, config, bot_config, feature_flags)
VALUES (
  'Güzellik Merkezi',
  'guzellik-merkezi',
  'appointment',
  '{}'::jsonb,
  '{
    "bot_persona": "Sen {tenant_name} güzellik merkezinin WhatsApp asistanısın. Sıcak, net ve güven veren bir dille konuş. Tıbbi tavsiye vermezsin; değerlendirmeyi uzmana bırakırsın.",
    "opening_message": "Merhaba! Hangi işlem için randevu oluşturalım?",
    "returning_customer_message": "Tekrar hoş geldiniz! Bu sefer hangi işlem için planlayalım?",
    "required_fields": [
      {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün uygun olur?", "extract_hint": "yarın, cuma, haftaya salı gibi ifadeleri tarihe çevir"},
      {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaç uygun?", "extract_hint": "6=18:00, sabah 10=10:00"}
    ],
    "optional_fields": [
      {"key": "service", "label": "İşlem", "type": "select", "question": "Hangi işlemi planlayalım?", "options": ["Cilt bakımı", "Leke bakımı", "Akne bakımı", "Lazer epilasyon", "Ağda", "Kaş/Kirpik", "Masaj", "Manikür/Pedikür"]},
      {"key": "preferred_specialist", "label": "Tercih edilen uzman", "type": "text", "question": "Tercih ettiğiniz bir uzman var mı?"}
    ],
    "messages": {
      "confirmation": "Randevunuz {date} saat {time} için oluşturuldu. Sizi bekliyoruz.",
      "reminder_24h": "Hatırlatalım: yarın saat {time} randevunuz var. Görüşmek üzere!",
      "reminder_1h": "1 saat sonra randevunuz var, bekliyoruz.",
      "cancellation_by_customer": "Randevunuz iptal edildi. Dilediğinizde yeni bir randevu oluşturabiliriz.",
      "cancellation_by_tenant": "Randevunuz merkezimiz tarafından iptal edildi. Uygun yeni bir saat için yardımcı olayım.",
      "no_show": "Bugünkü randevunuza katılım göremedik. Yeni bir saat planlamak ister misiniz?",
      "review_request": "Deneyiminizden memnun kaldınız mı? 1-5 arası puanlayabilir misiniz?",
      "human_escalation": "Sizi uzman ekibimize yönlendiriyorum: {contact_phone} / Çalışma saatleri: {working_hours}",
      "no_availability": "O gün uygun saatimiz görünmüyor. Başka bir gün bakalım mı?",
      "date_blocked": "O tarih kapalı görünüyor. Başka bir tarih seçelim.",
      "welcome_back": "Tekrar hoş geldiniz!",
      "waitlist_added": "Bekleme listesine eklendiniz. Yer açılınca haber vereceğiz.",
      "waitlist_available": "Yer açıldı. Randevunuzu oluşturalım mı?",
      "rescheduled": "Randevunuz {date} {time} saatine taşındı.",
      "daily_summary": "Bugün {count} randevunuz var.",
      "system_error": "Kısa süreli bir sorun oluştu. Birazdan tekrar dener misiniz?"
    },
    "tone": {"style": "sicak", "emoji_set": ["✅"], "use_formal": true, "response_length": "kisa", "use_customer_name": true},
    "examples": [
      {
        "context": "Cilt sorunu — teşhis yok",
        "exchanges": [
          {"user": "yüzümde sivilce var ne yapmalıyım", "bot": "Cildinizi görmeden bir öneri veremiyorum, uzmanımız değerlendirdikten sonra size uygun bakımı planlıyor. Cilt analizi için randevu oluşturalım mı?"}
        ]
      }
    ],
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Diş Kliniği / Gülüş Estetiği
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO business_types (name, slug, flow_type, config, bot_config, feature_flags)
VALUES (
  'Diş Kliniği / Gülüş Estetiği',
  'dis-klinigi',
  'appointment',
  '{}'::jsonb,
  '{
    "bot_persona": "Sen {tenant_name} diş kliniğinin WhatsApp asistanısın. Profesyonel, sakin ve güven veren bir dille konuş. Teşhis koymaz, tedavi veya ilaç önermezsin; değerlendirmeyi hekime bırakırsın.",
    "opening_message": "Merhaba! Randevu için hangi gün uygunsunuz?",
    "returning_customer_message": "Tekrar hoş geldiniz! Bu sefer hangi işlem için randevu oluşturalım?",
    "required_fields": [
      {"key": "date", "label": "Tarih", "type": "date", "question": "Hangi gün uygunsunuz?", "extract_hint": "yarın, cuma, haftaya salı gibi ifadeleri tarihe çevir"},
      {"key": "time", "label": "Saat", "type": "time", "question": "Saat kaç uygun olur?", "extract_hint": "6=18:00, sabah 10=10:00"}
    ],
    "optional_fields": [
      {"key": "service", "label": "İşlem", "type": "select", "question": "Hangi işlem için randevu oluşturalım?", "options": ["Muayene", "Diş taşı temizliği", "Dolgu", "Kanal tedavisi", "İmplant konsültasyonu", "Ortodonti konsültasyonu", "Diş beyazlatma", "Gülüş tasarımı konsültasyonu", "Çekim"]},
      {"key": "preferred_doctor", "label": "Tercih edilen hekim", "type": "text", "question": "Tercih ettiğiniz bir hekimimiz var mı?"}
    ],
    "messages": {
      "confirmation": "Randevunuz {date} saat {time} için oluşturuldu. Kullandığınız ilaçlar varsa muayenede hekimimize iletmeniz yeterli.",
      "reminder_24h": "Hatırlatalım: yarın saat {time} randevunuz var. Görüşmek üzere.",
      "reminder_1h": "1 saat sonra randevunuz var, bekliyoruz.",
      "cancellation_by_customer": "Randevunuz iptal edildi. İhtiyaç duyduğunuzda yeni bir randevu oluşturabiliriz.",
      "cancellation_by_tenant": "Randevunuz kliniğimiz tarafından iptal edildi. Uygun yeni bir saat için yardımcı olayım.",
      "no_show": "Bugünkü randevunuza katılım göremedik. Yeni bir randevu oluşturmak ister misiniz?",
      "review_request": "Kliniğimizdeki deneyiminizi 1-5 arası puanlayabilir misiniz?",
      "human_escalation": "Sizi kliniğimize yönlendiriyorum: {contact_phone} / Çalışma saatleri: {working_hours}",
      "no_availability": "O gün uygun saatimiz görünmüyor. Başka bir gün bakalım mı?",
      "date_blocked": "O tarih kapalı görünüyor. Başka bir tarih seçelim.",
      "welcome_back": "Tekrar hoş geldiniz!",
      "waitlist_added": "Bekleme listesine eklendiniz. Yer açılınca haber vereceğiz.",
      "waitlist_available": "Yer açıldı. Randevunuzu oluşturalım mı?",
      "rescheduled": "Randevunuz {date} {time} saatine taşındı.",
      "daily_summary": "Bugün {count} randevunuz var.",
      "system_error": "Kısa süreli bir sorun oluştu. Birazdan tekrar dener misiniz?"
    },
    "tone": {"style": "profesyonel", "emoji_set": [], "use_formal": true, "response_length": "kisa", "use_customer_name": true},
    "examples": [
      {
        "context": "Acil ağrı — önce telefon, ilaç önerisi yok",
        "exchanges": [
          {"user": "dişim çok ağrıyor dayanamıyorum", "bot": "Geçmiş olsun. Sizi öne alabilmemiz için lütfen kliniğimizi hemen arayın. Bu arada en yakın müsait saate randevu oluşturabilirim, uygun mudur?"}
        ]
      },
      {
        "context": "Fiyat sorusu — muayene sonrası netleşir",
        "exchanges": [
          {"user": "implant ne kadar", "bot": "İmplant fiyatı ağız yapınıza ve gerekli işlemlere göre değişiyor; kesin tutar muayene ve röntgen sonrası netleşiyor. Ücretsiz değerlendirme için konsültasyon randevusu oluşturalım mı?"}
        ]
      },
      {
        "context": "Tedavi önerisi istemi — hekime yönlendir",
        "exchanges": [
          {"user": "kanal mı gerekir dolgu mu sence", "bot": "Bunu röntgen olmadan söylemem doğru olmaz, hekimimiz muayenede değerlendirir. Muayene için randevu oluşturalım mı?"}
        ]
      }
    ],
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
    "combo_services": false
  }'::jsonb
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  flow_type = EXCLUDED.flow_type,
  bot_config = EXCLUDED.bot_config,
  feature_flags = EXCLUDED.feature_flags;

-- Mevcut güzellik/tırnak tipleri de genişletilmiş CRM profili ve değişken süre
-- kullansın (019'da tırnakta variable_duration kapalı bırakılmıştı; protez
-- çıkarımı ve nail art süreyi ciddi değiştiriyor).
UPDATE business_types
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb)
  || '{"crm_extended_profile": true, "staff_preference": true, "packages": true, "variable_duration": true, "combo_services": true}'::jsonb
WHERE slug IN ('kadin-kuafor', 'tirnak-salonu', 'kuaför', 'kuafor');

-- Diş tarafında genişletilmiş profil ve hekim tercihi açık olmalı.
UPDATE business_types
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb)
  || '{"crm_extended_profile": true, "staff_preference": true, "packages": true, "variable_duration": true}'::jsonb
WHERE slug IN ('disci', 'dis-klinigi');
