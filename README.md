# Ahi AI

WhatsApp üzerinden çalışan, yapay zeka destekli çok kiracılı randevu SaaS sistemi.

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Ortam Değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun:

```bash
cp .env.example .env
```

**Admin paneli:** `ADMIN_PASSWORD` (min 8 karakter) ve `ADMIN_SESSION_SECRET` (min 32 karakter, örn. `openssl rand -base64 32`) ayarlayın. Şifreyi mutlaka değiştirin.
**İşletme paneli:** giriş modeli `kullanıcı adı + şifre`dir.
**Gizli admin girişi:** işletme login ekranında `ADMIN_HIDDEN_LOGIN_IDENTIFIER` + `ADMIN_PASSWORD` ile admin oturumu açılabilir (publicte admin butonu yoktur).
**Domain ayarı:** `NEXT_PUBLIC_APP_URL=https://www.aiahi.net` olacak şekilde üretim domaininizi `.env` içine yazın.
**SMS 2FA:** `ENABLE_SMS_2FA=true` yapmadan önce `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `ADMIN_2FA_PHONE_E164` değerlerini geçerli şekilde doldurun.
**Bilgi SMS'leri:** Twilio numarası ile müşteri bilgilendirme için `TWILIO_SMS_FROM_E164`, `ENABLE_INFO_SMS` ve `INFO_SMS_MODE` (`fallback` veya `always`) ayarlarını kullanın.
**Sesli mesaj (STT):** WhatsApp sesli mesajlarını metne çevirmek için `OPENAI_STT_MODEL` (`whisper-1`) kullanılmaktadır.
**Template reminder:** 24 saat sonrası WhatsApp hatırlatma template'i için `WHATSAPP_REMINDER_TEMPLATE_NAME` ve `WHATSAPP_TEMPLATE_LANG` ayarlanabilir.

### 3. Supabase

1. [Supabase](https://supabase.com) projesi oluşturun
2. `supabase/migrations/001_initial_schema.sql` dosyasını SQL Editor'da çalıştırın
3. İsteğe bağlı: `002_enable_realtime.sql` ile Realtime'ı etkinleştirin (Dashboard > Database > Replication)
4. `.env` dosyasına `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` ekleyin
5. Eski kurulumlarda Dashboard V2 alanları eksikse `010_dashboard_v2_crm_otp.sql` ve `011_schema_backfill_dashboard_v2.sql` migrationlarını da çalıştırın
6. Kullanıcı adıyla giriş için `012_owner_username_login.sql` migrationını çalıştırın
7. Faz 1 routing audit log için `013_tenant_switch_logs.sql` migrationını çalıştırın
8. Faz 3 operasyon uyarıları için `014_ops_alerts.sql` migrationını çalıştırın

### 4. WhatsApp (Meta Cloud API)

1. [Meta for Developers](https://developers.facebook.com) hesabı oluşturun
2. WhatsApp ürününü ekleyin, Business hesabı bağlayın
3. Telefon numarası alın (test veya production)
4. Webhook URL: `https://your-domain.com/api/webhook/whatsapp`
5. Verify Token: `.env` içindeki `WHATSAPP_VERIFY_TOKEN`
6. `WHATSAPP_PHONE_NUMBER_ID` ve `WHATSAPP_ACCESS_TOKEN` ekleyin
7. `WHATSAPP_WEBHOOK_SECRET` değeri Meta App Secret ile aynı olmalı (imza doğrulama için)
8. Test numara kullanıyorsanız mesaj gönderen telefonları Meta API Setup > Allowed recipients listesine ekleyin
9. App Secret ile eşleşme doğrulanana kadar `WHATSAPP_STRICT_SIGNATURE=false` kullanabilirsiniz (geçici). Eşleşme tamamlanınca `true` yapın.

### 5. Redis (Opsiyonel)

[Upstash Redis](https://upstash.com) ile session storage. Opsiyonel; yoksa in-memory fallback kullanılır.

### 6. Çalıştırma

```bash
npm run dev
```

## Yapı

- `/admin` - Süper Admin paneli (işletme tipleri, kiracılar)
- `/admin/tenants/new` - Adım adım işletme oluşturma sihirbazı
- `/admin/security` - SMS 2FA/Twilio konfigürasyon görünümü
- `/dashboard/[tenantId]` - İşletme paneli (özet + takvim)
- `/dashboard/[tenantId]/pricing` - Fiyat listesi modülü
- `/dashboard/[tenantId]/workflow` - Durum bazlı iş akışı
- `/dashboard/[tenantId]/crm` - CRM defteri ve hatırlatmalar
- `/dashboard/[tenantId]/settings` - Kişiselleştirme/iletişim ayarları
- `/t/[tenantId]` - WhatsApp'a yönlendiren kısa link
- `/api/webhook/whatsapp` - WhatsApp webhook (GET: doğrulama, POST: mesajlar)
- `/api/webhook/twilio/sms` - Twilio SMS webhook (bilgi amaçlı)
- `/api/webhook/twilio/voice` - Twilio Voice webhook
- `/api/tenant/[id]/appointments/hold` - Slotu geçici kilitleme (3 dk sepet)
- `/api/tenant/[id]/ops-alerts` - Operasyon uyarıları (delay / cancellation / no-show)
- `/api/cron/reminders` - 24 saat önce randevu hatırlatma (cron)
- `/api/debug/env-check` - Çalışma ortamı değişken kontrolü
- `/api/debug/whatsapp-health` - WhatsApp token/phone-id canlı sağlık kontrolü

## Üretim Notları (WhatsApp)

1. `WHATSAPP_ACCESS_TOKEN` geçerli ve süresi dolmamış olmalı.
2. Meta Webhook Callback URL doğrudan çalışan production URL olmalı: `https://<domain>/api/webhook/whatsapp`
   Önemli: `https://aiahi.net` -> `https://www.aiahi.net` gibi redirect varsa Meta POST istekleri başarısız olabilir. Callback URL'i redirectsiz nihai host (`https://www.aiahi.net/api/webhook/whatsapp`) olarak girin.
3. Vercel Deployment Protection açıksa Meta webhook istekleri 401 alır; webhook endpointi dış dünyaya açık olmalıdır.

## Cron

Vercel'de `vercel.json` ile günde bir kez (sabah 8) hatırlatma gönderilir. Alternatif: Kendi cron servisinizle `GET /api/cron/reminders?key=CRON_SECRET` çağrısı yapın.
