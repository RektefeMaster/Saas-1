# Ahi AI V3 Uygulama Planı (Detaylı)

## 1) Amaç ve Öncelik Sırası
Bu planın amacı, Ahi AI platformunu iki adımda risksiz büyütmektir:
1. Domain + mobil kullanım kusursuzluğu (ilk teslim)
2. WhatsApp çoklu işletme zekası + operasyonel modüller (fazlı teslim)

Öncelik kuralı:
- Önce stabilite ve doğruluk
- Sonra UX akıcılığı
- Sonra ileri AI otomasyonları

## 2) Bu İterasyonda Tamamlanan Kısım (Domain + Mobil Eşleşme)

### 2.1 Domain Standardizasyonu
Uygulama genelinde tek kanonik domain yaklaşımı:
- Varsayılan uygulama URL’si: `https://www.aiahi.net`
- Yardımcı katman: `src/lib/app-url.ts`
- Domain fallback’ları merkezi hale getirildi; sabit string dağınıklığı azaltıldı.

Güncellenen noktalar:
- `src/app/api/webhook/whatsapp/route.ts`
- `src/app/api/tenant/[id]/link/route.ts`
- `src/app/layout.tsx` (`metadataBase`)
- `.env.example` ve `README.md` (`NEXT_PUBLIC_APP_URL`)

### 2.2 Mobil Dashboard UX İyileştirmesi
İşletme paneli mobilde operasyonel hale getirildi:
- Alt sabit mobil menü (5 modül, aktif durum takibi)
- Mobilde hızlı aksiyonlar: WhatsApp linki + QR indirme
- İçerik alanında alt menü çakışmasını engelleyen güvenli padding
- Desktop sidebar davranışı korunarak responsive ayrıştırma

Güncellenen nokta:
- `src/app/dashboard/DashboardShell.tsx`

### 2.3 Tenant Başlangıç Eşleştirmesi Güçlendirmesi
- Görünmez marker (zero-width) kodlama/çözme eklendi
- Mesajdan tenant kodu çıkarma ve kullanıcıya görünmeyen temizlik eklendi
- Tenant geçişinde oturum temizleme + görsel ayraç mesajı eklendi

Güncellenen noktalar:
- `src/lib/zero-width.ts`
- `src/lib/tenant-code.ts`
- `src/app/api/webhook/whatsapp/route.ts`
- `src/utils/generateTenantAssets.ts`
- `src/app/t/[tenantId]/page.tsx`

### 2.4 Session Kilidi Süresi
- Numara -> tenant eşlemesi TTL: 30 güne çıkarıldı

Güncellenen nokta:
- `src/lib/redis.ts`

## 3) Kalan İşler İçin Fazlı Yol Haritası

## Faz 1: Çoklu İşletme Mesaj Motoru (Core Routing)
Amaç: Müşteri tek WhatsApp hattında doğru işletmeye sessiz ve doğru yönlensin.

### 1.1 Oturum Karar Motoru
- Kural sırası:
1. Mesajda görünmez marker varsa: kesin tenant
2. Yoksa aktif session tenant
3. NLP niyet + hizmet sözlüğü ile sessiz tenant düzeltmesi (75/25)
4. Hala belirsizse işletme listesi linki

Teslimler:
- `routing_decision` yardımcı servisi
- Tenant switch audit log tablosu (`tenant_switch_logs`)
- Session nedeni (`switch_reason`: marker/session/nlp/manual)

### 1.2 Niyet Bazlı Sessiz Geçiş
- NLP etiketleri: `hair`, `carwash`, `appointment`, `pricing`, `cancel`, `delay`
- İşletme hizmet sözlüğü eşleşmesi
- Yanlış eşleşmede fallback: “bu hizmet bu işletmede görünmüyor”

### 1.3 Arayüz İllüzyonu
- Tenant değişiminde tek seferlik görsel ayraç
- Flood koruması: aynı tenant için art arda ayraç gönderme yok

Kabul kriteri:
- 100 test mesajında yanlış tenant yönlendirme < %1

## Faz 2: Randevu Çekirdeği ve Çakışma Güvenliği
Amaç: Çifte rezervasyon ve hayalet slot sorunlarını sıfırlamak.

