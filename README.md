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

### 3. Supabase

1. [Supabase](https://supabase.com) projesi oluşturun
2. `supabase/migrations/001_initial_schema.sql` dosyasını SQL Editor'da çalıştırın
3. İsteğe bağlı: `002_enable_realtime.sql` ile Realtime'ı etkinleştirin (Dashboard > Database > Replication)
4. `.env` dosyasına `NEXT_PUBLIC_SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` ekleyin

### 4. WhatsApp (Meta Cloud API)

1. [Meta for Developers](https://developers.facebook.com) hesabı oluşturun
2. WhatsApp ürününü ekleyin, Business hesabı bağlayın
3. Telefon numarası alın (test veya production)
4. Webhook URL: `https://your-domain.com/api/webhook/whatsapp`
5. Verify Token: `.env` içindeki `WHATSAPP_VERIFY_TOKEN`
6. `WHATSAPP_PHONE_NUMBER_ID` ve `WHATSAPP_ACCESS_TOKEN` ekleyin

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
- `/api/cron/reminders` - 24 saat önce randevu hatırlatma (cron)

## Cron

Vercel'de `vercel.json` ile günde bir kez (sabah 8) hatırlatma gönderilir. Alternatif: Kendi cron servisinizle `GET /api/cron/reminders?key=CRON_SECRET` çağrısı yapın.
