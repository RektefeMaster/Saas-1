# OTP, Mesaj Gönderme ve Kampanya SMS – Durum Özeti

**Doğrulama:** Bu dokümandaki akışlar kod üzerinde satır satır takip edilerek doğrulanmıştır (otp-auth, twilio, redis, notify, sms, ilgili API route’lar ve cron).

---

## 1. OTP (SMS Doğrulama)

### Ne var?
- **İki kullanım yeri:**
  1. **Admin panel girişi** (`/admin/login`): Gizli admin şifre doğrulandıktan sonra, `ENABLE_SMS_2FA=true` ise `ADMIN_2FA_PHONE_E164` numarasına Twilio Verify ile OTP gönderilir. Kod `/api/admin/auth/hidden` → `sendSmsVerification(adminPhone)` → kullanıcı `/admin/login` OTP ekranında kodu girer → `/api/admin/auth/verify` ile `verifySmsCode` çağrılır.
  2. **Dashboard (işletme) girişi** (`/dashboard/login`): Supabase ile giriş sonrası, `ENABLE_SMS_2FA=true` ve tenant’ta `sms_2fa_enabled !== false` ise tenant’ın `owner_phone_e164` veya `contact_phone` numarasına OTP gönderilir. Akış: `/api/dashboard/auth/otp/start` → `sendSmsVerification(phone)` → kullanıcı `/dashboard/login/verify` sayfasında kodu girer → `/api/dashboard/auth/otp/verify` ile doğrulanır.

- **Teknik:** Twilio **Verify API** kullanılıyor (`/v2/Services/{Sid}/Verifications` ve `VerificationCheck`). Kod gönderme ve doğrulama tamamen Twilio’da; uygulama sadece API çağrısı yapıyor.

### Açma kapama
- **Env:** `ENABLE_SMS_2FA=true` (ör. `.env`) → OTP açık. Kontrol: `otp-auth.ts` → `isSms2faEnabledFlag()` → `process.env.ENABLE_SMS_2FA` (true/1/yes/on).
- **Admin:** `ENABLE_SMS_2FA=false` veya Twilio Verify ayarları eksik/hatalı → admin OTP atlanır, sadece şifre ile giriş. Admin verify route’ta 2FA kapalıyken body’de `password` gönderilerek OTP adımı atlanıp cookie set edilebiliyor.
- **Dashboard:** `ENABLE_SMS_2FA=false` veya tenant’ta `security_config.sms_2fa_enabled === false` (`otp/start` satır 71) → dashboard OTP atlanır, `requires_otp: false` döner.