### 2.1 Race Condition Koruması
- Slot onayında kısa süreli lock (`appointment:lock:{tenant}:{date}:{time}`)
- Lock TTL: 180 saniye
- Lock çatışmasında alternatif slot önerisi

### 2.2 Sepetleme / Geçici Rezerv
- “Onay bekliyor” statüsü
- Müşteri onayı gelmezse slot otomatik boşaltma

### 2.3 Hizmet Süresi Uyumlu Slot Hesabı
- LLM saat hesaplamaz
- Backend yalnızca kesintisiz uygun slotları hesaplar
- LLM sadece verilen slot listesinden seçim yaptırır

Kabul kriteri:
- Aynı slotta çift onay oluşmaması
- 30/60/120 dk hizmetlerde çakışma olmaması

## Faz 3: İptal / Gecikme / No-show Operasyonları
Amaç: günlük iş akışını bozan durumları otomatik yönetmek.

### 3.1 Negatif Niyet Sınıflandırması
- İptal niyeti: “iptal”, “gelemeyeceğim”, “işim çıktı”, “yetişemiyorum”
- Function call: `randevu_iptal`

### 3.2 Gecikme Politikası
- `delay_tolerance_minutes` tenant ayarı
- Gecikme algılanınca panelde kırmızı bildirim
- Müşteriye net beklenti mesajı

### 3.3 No-show Takibi
- Belirlenen gecikme eşiği aşılırsa no-show adayı
- CRM kartına otomatik işlenir

Kabul kriteri:
- İptal edilen slotun anında tekrar müsait olması
- Gecikme olaylarının panelde görünmesi

## Faz 4: Fiyat, Pazarlık ve Güvenli Cevap Politikası
Amaç: Halüsinasyonsuz, kontrollü ama samimi satış konuşması.

### 4.1 Katı Hizmet/Fiyat Sınırı
- Bot yalnızca DB’deki aktif hizmetleri konuşur
- Fiyatsız hizmette fallback: “Fiyat için arayın + telefon”

### 4.2 Pazarlık Yönetimi
Tenant ayarı:
- Mod A: `max_discount_percent`
- Mod B: `escalate_to_owner`

### 4.3 Fiyat Değişikliği Güvenliği
- Fiyat güncelleme sonrası cache invalidation
- Son fiyat güncelleme zamanı panelde görünür

Kabul kriteri:
- DB dışı hizmet/fiyat cevabı üretmemesi
- Pazarlık politikasına %100 uyum

## Faz 5: WhatsApp Kural Uyumları ve Medya
Amaç: Meta kısıtlarına tam uyum ve kullanıcı alışkanlığına uygun iletişim.

### 5.1 24 Saat Pencere Yönetimi
- 24 saat sonrası yalnız template mesaj
- Onaylı template seti:
1. Randevu hatırlatma
2. İptal sonrası boşalan slot bildirimi
3. Onay takip

### 5.2 Sesli Mesaj Desteği
- Webhook `audio` tespiti
- Whisper ile STT
- Metin gibi işlenip cevap üretilmesi

### 5.3 Denial-of-Wallet Koruması
- Rate limiting (mesaj/saat)
- Randevuya dönüşmeyen yoğun sohbette fren modu

Kabul kriteri:
- 24 saat kuralı ihlali olmaması
- Sesli mesajların > %95 başarıyla metne dönmesi

## Faz 6: AI Maliyet/Performans Mimarisi (LLMOps)
Amaç: Maliyeti düşürürken kaliteyi korumak.

### 6.1 Model Routing
- Çırak model: `gpt-4o-mini`
- Usta model: `gpt-4o`
- Complexity classifier ile otomatik yönlendirme

### 6.2 Dinamik RAG
- Mesaj niyetine göre dar veri enjeksiyonu
- Gereksiz fiyat listesi/context taşınmaz

### 6.3 Context Compression
- Son 2 mesaj + state özeti
- Tam geçmiş yerine özet state kullanımı

### 6.4 Function Calling Zorunluluğu
- Randevu, iptal, gecikme, reminder işlemleri JSON tool-call
- Serbest metinden veri parse edilmez

### 6.5 Prompt Yapısı
- XML/etiketli sistem prompt
- Ton, sınır, menü dışı davranış net kurallarla sabit

