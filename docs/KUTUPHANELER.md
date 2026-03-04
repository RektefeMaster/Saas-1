# Proje Kütüphaneleri Dokümantasyonu

Bu belge, SaaSRandevu (Ahi AI) projesinde kurulu tüm npm kütüphanelerini, ne işe yaradıklarını ve projede nerede kullanıldıklarını detaylı olarak açıklar.

---

## İçindekiler

1. [Hata Takibi & Monitoring](#1-hata-takibi--monitoring)
2. [UI & UX](#2-ui--ux)
3. [Form & Validasyon](#3-form--validasyon)
4. [Veri & State](#4-veri--state)
5. [Tarih & Zaman](#5-tarih--zaman)
6. [Arama & Eşleştirme](#6-arama--eşleştirme)
7. [AI & Bot](#7-ai--bot)
8. [Altyapı & API](#8-altyapı--api)
9. [Test](#9-test)
10. [Diğer](#10-diğer)

---

## 1. Hata Takibi & Monitoring

### @sentry/nextjs

**Amaç:** Production ortamında hata takibi, performans izleme ve crash raporlama.

**Kullanım Yerleri:**
- `next.config.ts` — `withSentryConfig` ile Next.js build entegrasyonu
- `sentry.server.config.ts` — Sunucu tarafı Sentry başlatma
- `sentry.edge.config.ts` — Edge runtime Sentry başlatma
- `instrumentation.ts` — Node.js instrumentation
- `instrumentation-client.ts` — Client-side instrumentation
- `src/app/global-error.tsx` — Global hata yakalama ve Sentry'ye raporlama

**Not:** `.npmrc` içinde `legacy-peer-deps=true` gerekebilir (peer dependency uyumsuzlukları için).

---

### pino & pino-pretty

**Amaç:** Yapılandırılmış, JSON tabanlı loglama. Production'da makine okunabilir, development'ta `pino-pretty` ile okunabilir format.

**Kullanım Yerleri:**
- `src/lib/logger.ts` — Ana logger instance tanımı
- `src/app/api/contact/route.ts` — İletişim formu hata logları
- `src/app/api/webhook/whatsapp/route.ts` — WhatsApp webhook logları

---

## 2. UI & UX

### sonner

**Amaç:** Toast bildirimleri (başarı, hata, bilgi, uyarı, promise).

**Kullanım Yerleri:**
- `src/app/layout.tsx` — `<Toaster richColors position="top-right" />` global toast container
- `src/lib/toast.ts` — `toast.success`, `toast.error`, `toast.info`, `toast.warning`, `toast.promise` wrapper

---

### clsx & tailwind-merge

**Amaç:** Dinamik `className` birleştirme. `clsx` koşullu sınıfları, `tailwind-merge` çakışan Tailwind sınıflarını birleştirir.

**Kullanım Yerleri:**
- `src/lib/cn.ts` — `cn(...inputs)` utility fonksiyonu
- `src/components/ui/Card.tsx` — Kart bileşeni sınıfları
- `src/app/admin/(dashboard)/layout.tsx` — Admin layout navigasyon sınıfları
- Proje genelinde `cn()` ile dinamik sınıf birleştirme

---

### @tremor/react

**Amaç:** Dashboard grafikleri (BarChart, AreaChart vb.) — hızlı, responsive, dark mode destekli.

**Kullanım Yerleri:**
- `src/app/dashboard/[tenantId]/page.tsx` — Tenant dashboard `BarChart`
- `src/app/admin/(dashboard)/page.tsx` — Admin dashboard `BarChart`

---

### motion (Framer Motion)

**Amaç:** Animasyonlar, scroll-based efektler, geçişler.

**Kullanım Yerleri:**
- `src/app/page.tsx` — Ana sayfa `motion.article` animasyonları
- `src/components/ui/ScrollReveal.tsx` — Scroll reveal bileşeni
- `src/app/dashboard/[tenantId]/page.tsx` — `MotionConfig`, `motion`, `useScroll`, `useTransform` ile dashboard animasyonları

**Not:** `next.config.ts` içinde `optimizePackageImports: ["motion"]` ile tree-shaking uygulanır.

---

### lottie-react

**Amaç:** Lottie JSON animasyonları (loading, empty, success vb.).

**Kullanım Yerleri:**
- `src/components/ui/LottieAnimation.tsx` — Lottie wrapper bileşeni
- `src/app/isletmeler/page.tsx` — loading, empty animasyonları
- `src/app/admin/(dashboard)/campaigns/page.tsx` — loading, success, empty
- `src/app/dashboard/[tenantId]/campaigns/page.tsx` — loading, success, empty
- `src/app/dashboard/[tenantId]/settings/page.tsx` — loading, success
- `src/app/dashboard/[tenantId]/page.tsx` — loading, empty

---

### lucide-react

**Amaç:** İkon seti (SVG tabanlı, tree-shakeable).

**Kullanım Yerleri:**
- Proje genelinde 25+ bileşende ikon kullanımı
- `next.config.ts` içinde `optimizePackageImports: ["lucide-react"]` ile tree-shaking

---

### @tanstack/react-table

**Amaç:** Tablo state yönetimi (sıralama, filtre, sayfalama).

**Kullanım Yerleri:**
- `src/app/admin/(dashboard)/tenants/page.tsx` — Tenant listesi tablosu
- `src/components/ui/DataTable.tsx` — Genel amaçlı `DataTable`, `useDataTable` bileşenleri

---

### @tanstack/react-virtual

**Amaç:** Uzun listeler için sanal scroll (sadece görünür öğeler render edilir).

**Kullanım Yerleri:**
- `src/components/ui/VirtualList.tsx` — `VirtualList<T>` bileşeni

---

### cmdk

**Amaç:** ⌘K tarzı command palette (hızlı arama, navigasyon).

**Kullanım Yerleri:**
- `src/components/admin/CommandMenu.tsx` — Admin paneli Command Menu

---

### vaul

**Amaç:** Drawer bileşeni (alt/sağ/sol panel).

**Kullanım Yerleri:**
- `src/app/admin/(dashboard)/tenants/page.tsx` — Quick Add drawer
- `src/components/ui/Drawer.tsx` — `Drawer` wrapper (title/description ile genişletilmiş Content)

---

## 3. Form & Validasyon

### react-hook-form & @hookform/resolvers

**Amaç:** Form state yönetimi ve Zod ile şema tabanlı validasyon.

**Kullanım Yerleri:**
- `src/components/ui/ContactModal.tsx` — `useForm`, `zodResolver(contactSchema)` ile iletişim formu
- `src/lib/use-form-with-zod.ts` — `useFormWithZod(schema, options)` helper hook

---

### zod

**Amaç:** Şema doğrulama, tip güvenliği, form ve API validasyonu.

**Kullanım Yerleri:**
- `src/components/ui/ContactModal.tsx` — `contactSchema` (name, email, phone, message)
- `src/lib/bot-v1/conversation/tools/tool-schemas.ts` — Bot tool şemaları: `checkAvailabilitySchema`, `matchServiceSchema`, `createAppointmentSchema`, `cancelAppointmentSchema`, `rescheduleAppointmentSchema`, `checkWeekAvailabilitySchema`, `addToWaitlistSchema`, `notifyLateSchema`, `createRecurringSchema`, `checkCustomerPackageSchema`

---

### validator

**Amaç:** E-posta, URL vb. string doğrulama.

**Kullanım Yerleri:**
- `src/lib/validation.ts` — `isValidEmail`, `isValidUrl` fonksiyonları
- `src/app/api/contact/route.ts` — `isValidEmail` ile e-posta doğrulama

---

## 4. Veri & State

### swr

**Amaç:** Veri çekme, cache, revalidation (stale-while-revalidate).

**Kullanım Yerleri:**
- `src/app/dashboard/[tenantId]/page.tsx` — `useSWR<Tenant>` tenant verisi
- `src/app/dashboard/DashboardShell.tsx` — `useSWR` tenant ve feature flags
- `src/lib/swr-fetcher.ts` — `fetcher` (varsayılan fetch wrapper)
- `src/lib/swr-hooks.ts` — `useApiData<T>(url)` helper hook

---

### unstorage

**Amaç:** Çoklu backend key-value storage. Redis (Upstash) varsa kullanır, yoksa memory fallback.

**Kullanım Yerleri:**
- `src/lib/storage.ts` — `createStorage` ile Redis veya memory driver
- Cache ve geçici veri için tek API (şu an doğrudan import eden bileşen yok; altyapı hazır)

---

## 5. Tarih & Zaman

### dayjs

**Amaç:** Tarih/saat işlemleri, timezone desteği (utc, timezone plugin).

**Kullanım Yerleri:**
- `src/lib/dayjs-utils.ts` — `todayStr`, `currentTimeStr`, `localDateStr`, `localTimeStr` vb.
- `src/lib/chrono-parse.ts` — Referans tarih ve format dönüşümleri
- `src/lib/bot-v1/conversation/tools/executor.ts` — `todayStr`, `localDateStr` ile randevu tarih işlemleri

---

### chrono-node

**Amaç:** Doğal dil tarih ayrıştırma ("yarın saat 15:00", "5 Mart 2025 14:30" vb.).

**Kullanım Yerleri:**
- `src/lib/chrono-parse.ts` — `parseNaturalDateTime`, `parseNaturalDate`
- `src/lib/bot-v1/conversation/context-builder.ts` — Müşteri mesajından tarih/saat çıkarma
- `src/lib/__tests__/chrono-parse.test.ts` — Unit testler

---

### humanize-duration

**Amaç:** Dakika/saniye → okunabilir süre ("1 saat 30 dakika", "30 dakika").

**Kullanım Yerleri:**
- `src/lib/humanize-duration.ts` — `humanizeMinutes` (Türkçe)
- `src/app/dashboard/[tenantId]/settings/page.tsx` — Slot süresi hint
- `src/app/dashboard/[tenantId]/pricing/page.tsx` — Paket süreleri gösterimi

---

### ms

**Amaç:** Zaman string parse ("2h" → 7200000 ms, "500ms" → 500).

**Kullanım Yerleri:**
- `src/lib/retry.ts` — `minTimeout: ms("500ms")`, `maxTimeout: ms("8s")` retry ayarları

---

## 6. Arama & Eşleştirme

### fuse.js

**Amaç:** Bulanık arama (Levenshtein benzeri), Türkçe informal ifadeleri destekler.

**Kullanım Yerleri:**
- `src/lib/fuse-search.ts` — `fuzzySearch`, `fuzzySearchBest` fonksiyonları
- `src/app/isletmeler/page.tsx` — İşletme listesi arama
- `src/app/admin/(dashboard)/tenants/page.tsx` — Tenant listesi arama
- `src/app/api/tenant/[id]/crm/customers/route.ts` — Müşteri arama
- `src/lib/bot-v1/conversation/tools/match-service.ts` — Hizmet eşleştirme (`fuzzySearchBest`)

---

## 7. AI & Bot

### openai

**Amaç:** OpenAI API (Chat Completions, tool calling).

**Kullanım Yerleri:**
- `src/lib/bot-v1/conversation/client.ts` — OpenAI client, Langfuse ile sarmalanmış
- `src/lib/bot-v1/conversation/processor.ts` — `callOpenAI` ile mesaj işleme, tool çağrıları

---

### @langfuse/openai

**Amaç:** LLM gözlemcisi — OpenAI çağrılarını Langfuse'e trace eder.

**Kullanım Yerleri:**
- `src/lib/bot-v1/conversation/client.ts` — `observeOpenAI(baseClient, {...})`
- `src/app/admin/(dashboard)/layout.tsx` — Langfuse Cloud panel linki

---

### xstate

**Amaç:** Bot FSM (Finite State Machine) — geçersiz durum geçişlerini engeller.

**Kullanım Yerleri:**
- `src/lib/bot-v1/fsm/bot-state-machine.ts` — `createMachine`, `canTransition`, `getValidNextStep`
- `src/lib/bot-v1/conversation/processor.ts` — `getValidNextStep` ile durum geçiş kontrolü
- `src/lib/bot-v1/fsm/__tests__/bot-state-machine.test.ts` — Unit testler

---

## 8. Altyapı & API

### @supabase/ssr & @supabase/supabase-js

**Amaç:** Supabase veritabanı, auth, storage.

**Kullanım Yerleri:**
- `src/lib/supabase/server.ts` — `createServerClient` (SSR)
- `src/lib/supabase.ts` — Ana Supabase client
- Proje genelinde tenant, campaign, CRM, auth vb. tüm veri işlemleri

---

### @upstash/redis & @upstash/ratelimit

**Amaç:** Redis (Upstash REST API) ve rate limiting (sliding window).

**Kullanım Yerleri:**
- `src/lib/redis.ts` — Redis client, `Ratelimit` (dakika/saat/gün limitleri)
- Webhook, contact form vb. spam koruması için `checkAndIncrementRateLimit`
- Konuşma state cache (Redis varsa)

---

### inngest

**Amaç:** Arka plan job'ları, webhook timeout kurtarma — webhook'tan kuyruğa, kuyruktan işleme.

**Kullanım Yerleri:**
- `src/lib/inngest/client.ts` — Inngest client
- `src/lib/inngest/functions/process-whatsapp-message.ts` — `processWhatsAppMessageFn`
- `src/app/api/inngest/route.ts` — `serve` ile Inngest API endpoint

**Script:** `npm run dev:inngest` — Inngest CLI ile local geliştirme

---

### p-retry

**Amaç:** Exponential backoff retry — dış API çağrılarında anlık ağ hatalarını atlatır.

**Kullanım Yerleri:**
- `src/lib/retry.ts` — `withRetry` wrapper (4 deneme, 0.5s–8s timeout)
- `src/lib/bot-v1/conversation/tools/executor.ts` — Randevu reserve retry
- `src/lib/bot-v1/conversation/processor.ts` — OpenAI çağrısı retry
- `src/lib/whatsapp.ts` — WhatsApp API retry

---

### nanoid

**Amaç:** Kısa, benzersiz ID üretimi.

**Kullanım Yerleri:**
- `src/lib/id.ts` — `nanoid`, `shortId` export
- `src/app/api/webhook/whatsapp/route.ts` — `traceId`, `messageId`
- `src/app/api/admin/auth/login/route.ts` — `challengeId`

---

### jose

**Amaç:** JWT imzalama ve doğrulama (SignJWT, jwtVerify).

**Kullanım Yerleri:**
- `src/lib/admin-auth.ts` — Admin login JWT imzalama/doğrulama
- `src/proxy.ts` — JWT doğrulama

---

### resend

**Amaç:** E-posta gönderimi (transactional e-postalar).

**Kullanım Yerleri:**
- `src/app/api/contact/route.ts` — İletişim formu e-postası (`resend.emails.send`)

---

### qrcode

**Amaç:** QR kod üretimi (SVG, PNG, Buffer).

**Kullanım Yerleri:**
- `src/utils/generateTenantAssets.ts` — `generateQRCode` (WhatsApp link QR)
- `src/app/api/tenant/[id]/qr/route.ts` — QR API endpoint (SVG, PNG)
- `src/components/ui/QRCodeModal.tsx` — Modal içinde QR gösterimi
- `src/lib/qr-utils.ts` — `qrToDataURL`, `qrToBuffer` yardımcıları

---

### libphonenumber-js

**Amaç:** E.164 telefon normalizasyonu, ülke kodu desteği.

**Kullanım Yerleri:**
- `src/lib/phone.ts` — `normalizePhoneE164`, `normalizePhoneDigits`
- `src/app/api/tenant/[id]/staff/route.ts` — Personel telefon normalizasyonu
- `src/app/api/tenant/[id]/campaigns/send/route.ts` — Kampanya alıcı telefonları
- `src/app/api/tenant/[id]/crm/customers/[phone]/route.ts` — Müşteri telefon
- `src/services/package.service.ts` — Paket müşteri telefonu
- `src/lib/__tests__/phone.test.ts` — Unit testler

---

### slugify

**Amaç:** URL-safe string üretimi, Türkçe karakter desteği.

**Kullanım Yerleri:**
- `src/lib/slugify.ts` — `slugify(value, maxLength)` utility
- `src/app/api/admin/tenants/route.ts` — Servis slug oluşturma

---

## 9. Test

### vitest & @testing-library/react & @testing-library/jest-dom

**Amaç:** Unit ve component testleri.

**Kullanım Yerleri:**
- `vitest.config.ts` — Vitest config, jsdom, `@/` alias
- `src/test/setup.ts` — Test setup
- `src/lib/__tests__/phone.test.ts` — Telefon normalizasyon testleri
- `src/lib/__tests__/chrono-parse.test.ts` — Tarih parse testleri
- `src/lib/bot-v1/fsm/__tests__/bot-state-machine.test.ts` — FSM testleri

**Script:** `npm run test`, `npm run test:run`

---

### @playwright/test

**Amaç:** E2E (end-to-end) testleri.

**Kullanım Yerleri:**
- `playwright.config.ts` — Chromium, Firefox, baseURL, webServer
- `e2e/login.spec.ts` — Giriş akışı
- `e2e/booking-flow.spec.ts` — Randevu akışı

**Script:** `npm run test:e2e`

---

## 10. Diğer

### @vercel/analytics

**Amaç:** Sayfa görüntüleme analitiği (Vercel deploy).

**Kullanım Yerleri:**
- `src/app/layout.tsx` — `<Analytics />`

---

### @vercel/speed-insights

**Amaç:** Core Web Vitals izleme.

**Kullanım Yerleri:**
- `src/app/layout.tsx` — `<SpeedInsights />`

---

### posthog-js

**Amaç:** Ürün analitiği, kullanıcı davranışı, feature flags.

**Kullanım Yerleri:**
- `src/app/providers/PostHogProvider.tsx` — PostHog init, React provider
- `src/app/layout.tsx` — `<PostHogProvider>` ile sarmalama

---

### sharp

**Amaç:** Görsel işleme (Next.js Image optimizasyonu, resize vb.).

**Kullanım Yerleri:**
- Next.js `next/image` ile otomatik kullanım
- `next.config.ts` — `images` ayarları

---

## Özet Tablo

| Kütüphane | Kategori | Ana Kullanım |
|-----------|----------|--------------|
| @sentry/nextjs | Monitoring | Production hata takibi |
| pino | Loglama | Yapılandırılmış log |
| sonner | UI | Toast bildirimleri |
| clsx, tailwind-merge | UI | className birleştirme |
| @tremor/react | UI | Dashboard grafikleri |
| motion | UI | Animasyonlar |
| lottie-react | UI | Lottie animasyonları |
| lucide-react | UI | İkonlar |
| react-hook-form, @hookform/resolvers | Form | Form yönetimi + Zod |
| zod | Validasyon | Şema doğrulama |
| validator | Validasyon | E-posta, URL |
| swr | Veri | Data fetching, cache |
| unstorage | Veri | Key-value storage |
| dayjs | Tarih | Tarih/saat, timezone |
| chrono-node | Tarih | Doğal dil tarih parse |
| humanize-duration | Tarih | Süre formatı |
| ms | Tarih | Zaman string parse |
| fuse.js | Arama | Bulanık arama |
| openai | AI | LLM API |
| @langfuse/openai | AI | LLM gözlemcisi |
| xstate | AI | Bot FSM |
| @supabase/* | Altyapı | Veritabanı, auth |
| @upstash/redis, @upstash/ratelimit | Altyapı | Redis, rate limit |
| inngest | Altyapı | Arka plan job'ları |
| p-retry | Altyapı | API retry |
| nanoid | Altyapı | Benzersiz ID |
| jose | Auth | JWT |
| resend | E-posta | Transactional e-posta |
| qrcode | Utility | QR kod |
| libphonenumber-js | Utility | Telefon normalizasyonu |
| slugify | Utility | URL-safe string |
| vitest, @testing-library/* | Test | Unit/component |
| @playwright/test | Test | E2E |
| @vercel/analytics, @vercel/speed-insights | Analitik | Vercel metrikleri |
| posthog-js | Analitik | Ürün analitiği |
| sharp | Görsel | Image optimizasyonu |

---

*Son güncelleme: Mart 2025*
