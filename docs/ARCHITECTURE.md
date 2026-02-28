# SaaSRandevu — Mimari Doküman

WhatsApp üzerinden çalışan, yapay zeka destekli çok kiracılı randevu SaaS sistemi. Bu doküman teknik kararları, güvenlik kurallarını ve hata yönetimini tanımlar.

---

## 1. Genel Mimari

- **Stack:** Next.js (App Router), Supabase (PostgreSQL + Realtime), Upstash Redis (oturum + rate limit), OpenAI, Meta WhatsApp Cloud API.
- **Kiracı modeli:** Her esnaf bir `tenant`; `tenant_code` (örn. AHMET01) ile QR/link üzerinden tanımlanır.
- **Akış:** Müşteri WhatsApp’tan mesaj atar → webhook alınır → tenant kodu veya önceki oturumla tenant çözülür → AI ile konuşma yönetilir → randevu oluşturulur/iptal edilir.

---

## 2. İnsan Yönlendirme (Human Escalation) [YENİ]

**Genel kural:** Sistem her sıkışma, hata veya belirsiz durumda müşteriyi gerçek kişiye (işletme ile doğrudan iletişime) yönlendirmelidir.

### 2.1 Yönlendirme mesajı

Metin şu formatta olmalıdır:

```
Üzgünüm, bu konuda size yardımcı olamıyorum.
Lütfen işletmemizle doğrudan iletişime geçin: {tenant.contact_phone}
Çalışma saatleri: {tenant.working_hours_text}
```

- `contact_phone`: Esnafın gerçek telefon numarası (tenants tablosu).
- `working_hours_text`: Örn. "Hafta içi 09:00-18:00" (tenants tablosu).

### 2.2 Tetikleme koşulları [YENİ]

Bu mesaj şu durumlarda tetiklenir:

1. **AI 2 kez üst üste yanlış anlarsa** — Örn. "Anlayamadım, tekrar yazar mısınız?" iki kez ardışık dönmüşse.
2. **Müşteri insan/yetkili talebi yazarsa** — "insan", "yetkili", "sizi aramak istiyorum" vb. ifadeler.
3. **Desteklenmeyen bir istek gelirse** — Akış dışı (randevu/sipariş/iptal dışı) net talepler.
4. **Sistem hatası olursa** — Webhook veya AI işleme sırasında yakalanan hatalar.
5. **Konuşma 10 mesajı geçip randevu tamamlanmamışsa** — Spiral önleme ve insan devralması.

### 2.3 Veri modeli [YENİ]

`tenants` tablosuna ek alanlar:

| Alan                 | Tip   | Açıklama                                  |
|----------------------|-------|-------------------------------------------|
| `contact_phone`      | TEXT  | Esnafın gerçek iletişim telefonu          |
| `working_hours_text` | TEXT  | Örn. "Hafta içi 09:00-18:00"              |

Bu alanlar yönlendirme mesajında kullanılır; yoksa placeholder metin gösterilir.

---

## 3. Güvenlik

### 3.1 Webhook İmza Doğrulama [YENİ]

- **Amaç:** Meta’nın gönderdiği webhook isteklerinin gerçekten Meta’dan geldiğini doğrulamak; sahte isteklere karşı koruma.
- **Mekanizma:** Meta her POST isteğinde `x-hub-signature-256` header’ı gönderir. Payload, `WHATSAPP_WEBHOOK_SECRET` ile HMAC-SHA256 hesaplanıp bu imza ile karşılaştırılır.
- **Uygulama:**
  - Doğrulama için **ham (raw) body** kullanılır; JSON parse öncesi buffer/text ile imza kontrolü yapılır.
  - Doğrulama başarısızsa **401** dönülür ve olay loglanır.
  - Secret `.env` üzerinden `WHATSAPP_WEBHOOK_SECRET` olarak okunur.

### 3.2 Rate Limiting [YENİ]

- **Amaç:** Aynı numaradan gelen mesaj yoğunluğunu sınırlayarak kötüye kullanım ve maliyet kontrolü.
- **Kural:** Aynı numaradan **1 dakikada en fazla 15 mesaj**.
- **Uygulama:**
  - Sayaç Redis’te tutulur: `ratelimit:{phone}`, TTL 60 saniye.
  - Limit aşımında kullanıcıya: *"Çok fazla mesaj gönderdiniz, lütfen 1 dakika bekleyin."* metni gönderilir.
  - Limit aşımı loglanır.

### 3.3 Tenant İzolasyonu [GÜNCELLENDI]

- **RLS:** Supabase’de Row Level Security açıktır; uygulama tarafında da tenant izolasyonu zorunludur.
- **Uygulama katmanı:**
  - Her veritabanı sorgusunda **tenant_id zorunlu filtre** uygulanır.
  - Hiçbir sorgu `tenant_id` filtresi olmadan çalışmaz.
  - Servis fonksiyonları ilgili işlem için **tenant_id** parametresi alır.
- **Yetki kontrolü:** İstekte gelen veya çözülen `tenant_id` ile işlem yapılan tenant farklıysa **403** dönülür (örn. dashboard/API’da path’teki tenant ile oturum/context uyumsuzluğu).

### 3.4 Ortam Değişkenleri (Environment) [YENİ]

- Tüm environment variable’lar `.env.example` içinde **açıklamalı** listelenir.
- Hassas değerler (şifreler, API anahtarları, webhook secret) asla kod içine yazılmaz; sadece env üzerinden okunur.
- Production’da `WHATSAPP_WEBHOOK_SECRET` mutlaka güçlü ve gizli tutulur.

---

## 4. Hata ve Tutarlılık Yönetimi

- **Webhook hataları:** İmza hatası → 401. Rate limit → kullanıcıya bilgi mesajı + log. Diğer hatalarda müşteriye insan yönlendirme mesajı (yukarıdaki formatta) veya genel hata mesajı gidilebilir; detay loglanır.
- **AI/konuşma hataları:** Yukarıdaki “İnsan yönlendirme” tetikleyicileri (2 kez yanlış anlama, 10+ mesaj, insan talebi, sistem hatası) kullanılarak aynı yönlendirme mesajı verilir.
- **Veritabanı:** İşlemler tenant_id ile kapsamlandırılır; tutarlılık için gerekirse transaction kullanılır.

---

## 5. Dosya Referansları

| Konu                    | Dosya / Konum |
|-------------------------|----------------|
| Webhook imza doğrulama  | `src/middleware/webhookVerify.middleware.ts` |
| Rate limiting           | `src/middleware/rateLimit.middleware.ts`     |
| Tenant kapsamı          | `src/middleware/tenantScope.middleware.ts`   |
| Ortam değişkenleri      | `.env.example`                                |
| İnsan yönlendirme metni | `src/lib/ai.ts` (processMessage + tenant alanları) |

---

## 6. Sürüm Notu

- **[YENİ]:** İnsan yönlendirme kuralı, tetikleyiciler, tenants alanları, webhook imza doğrulama, rate limiting, tenant izolasyonu kuralları, env dokümantasyonu.
- **[GÜNCELLENDI]:** Tenant izolasyonu bölümü uygulama katmanı ve 403 davranışı ile netleştirildi.