### Gerekli env (OTP için)
| Değişken | Açıklama |
|----------|----------|
| `ENABLE_SMS_2FA` | `true` ise SMS 2FA kullanılır. |
| `TWILIO_ACCOUNT_SID` | Twilio hesap SID (AC...) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_VERIFY_SERVICE_SID` | Verify servis SID (VA...) |
| `ADMIN_2FA_PHONE_E164` | Sadece admin OTP için; kodun gideceği numara (E.164). |

Dashboard OTP için ek olarak tenant’ta `owner_phone_e164` veya `contact_phone` (E.164) dolu olmalı.

### Kontrol
- **Debug:** `/api/debug/env-check` (yetki gerekir) → `SMS_2FA_FLAG`, `TWILIO_VERIFY_READY` vb. gösterir.
- **Admin Security sayfası:** `/admin/.../security` → 2FA ve bilgi SMS durumu özetlenir.

---

## 2. Bilgi / İşlemsel Mesaj Gönderme (WhatsApp + SMS)

### Ne var?
- **Ortak katman:** `sendCustomerNotification(to, text)` (`src/lib/notify.ts`):
  - Her zaman önce **WhatsApp** ile gönderir (`sendWhatsAppMessage`).
  - **SMS:** Sadece `ENABLE_INFO_SMS=true` ise devreye girer; iki mod:
    - `INFO_SMS_MODE=always` → Her bildirimde hem WhatsApp hem SMS.
    - `INFO_SMS_MODE=fallback` (varsayılan) → Sadece WhatsApp başarısızsa SMS gönderilir.

- **SMS gönderimi:** `sendInfoSms(to, body)` (`src/lib/sms.ts`) → Twilio **Messages API** (`/2010-04-01/Accounts/.../Messages.json`). Gönderici numara: `TWILIO_SMS_FROM_E164` veya `TWILIO_PHONE_NUMBER`.

### Kullanıldığı yerler (kodda teyit edildi)
| Yer | Ne zaman | Kanal |
|-----|----------|--------|
| **Cron randevu hatırlatması** (`/api/cron/reminders`) | Yarınki randevular için | Önce WhatsApp template; yoksa `sendCustomerNotification` (WA + isteğe SMS) |
| **Cron CRM hatırlatmaları** (aynı cron) | `crm_reminders` tablosu, `channel in ('whatsapp','both')` | `sendCustomerNotification` |
| **Cron inceleme hatırlatması** (`/api/cron/review-reminder`) | Geçmiş randevu sonrası inceleme isteği | **Sadece WhatsApp** (`sendWhatsAppMessage`), SMS yok |
| **Toplu iptal** (`/api/tenant/[id]/bulk-cancel`) | Seçilen günün randevuları iptal edilince müşterilere bilgi | `sendCustomerNotification` (her numaraya tek tek) |
| **Tekil iptal** (`cancellation.service.ts` → `cancelAppointment`) | Müşteri/panel tek randevu iptal ettiğinde | `sendCustomerNotification` |

Yani “kampanya” adı altında ayrı bir modül yok; tüm müşteri bildirimleri bu işlemsel (randevu/iptal/hatırlatma) akışlardan gidiyor.

### Açma kapama (bilgi SMS)
- **Env:** `ENABLE_INFO_SMS=true` → SMS kullanılabilir.
- **Gönderici:** `TWILIO_SMS_FROM_E164` veya `TWILIO_PHONE_NUMBER` dolu ve Twilio’da doğrulanmış olmalı (yoksa `sendInfoSms` config hatası verir, false döner).

### Gerekli env (bilgi SMS için)
| Değişken | Açıklama |
|----------|----------|
| `ENABLE_INFO_SMS` | `true` ise bilgi SMS’leri açık. |
| `INFO_SMS_MODE` | `always` veya `fallback` (varsayılan: `fallback`). |
| `TWILIO_ACCOUNT_SID` | Twilio hesap SID. |
| `TWILIO_AUTH_TOKEN` | Twilio auth token. |
| `TWILIO_SMS_FROM_E164` veya `TWILIO_PHONE_NUMBER` | SMS gönderici numarası (E.164). |

`.env.example` içinde `TWILIO_PHONE_NUMBER` yok; sadece `TWILIO_SMS_FROM_E164` var. Kodda ikisi de destekleniyor.

---

## 3. Kampanya SMS

### Durum
- Projede **“kampanya SMS”** veya **toplu pazarlama SMS** diye ayrı bir özellik **yok**.
- Toplu gönderim sadece **işlemsel** senaryolarda:
  - Randevu hatırlatması (cron),
  - Toplu iptal bildirimi (bulk-cancel),
  - CRM hatırlatmaları,
  - İnceleme hatırlatması.

Hepsi mevcut `sendCustomerNotification` (WhatsApp + isteğe bağlı SMS) ile yapılıyor; ayrı bir kampanya listesi, şablon yönetimi veya “kampanya sms” API’si tanımlı değil.

---

## 4. Twilio Webhook (SMS gelen)

- **Route:** `src/app/api/webhook/twilio/sms/route.ts`
- **Davranış:** Gelen SMS’i logluyor; yanıt olarak boş TwiML döndürüyor (`<Response></Response>`). Yani gelen SMS’e otomatik cevap veya iş mantığı yok; sadece kayıt için.

---

## 5. Özet Tablo

| Özellik | Var mı? | Açma | Not |
|--------|---------|------|-----|
| Admin OTP (SMS 2FA) | Evet | `ENABLE_SMS_2FA=true` + Twilio Verify + `ADMIN_2FA_PHONE_E164` | Twilio Verify API. |
| Dashboard OTP (SMS 2FA) | Evet | `ENABLE_SMS_2FA=true` + tenant’ta `owner_phone_e164`/`contact_phone` | Tenant bazlı kapatma: `security_config.sms_2fa_enabled: false`. |
| Bilgi SMS (hatırlatma, iptal vb.) | Evet | `ENABLE_INFO_SMS=true` + `TWILIO_SMS_FROM_E164` (veya `TWILIO_PHONE_NUMBER`) | Twilio Messages API; `INFO_SMS_MODE`: always / fallback. |
| Kampanya mesajları (admin) | Evet | Admin panel → Kampanya Mesajları | WhatsApp + SMS; CRM/randevu müşterileri veya özel liste. |
| Twilio SMS webhook | Evet | Twilio’da webhook URL’i bu route’a yönlendirilir | Sadece log; otomatik yanıt yok. |

---

## 6. Kod Akışı Özeti (Doğrulandı)

- **Admin OTP:** `POST /api/admin/auth/hidden` (identifier + password) → `isSms2faEnabledFlag()` (otp-auth) → true ise `getTwilioVerifyStatus()` (twilio), `ADMIN_2FA_PHONE_E164` → `sendSmsVerification(adminPhone)` (Twilio Verify API) → `setOtpChallenge(scope: "admin")` (Redis/memory) → cevap `requires_otp: true, challenge_id`. Doğrulama: `POST /api/admin/auth/verify` → `getOtpChallenge` → `verifySmsCode(phone, code)` (Twilio VerificationCheck) → cookie.
- **Dashboard OTP:** Supabase signIn sonrası `POST /api/dashboard/auth/otp/start` → `isSms2faEnabledFlag()` → tenant (user_id eşleşen), `security_config.sms_2fa_enabled !== false`, `owner_phone_e164` veya `contact_phone` → `sendSmsVerification(phone)` → `setOtpChallenge(scope: "dashboard", user_id)` → cevap `requires_otp: true, challenge_id`. Doğrulama: `POST /api/dashboard/auth/otp/verify` → challenge.scope === "dashboard" ve challenge.user_id === user.id → `verifySmsCode` → DASHBOARD_OTP_COOKIE.
- **Bilgi SMS:** `sendCustomerNotification` (notify.ts) → önce `sendWhatsAppMessage`, sonra `isInfoSmsEnabled()` (sms.ts, `ENABLE_INFO_SMS`) → true ise `INFO_SMS_MODE`: always → her zaman `sendInfoSms`; fallback → sadece WhatsApp başarısızsa `sendInfoSms`. `sendInfoSms` → Twilio Messages API, From: `TWILIO_SMS_FROM_E164` veya `TWILIO_PHONE_NUMBER`.

---

## 7. Kontrol Listesi (Canlı Ortam)

1. **OTP kullanacaksanız**
   - [ ] `ENABLE_SMS_2FA=true`
   - [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` doğru ve geçerli
   - [ ] Admin için: `ADMIN_2FA_PHONE_E164` E.164 formatında
   - [ ] Dashboard için: Tenant’larda `owner_phone_e164` veya `contact_phone` dolu

2. **Bilgi SMS (hatırlatma/iptal) kullanacaksanız**
   - [ ] `ENABLE_INFO_SMS=true`
   - [ ] `TWILIO_SMS_FROM_E164` (veya `TWILIO_PHONE_NUMBER`) Twilio’da doğrulanmış numara
   - [ ] `INFO_SMS_MODE=fallback` veya `always` (ihtiyaca göre)

3. **Kampanya SMS**
   - Şu an böyle bir özellik yok; ihtiyaç olursa ayrı tasarım ve geliştirme gerekir (liste, şablon, izin, rate limit vb.).

4. **İnceleme hatırlatması**
   - `review-reminder` cron’u sadece WhatsApp kullanıyor; SMS fallback yok. İstenirse burada da `sendCustomerNotification` kullanılabilir.
