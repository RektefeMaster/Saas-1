# Ahi AI — Birleşik Dokümantasyon

Bu belge, SaaSRandevu (Ahi AI) projesinin tüm dokümantasyonunu tek dosyada toplar: Master Plan, Mimari, Admin Kullanım, Kütüphaneler, OTP/SMS, Token Mimarisi, CRM Strateji ve Rekabet Analizi.

---

## İçindekiler

1. [Master Plan ve Roadmap](#1-master-plan-ve-roadmap)
2. [Mimari](#2-mimari)
3. [Sistem Kontrol ve Durum](#3-sistem-kontrol-ve-durum)
4. [Admin Panel Kullanım](#4-admin-panel-kullanım)
5. [Kütüphaneler](#5-kütüphaneler)
6. [OTP, SMS ve Kampanya](#6-otp-sms-ve-kampanya)
7. [Token Mimarisi ve Bot Kontrol](#7-token-mimarisi-ve-bot-kontrol)
8. [V3 Roadmap Özeti](#8-v3-roadmap-özeti)
9. [CRM Strateji ve Rekabet Analizi](#9-crm-strateji-ve-rekabet-analizi)

---

# 1. Master Plan ve Roadmap

## 1.1 Yönetici Özeti

- Plan **yapılabilir**.
- Mevcut repo durumuna göre en büyük boşluk admin tarafındaydı; önemli modüller teslim edildi.
- Platform çekirdeğinde kritik kazanımlar mevcut:
  - Çoklu tenant routing (marker/name/session/history/nlp/default)
  - Tenant switch log altyapısı
  - Booking lock + hold (race condition koruması)
  - Voice STT (sesli mesaj transcribe)
  - 24 saat pencere/template toparlama akışı
  - Model routing (mini vs complex)
- İcra stratejisi:
  - Önce **operasyonel emniyet + kontrol**
  - Sonra **admin hızlı işlemler**
  - Sonra **gözlemlenebilirlik + canlı müdahale**
  - Sonra **ileri analitik ve otomasyon**

## 1.2 Kod Tablosuna Göre Durum

### Tamamlanan / Güçlü Olanlar
1. Domain standardizasyonu ve URL yardımcısı
2. Mobil dashboard shell iyileştirmeleri
3. Tenant routing ve switch reason akışı
4. Session/phone-tenant mapping TTL (30 gün)
5. Booking lock/hold + slot çakışma koruması
6. STT ile sesli mesaj işlemi
7. 24 saat pencere kontrolü ve template recovery
8. Bot tarafında deterministic cancel/late niyetleri
9. Admin temel dashboard + tenant CRUD + kampanya sayfaları
10. Langfuse gözlem sayfası ve API bağlantısı

### Kısmen Hazır Olanlar
1. Pazarlık/abuse niyetleri botta algılanıyor; admin canlı müdahale paneli var
2. Rate limiting var; global kill switch teslim edildi
3. CRM tabloları var; Time Machine için conversation_messages tablosu mevcut
4. Playwright testleri var; admin tetiklemeli QA orkestrasyonu beklemede

### Bekleyen Fazlar
- Faz 5: Live Logs (SSE), Visual Brain
- Faz 6: Profitability radar
- Faz 7: run-qa endpoint + cron

## 1.3 Fazlı Uygulama Planı

| Faz | Hedef | Durum |
|-----|-------|-------|
| **Faz 0** | Baseline ve emniyet | Tamamlandı |
| **Faz 1** | Kill Switch (Redis + API + Admin UI + Worker) | Tamamlandı |
| **Faz 2** | Quick Add, Extend Subscription, Magic Link | Başlatıldı |
| **Faz 3** | Time Machine, conversation_messages, sentry-issues | Tamamlandı |
| **Faz 4** | Riskli konuşmalar, takeover/send/resume | Başlatıldı |
| **Faz 5** | live-logs SSE, live-steps, Visual Brain | Beklemede |
| **Faz 6** | Profitability endpoint, Cüzdan Radarı | Beklemede |
| **Faz 7** | run-qa endpoint, Rollout checklist | Beklemede |

## 1.4 API Revizyonu

### Mevcut API'ler
- `GET/POST /api/admin/tools/kill-switch`
- `POST /api/admin/tenants/quick`
- `POST /api/admin/tenants/[id]/extend-subscription`
- `POST /api/admin/tenants/[id]/magic-link`
- `GET /api/admin/tools/time-machine`
- `GET /api/admin/tools/sentry-issues`
- `GET /api/admin/conversations/risky`
- `POST /api/admin/conversations/takeover`
- `POST /api/admin/conversations/send`
- `POST /api/admin/conversations/resume`

### Bekleyen API'ler
- `GET /api/admin/tools/live-logs` (SSE)
- `GET /api/admin/conversations/live-steps`
- `GET /api/admin/tools/profitability`
- `POST /api/admin/tools/run-qa`

## 1.5 Veri Modeli

**Mevcut tablolar:** `tenant_switch_logs`, `phone_tenant_mappings`, `crm_customers`, `crm_notes`, `crm_reminders`, Redis lock/hold anahtarları

**Migrations:** 027 (subscription alanları), 028 (magic_links), 029 (conversation_messages)

## 1.6 Riskler ve Karşılıkları
- Redis yoksa kill switch → memory fallback + UI warning
- Migration drift → migration gate checklist
- Time Machine veri hacmi → retention policy + index
- Admin müdahale suistimali → event log + role check

---

# 2. Mimari

## 2.1 Genel Mimari

- **Stack:** Next.js (App Router), Supabase (PostgreSQL + Realtime), Upstash Redis, OpenAI, Meta WhatsApp Cloud API
- **Kiracı modeli:** Her esnaf bir `tenant`; `tenant_code` (örn. AHMET01) ile QR/link üzerinden tanımlanır
- **Akış:** Müşteri WhatsApp → webhook → tenant çözümü → AI konuşma → randevu oluşturma/iptal

## 2.2 İnsan Yönlendirme (Human Escalation)

**Genel kural:** Sıkışma, hata veya belirsiz durumda müşteriyi gerçek kişiye yönlendir.

**Mesaj formatı:**
```
Üzgünüm, bu konuda size yardımcı olamıyorum.
Lütfen işletmemizle doğrudan iletişime geçin: {tenant.contact_phone}
Çalışma saatleri: {tenant.working_hours_text}
```

**Tetikleyiciler:** AI 2 kez yanlış anlarsa, insan talebi, desteklenmeyen istek, sistem hatası, 10+ mesaj randevu tamamlanmamışsa

## 2.3 Güvenlik

| Konu | Açıklama |
|------|----------|
| **Webhook imza** | `x-hub-signature-256` ile HMAC-SHA256 doğrulama; `WHATSAPP_WEBHOOK_SECRET` |
| **Rate limiting** | 1 dakikada en fazla 15 mesaj; Redis `ratelimit:{phone}` |
| **Tenant izolasyonu** | Her sorguda `tenant_id` zorunlu; uyumsuzlukta 403 |
| **Env** | Hassas değerler sadece `.env` üzerinden |

## 2.4 Dosya Referansları

| Konu | Dosya |
|------|-------|
| Webhook imza | `src/middleware/webhookVerify.middleware.ts` |
| Rate limiting | `src/middleware/rateLimit.middleware.ts` |
| Tenant kapsamı | `src/middleware/tenantScope.middleware.ts` |
| Ortam değişkenleri | `.env.example` |

---

# 3. Sistem Kontrol ve Durum

## 3.1 Çalışan Bileşenler

### Grafikler
- **ChartBar** (`src/components/charts/ChartBar.tsx`) – Recharts ile bar grafik
- **ChartCard** (`src/components/charts/ChartCard.tsx`) – Grafik kart wrapper
- **Kullanım:** Admin Dashboard, Langfuse, Tenant Dashboard

### WhatsApp Konuşmalar
- `/api/admin/conversations/list`, `/messages`, `/takeover`, `/send`, `/resume`, `/risky`
- `/admin/conversations` – Liste, mesaj görünümü, takeover, manuel mesaj
- Worker: Takeover sırasında `conversation_messages` tablosuna loglama

### Kütüphaneler
| Kütüphane | Durum |
|-----------|-------|
| recharts | ✅ Aktif (ChartBar) |
| react-intersection-observer | ✅ Aktif (lazy loading) |
| @tremor/react | ⚠️ Kullanılmıyor, kaldırılabilir |

## 3.2 API Kontrol Listesi
- [x] `/api/admin/conversations/list` – GET
- [x] `/api/admin/conversations/messages` – GET
- [x] `/api/admin/conversations/takeover` – POST
- [x] `/api/admin/conversations/send` – POST
- [x] `/api/admin/conversations/resume` – POST
- [x] `/api/admin/conversations/risky` – GET

## 3.3 Notlar
- `next.config.ts`: `typescript: { ignoreBuildErrors: true }` – Production öncesi kaldırılmalı
- `@tremor/react`: `npm uninstall @tremor/react` ile kaldırılabilir
- `.next/lock` çakışmasında: `rm .next/lock`

---

# 4. Admin Panel Kullanım

## 4.1 Hızlı Başlangıç

### ⌘K / Ctrl+K — Komut Paleti
- İşletme ara: İsim veya tenant kodu ile detay sayfasına git
- Sayfa ara: "Kampanyalar", "Araçlar" vb.

### Quick Add — 60 Saniyede İşletme
1. İşletmeler sayfası → **Quick Add** butonu
2. İşletme adı, işletme tipi, sahip telefonu (E.164)
3. **Oluştur** → Otomatik tenant kodu, kullanıcı adı, geçici şifre

### Satır İşlemleri (İşletmeler Tablosu)
| Buton | Açıklama |
|-------|----------|
| Giriş Yap | İşletme dashboard'una geç |
| +1 Hafta / +1 Ay | Aboneliği uzat |
| Limit (⚡) | Aylık mesaj kotası |
| Botu Durdur / Başlat | WhatsApp bot kontrolü |
| Düzenle | Detay sayfası |

### Sistem Sağlığı (Sol Alt)
- Yeşil: Sağlıklı | Turuncu: Sentry hatası | Gri: Kill Switch aktif

### Kill Switch (Header)
- **Sistemi Dondur** / **Sistemi Çöz** – Tüm botları tek tıkla durdur/başlat

## 4.2 Kısayollar
| Kısayol | İşlev |
|---------|-------|
| ⌘K / Ctrl+K | Komut paleti |
| ESC | Kapat |

## 4.3 Admin Araçlar Paneli
**Admin → Araçlar** sayfasından: Toast, PostHog, Cache, E-posta, Sentry, Log testleri

---

# 5. Kütüphaneler

## 5.1 Özet Tablo

| Kütüphane | Kategori | Ana Kullanım |
|-----------|----------|--------------|
| @sentry/nextjs | Monitoring | Production hata takibi |
| pino | Loglama | Yapılandırılmış log |
| sonner | UI | Toast bildirimleri |
| clsx, tailwind-merge | UI | className birleştirme |
| recharts | UI | Dashboard grafikleri (ChartBar) |
| motion | UI | Animasyonlar |
| lottie-react | UI | Lottie animasyonları |
| lucide-react | UI | İkonlar |
| react-hook-form, @hookform/resolvers | Form | Form + Zod |
| zod | Validasyon | Şema doğrulama |
| swr | Veri | Data fetching, cache |
| unstorage | Veri | Key-value storage |
| dayjs, chrono-node | Tarih | Tarih/saat, doğal dil parse |
| fuse.js | Arama | Bulanık arama |
| openai, @langfuse/openai | AI | LLM, trace |
| xstate | AI | Bot FSM |
| @supabase/* | Altyapı | Veritabanı, auth |
| @upstash/redis, ratelimit | Altyapı | Redis, rate limit |
| inngest | Altyapı | Arka plan job'ları |
| vitest, @playwright/test | Test | Unit, E2E |

## 5.2 Pratik Kullanım Örnekleri

### Toast
```tsx
import { toast } from "@/lib/toast";
toast.success("Kayıt başarılı!");
toast.error("Hata", "Lütfen tekrar deneyin");
toast.promise(fetch("/api/save").then(r => r.json()), { loading: "...", success: "...", error: e => e.message });
```

### cn() — className
```tsx
import { cn } from "@/lib/cn";
<button className={cn("base", isActive && "active")} />
```

### Form + Zod
```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) });
```

### Grafik (Recharts / ChartBar)
```tsx
import { ChartBar } from "@/components/charts/ChartBar";
import { ChartCard } from "@/components/charts/ChartCard";
<ChartCard title="Başlık">
  <ChartBar data={[...]} xKey="name" bars="value" colors="emerald" />
</ChartCard>
```

### Loglama
```ts
import { logger } from "@/lib/logger";
logger.info("İşlem başladı");
logger.error({ err }, "Hata");
```

### Cache (unstorage)
```ts
import { storage } from "@/lib/storage";
await storage.setItem("key", JSON.stringify(data));
const data = await storage.getItem("key");
```

### Bulanık arama
```ts
import { fuzzySearch, fuzzySearchBest } from "@/lib/fuse-search";
const filtered = fuzzySearch({ list, query, keys: ["name"], limit: 20 });
```

### Inngest
```ts
export const myJobFn = inngest.createFunction({ id: "my-job" }, { event: "my/event" }, async ({ step }) => {
  await step.run("process", async () => { /* ... */ });
});
```

## 5.3 Cheat Sheet
| İhtiyaç | Kullan |
|---------|--------|
| Bildirim | `toast.success()` / `toast.error()` |
| Koşullu CSS | `cn("base", condition && "extra")` |
| Form + validasyon | `useForm` + `zodResolver` + `zod` |
| Loglama | `logger.info()`, `logger.error()` |
| Cache | `storage.setItem()` / `storage.getItem()` |
| Bulanık arama | `fuzzySearch()`, `fuzzySearchBest()` |
| Grafik | `ChartBar`, `ChartCard` (recharts) |
| Unit test | Vitest |
| E2E test | Playwright |

---

# 6. OTP, SMS ve Kampanya

## 6.1 OTP (SMS Doğrulama)

**Kullanım yerleri:**
1. **Admin girişi** (`/admin/login`): `ENABLE_SMS_2FA=true` → `ADMIN_2FA_PHONE_E164` numarasına Twilio Verify ile OTP
2. **Dashboard girişi** (`/dashboard/login`): Tenant `owner_phone_e164` veya `contact_phone` numarasına OTP

**Gerekli env:** `ENABLE_SMS_2FA`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `ADMIN_2FA_PHONE_E164`

## 6.2 Bilgi / İşlemsel Mesaj

**Katman:** `sendCustomerNotification(to, text)` – Önce WhatsApp, sonra (isteğe bağlı) SMS

**SMS modları:** `INFO_SMS_MODE=always` (her zaman) veya `fallback` (WhatsApp başarısızsa)

**Kullanım yerleri:** Cron randevu hatırlatması, CRM hatırlatmaları, toplu/tekil iptal

**Gerekli env:** `ENABLE_INFO_SMS`, `INFO_SMS_MODE`, `TWILIO_SMS_FROM_E164` veya `TWILIO_PHONE_NUMBER`

## 6.3 Kampanya SMS
- Ayrı "kampanya SMS" modülü **yok**
- Toplu gönderim sadece işlemsel senaryolarda (hatırlatma, iptal)
- Admin Kampanya Mesajları: WhatsApp + SMS; CRM/randevu müşterileri

## 6.4 Özet Tablo
| Özellik | Var mı? | Açma |
|---------|---------|------|
| Admin OTP | Evet | `ENABLE_SMS_2FA=true` + Twilio Verify |
| Dashboard OTP | Evet | `ENABLE_SMS_2FA=true` + tenant telefonu |
| Bilgi SMS | Evet | `ENABLE_INFO_SMS=true` + `TWILIO_SMS_FROM_E164` |
| Kampanya mesajları | Evet | Admin panel → Kampanya Mesajları |

---

# 7. Token Mimarisi ve Bot Kontrol

## 7.1 Webhook
- Yanıtta işletme adı prefix'i kaldırıldı
- Tenant değişiminde ayraç mesajı kaldırıldı
- Boş mesajda `processMessage` çağrılmıyor

## 7.2 Niyet Sınıflandırma ve Model Routing
- Deterministic iptal/gecikme: classification çağrılmıyor
- İnsan escalation: erken return
- Classification hata: "simple" fallback
- 429 retry: aynı model kullanılıyor

## 7.3 Bağlam Sıkıştırma
- API'ye giden: son 2 tur (4 mesaj)
- State summary: legacy ve config path'te mevcut
- Session: son 20 mesaj saklanıyor; API'ye 2 tur gidiyor

## 7.4 XML ve Prompt
- Legacy/Config: `<rol>`, `<ton>`, `<kurallar>`, `<bağlam>` blokları
- Randevu/iptal onayında kısa esnaf ağzı talimatı

## 7.5 Manuel Test Önerileri
1. **Basit:** "Selam", "Saç kesimi ne kadar?", "Yarın 15:00 randevu"
2. **Karmaşık:** "Randevumu iptal etmek istiyorum", "Her pazartesi 10'da"
3. **Tenant:** İşletme A/B linki ile geçiş, ayraç yok
4. **Bağlam:** "Yarın 14:00 boş mu?" → "Tamam 14'e al"
5. **Hata:** OPENAI_API_KEY yok → crash olmamalı

---

# 8. V3 Roadmap Özeti

> Bu bölüm `PLAN_AHIAI_V3_ROADMAP.md`'den özetlenmiştir. Güncel icra durumu için **Bölüm 1 (Master Plan)** esas alınır.

**Amaç:** Domain + mobil kusursuzluk, WhatsApp çoklu işletme zekası, operasyonel modüller

**Tamamlanan (V3 iterasyonunda):** Domain standardizasyonu, mobil dashboard UX, tenant marker eşleştirme, session TTL 30 gün

**Fazlı yol haritası (özet):**
- Faz 1: Çoklu işletme mesaj motoru (routing, tenant_switch_logs)
- Faz 2: Randevu çekirdeği, race condition koruması
- Faz 3: İptal, gecikme, no-show
- Faz 4: Fiyat, pazarlık politikası
- Faz 5: 24 saat pencere, sesli mesaj, rate limit
- Faz 6: Model routing, context compression, function calling

**Feature flag'ler:** `ENABLE_DASHBOARD_V2`, `ENABLE_SMS_2FA`, `ENABLE_CRM_MODULE`, `ENABLE_ADVANCED_ROUTING`, `ENABLE_VOICE_NOTES`

---

# 9. CRM Strateji ve Rekabet Analizi

## 9.1 CRM Master Report Özeti

**Hedef:** Ahi AI'yi randevu botundan gelir/operasyon motoruna dönüştürmek

**Stratejik kararlar:** Türkiye önce, global-ready; Pilot: Kuaför/Güzellik + Diş/Estetik; Segment: Tek şube SMB

**Güçlü yönler:** Multi-tenant, WhatsApp AI, randevu/iptal/gecikme, CRM temel modelleri, ops alerts

**Boşluklar:** Gelir odaklı aksiyon katmanı, dikeye özel veri nesneleri, revenue ledger, reactivation motoru

**Ürün prensipleri:** Her ekranda "şimdi ne yapalım" aksiyonu; Command Center; sektör seçimiyle alan değişimi; kısa butonlar (Geri kazan, Boş slotu doldur, No-show azalt)

## 9.2 Rekabet Matrisi

| Vendor | Kategori | Güçlü Yön | Zayıf Yön | Alınacak | Kaçınılacak |
|--------|----------|------------|-----------|----------|-------------|
| GoHighLevel | Horizontal CRM | Workflow automation | Steep learning curve | Action-first automation | Generic menüler |
| Phorest | Salon CRM | Retention, loyalty | Heavier setup | Beauty vertical defaults | Complex onboarding |
| Vagaro | Salon/Wellness | Marketplace + booking | Feature sprawl | SMB friendly packaging | Overloaded UI |
| Zenoti | Enterprise salon | Deep operations | Too enterprise | Staffing logic | Enterprise complexity |
| Boulevard | Premium salon | Polished UX | Limited breadth | Client journey | Narrow extensibility |
| Fresha | Salon marketplace | Fast adoption | Marketplace dependency | Low friction onboarding | External dependency |
| Shopmonkey | Auto repair | Job card flow | Niche specific | Vehicle/job model | Overfitting |
| ServiceTitan | Field service | Revenue + ops | Heavy for SMB | Revenue linkage | Enterprise overhead |
| Jobber | Field service SMB | Simple scheduling | Shallow vertical | Simple UX | Shallow customization |
| Klaviyo | Retention | Segmentation | Not appointment ops | Lifecycle patterns | Over-automation |

---

*Son güncelleme: 5 Mart 2026*