Kabul kriteri:
- Token maliyetinde hedef: ilk faza göre en az %50 düşüş
- Kritik işlemlerde JSON doğruluk oranı > %99

## 4) Veri Modeli Planı

## 4.1 Yeni / Genişleyen Tablolar
- `phone_tenant_sessions` (opsiyonel, Redis yanında kalıcı analiz için)
- `tenant_switch_logs`
- `appointment_locks` (Redis ana, DB audit opsiyonel)
- `crm_customers`, `crm_notes`, `crm_reminders` (mevcutsa genişletme)

## 4.2 Önerilen Alanlar
- `tenants.owner_phone_e164`
- `tenants.security_config` JSONB
- `tenants.ui_preferences` JSONB
- `tenants.pricing_preferences` JSONB
- `services.duration_minutes`, `is_active`, `price_visible`, `display_order`

## 4.3 İndeksler
- `appointments (tenant_id, starts_at)`
- `crm_customers (tenant_id, phone)` unique
- `crm_reminders (tenant_id, remind_at)`

## 5) API Planı (Hedef)

## 5.1 Core
- `GET/POST /api/tenant/:id/services`
- `PATCH/DELETE /api/tenant/:id/services/:serviceId`
- `GET /api/tenant/:id/workflow?date=YYYY-MM-DD`
- `PATCH /api/tenant/:id/appointments/:appointmentId/status`

## 5.2 CRM
- `GET /api/tenant/:id/crm/customers`
- `GET/PATCH /api/tenant/:id/crm/customers/:phone`
- `POST /api/tenant/:id/crm/customers/:phone/notes`
- `GET/POST/PATCH /api/tenant/:id/crm/reminders`

## 5.3 Auth/Security
- OTP başlat/doğrula akışlarının tenant-owner username ile birleştirilmesi
- Admin hidden giriş + OTP zorunluluğunun devamı

## 6) UI/UX Planı (Desktop + Mobile)

## 6.1 Tasarım Sistemi
- Renk, spacing, radius, shadow token seti
- Tipografi çift font yaklaşımı (başlık/gövde)
- Erişilebilir odak halkası standardı

## 6.2 İşletme Paneli
- Özet
- Takvim
- Fiyat Listesi
- İş Akışı (Kanban)
- CRM Defteri
- Ayarlar

## 6.3 Mobil İlkeleri
- Alt sabit menü
- Kritik CTA’lar başta
- Tek elle kullanım için 44px+ hit area
- Yatay taşmaları engelleyen layout kuralları

## 7) Test Planı

## 7.1 Otomasyon
- Unit: tenant routing, slot hesap, intent classifier
- Integration: webhook -> routing -> AI -> DB
- E2E: randevu alma/iptal/gecikme/pazarlık

## 7.2 Kritik Senaryolar
1. Aynı slota iki müşteri aynı anda onay
2. Gece yarısı “yarın” ifadesi
3. İptal niyeti dolaylı cümleyle
4. Fiyatsız hizmet fallback
5. 24 saat dışında template zorunluluğu
6. Voice note -> STT -> randevu

## 8) Rollout Stratejisi

Feature flag’ler:
- `ENABLE_DASHBOARD_V2`
- `ENABLE_SMS_2FA`
- `ENABLE_CRM_MODULE`
- `ENABLE_ADVANCED_ROUTING`
- `ENABLE_VOICE_NOTES`

Sıra:
1. Staging migration + smoke test
2. Sınırlı tenant pilotu
3. Üretimde kademeli açılış
4. Metrik izleme + geri dönüş planı

## 9) İzleme ve KPI
- Login başarı oranı
- OTP doğrulama başarı/ret oranı
- Slot çakışma sayısı
- AI maliyet / tenant
- Mesajdan randevuya dönüşüm oranı
- Mobilde görev tamamlama süresi

## 10) Uygulama Takvimi (Öneri)
- Hafta 1: Faz 1
- Hafta 2: Faz 2
- Hafta 3: Faz 3 + Faz 4
- Hafta 4: Faz 5 + Faz 6 + performans/sertleştirme

Her hafta sonunda:
- Canlıya alınabilir parça teslim
- Geriye dönük kırılma testi
- Maliyet ve kalite raporu
