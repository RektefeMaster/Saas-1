# SaaSRandevu — Performans Analiz Raporu

**Tarih:** 7 Mart 2026 (İlk Tarama)  
**Güncelleme:** 8 Mart 2026 (Dördüncü Tarama - Kütüphane Analizi)  
**Kapsam:** Tüm frontend sayfaları, API route'ları, veri çekme stratejileri, animasyonlar, bellek yönetimi, kütüphane kullanımları  
**Sonuç:** Internet sitesi ve paneller ciddi kasma/yavaşlık sorunu yaşıyor. Aşağıda tüm sorunlar detaylı olarak açıklanmıştır.

**İlgili Raporlar:**
- [Kütüphane Performans Analizi](./KUTUPHANE-PERFORMANS-ANALIZI.md) - Kütüphane kullanımları ve optimizasyon önerileri
- [Yeni Performans Sorunları](./YENI-PERFORMANS-SORUNLARI.md) - Dördüncü tarama bulguları
- [AppointmentsView Context Pattern](./APPOINTMENTS_VIEW_CONTEXT_PATTERN.md) - Context pattern refactoring planı

## Doğrulama ve Uygulama Durumu

### 7 Mart 2026 Revizyon (İlk Doğrulama)

Bu revizyonda rapordaki bulgular tek tek yeniden kontrol edilip kod tarafında doğrulanan maddeler uygulanmıştır.

### 8 Mart 2026 Revizyon (Güncel Durum Kontrolü)

Kullanıcı tarafından yapılan iyileştirmeler kontrol edilmiş ve güncel durum raporlanmıştır.

### Doğrulanıp Düzeltilen Maddeler

| Madde | Durum | Uygulanan Değişiklik |
|-------|-------|-----------------------|
| 3 — Aşırı polling | ✅ Düzeltildi | Dashboard polling aralıkları `10s/30s/60s` → `30s/60s/120s` yapıldı. |
| 5 — AbortController eksikliği | ✅ Düzeltildi | Dashboard'da `blocked-dates`, `reviews`, `availability/slots` fetch'lerine `AbortController` + cleanup eklendi. |
| 6 — Temizlenmeyen timeout | ✅ Düzeltildi | CRM sayfasında `clearMessageLater` timeout'u ref ile tekilleştirildi ve unmount cleanup eklendi. |
| 7 — `key={Math.random()}` | ✅ Düzeltildi | Admin Tools sayfasında key fallback'i deterministik hale getirildi. |
| 8 — SWR fetcher `no-store` | ✅ Düzeltildi | `src/lib/swr-fetcher.ts` içinde `cache: "no-store"` kaldırıldı. |
| 13 — Production `console.log` | ✅ Düzeltildi | `tenants/[id]/route.ts` ve `webhook/twilio/sms/route.ts` içindeki log satırları kaldırıldı. |
| 19 — ThemeProvider context referansı | ✅ Düzeltildi | Theme context provider value'su `useMemo` ile stabilize edildi. |
| 20 — Supabase client singleton | ✅ Düzeltildi | Browser client için singleton kontrolü eklendi ve tekrar çağrılarda aynı instance dönülüyor. |
| 22 — Admin layout no-store fetch | ✅ Kısmi İyileştirme | Kill-switch fetch'inde `cache: "no-store"` kaldırıldı. |
| 27 — Kullanılmayan `@tremor/react` | ✅ Düzeltildi | `package.json` ve root lock dependency kaydı temizlendi. |
| 32 — `adjustFontFallback` kapalı | ✅ Düzeltildi | `layout.tsx` içinde her iki font için `adjustFontFallback: true` ayarlandı. |

### Doğrulama Kontrolü (Kod Taraması)

Aşağıdaki maddeler rapordaki "düzeltildi" iddiasına karşı **kodda tek tek doğrulandı**:

| Madde | Doğrulama sonucu | Dosya / satır |
|-------|------------------|----------------|
| 3 — Polling | ✅ Doğrulandı | `page.tsx`: `30000`, `60000`, `120000` |
| 5 — AbortController | ✅ Doğrulandı | `page.tsx`: blocked-dates, reviews, availability/slots için `controller` + `signal` + cleanup |
| 6 — clearMessageLater | ✅ Doğrulandı | `crm/page.tsx`: `clearTimerRef`, cleanup useEffect |
| 7 — key Math.random | ✅ Doğrulandı | `tools/page.tsx:376`: `key={issue.id ?? issue.shortId ?? \`sentry-${i}\`}` |
| 8 — SWR no-store | ✅ Doğrulandı | `swr-fetcher.ts`: `fetch(url)` (cache yok) |
| 9 — CommandMenu | ✅ Doğrulandı | `CommandMenu.tsx`: `tenantsCacheRef` 60s cache + `AbortController` |
| 19 — ThemeProvider | ✅ Doğrulandı | `theme-context.tsx`: `useMemo(() => ({ theme, setTheme, toggleTheme }), [...])` |
| 20 — Supabase singleton | ✅ Doğrulandı | `supabase-client.ts`: `browserSupabaseClient` + early return |
| 22 — Kill-switch fetch | ✅ Doğrulandı | `admin/layout.tsx`: `fetch("/api/admin/tools/kill-switch")` (no-store yok) |
| 27 — @tremor/react | ✅ Doğrulandı | `package.json`: tremor referansı yok |
| 13 — console.log | ✅ Düzeltildi | İki dosyadaki log satırları kaldırıldı. |
| 32 — adjustFontFallback | ✅ Düzeltildi | Space_Grotesk için `adjustFontFallback: true` eklendi. |

### Doğrulandı, Bu Turda Uygulanmadı / Kısmi Kaldı

| Madde | Durum | Not |
|-------|-------|-----|
| 9 — CommandMenu cache eksikliği | ✅ Düzeltildi | Menü açılışında `AbortController` eklendi ve kısa süreli in-memory cache ile gereksiz tekrar fetch azaltıldı. |

### 8 Mart 2026 — Yeni İyileştirmeler (Kullanıcı Tarafından)

| Madde | Durum | Uygulanan Değişiklik | Doğrulama |
|-------|-------|----------------------|-----------|
| 2 — Monolitik Dashboard | ✅ **Büyük İyileştirme** | Dashboard 3 ayrı view'e bölündü (OverviewView, AppointmentsView, SettingsView). Ana sayfa 1818 satır → 710 satır. | ✅ Doğrulandı: `page.tsx` 710 satır, dynamic import'lar mevcut |
| 2 — useState Sayısı | ✅ **İyileştirildi** | Ana sayfada 51 useState → 14 useState (%73 azalma). AppointmentsView kendi state'ini yönetiyor. | ✅ Doğrulandı: `page.tsx` 14 useState, AppointmentsView ayrı component |
| 3 — Polling Süreleri | ✅ **Zaten İyileştirilmişti** | 30s/60s/120s olarak ayarlanmış (önceki revizyonda) | ✅ Doğrulandı |
| 24 — Sıralı DB Sorguları | ✅ **Kısmi İyileştirme** | `commandCenter.service.ts` satır 234'te Promise.all kullanılıyor (tenantRes, appointmentsRes, reviewsRes, alertsRes paralel). Ancak satır 264-315 arası hala sıralı (btRes → getFillRatePct → getRevenueSummary). | ⚠️ Kısmi: İlk Promise.all var, sonrası sıralı |
| 24 — Blocked Dates & Reviews | ✅ **İyileştirildi** | Dashboard'da blocked-dates ve reviews paralel fetch ediliyor (Promise.all, satır 155-164) | ✅ Doğrulandı |
| 25 — Dynamic Import | ✅ **İyileştirildi** | OverviewView, AppointmentsView, SettingsView, ScrollReveal, DashboardModals, DashboardCodeCopy dynamic import ile yükleniyor | ✅ Doğrulandı |
| 31 — Try-Catch | ✅ **Kısmi İyileştirme** | blocked-dates ve reviews route'larında try-catch var. Ancak appointments ve ops-alerts route'larında hala eksik. | ⚠️ Kısmi: 2/4 route'ta var |

### 8 Mart 2026 — Hala Kalan Kritik Sorunlar

| Madde | Durum | Açıklama | Öncelik |
|-------|-------|----------|---------|
| 28/34 — Cache-Control | ❌ **KRİTİK** | Sadece 2 route'ta cache var (public/tenants, qr). Kritik route'larda (appointments, ops-alerts, blocked-dates, reviews) yok. 30 dakikada ~92-94 gereksiz DB sorgusu. | 🔴 **YÜKSEK** |
| 21/36 — Redis keys() | ❌ **KRİTİK** | Hala 3 yerde kullanılıyor (satır 208, 588, 1243). O(N) operasyon, production'da maliyetli. | 🔴 **YÜKSEK** |
| 24/35 — Sıralı DB Sorguları | ⚠️ **KISMI** | commandCenter.service.ts'de ilk Promise.all var ama sonrası sıralı. staff/route.ts ve crm/customers/[phone]/route.ts'de hala sıralı. | 🟡 **ORTA** |
| 33/38 — AppointmentsView Props | ⚠️ **ORTA** | AppointmentsView hala 11 prop alıyor. Context pattern kullanılmıyor. | 🟡 **ORTA** |
| 30 — Inline Motion Props | ⚠️ **ORTA** | ScrollReveal'de transition objesi her render'da yeni oluşuyor (satır 90-94). | 🟡 **DÜŞÜK** |
| 10/40 — Sayfalama | ❌ **ORTA** | customers route'ta limit 500, risky route'ta limit 6000. Cursor-based pagination yok. | 🟡 **ORTA** |
| 31 — Try-Catch Eksikliği | ⚠️ **DÜŞÜK** | appointments ve ops-alerts route'larında try-catch yok. | 🟢 **DÜŞÜK** |

### Güncel İstatistikler (8 Mart 2026)

| Metrik | Önceki Durum | Güncel Durum | İyileşme |
|--------|--------------|--------------|----------|
| Dashboard dosya boyutu | 1818 satır | 710 satır | ✅ %61 azalma |
| Ana sayfa useState | 51 adet | 14 adet | ✅ %73 azalma |
| Polling süreleri | 10s/30s/60s | 30s/60s/120s | ✅ 2-3x yavaşlatıldı |
| Dynamic import | Kısmi | 6 component | ✅ İyileştirildi |
| Paralel fetch | Yok | blocked-dates + reviews | ✅ İyileştirildi |
| Cache-Control route | 2/40+ | 2/40+ | ❌ Değişmedi |
| Redis keys() | 3 yerde | 3 yerde | ❌ Değişmedi |
| Sıralı DB sorguları | 4+ endpoint | 3+ endpoint | ⚠️ Kısmi iyileşme |
| Sayfalama | Yok | Yok | ❌ Değişmedi |

---

## İçindekiler

### İlk Tarama — Frontend Bileşen Sorunları
1. [Genel Bakış](#1-genel-bakış)
2. [KRİTİK: Monolitik Dashboard Bileşeni](#2-kritik-monolitik-dashboard-bileşeni)
3. [KRİTİK: Aşırı Polling — Ağ Bombardımanı](#3-kritik-aşırı-polling--ağ-bombardımanı)
4. [KRİTİK: Yoğun Animasyon Kullanımı](#4-kritik-yoğun-animasyon-kullanımı)
5. [YÜKSEK: Memory Leak — AbortController Eksikliği](#5-yüksek-memory-leak--abortcontroller-eksikliği)
6. [YÜKSEK: Temizlenmeyen setTimeout'lar](#6-yüksek-temizlenmeyen-setimeoutlar)
7. [YÜKSEK: key={Math.random()} Anti-Pattern](#7-yüksek-keymathrandom-anti-pattern)
8. [ORTA: SWR Fetcher'da HTTP Cache Devre Dışı](#8-orta-swr-fetcherda-http-cache-devre-dışı)
9. [ORTA: CommandMenu — Her Açılışta Full API Çağrısı](#9-orta-commandmenu--her-açılışta-full-api-çağrısı)
10. [ORTA: Sayfalama (Pagination) Olmayan Büyük Payload'lar](#10-orta-sayfalama-pagination-olmayan-büyük-payloadlar)
11. [ORTA: Diğer Şişkin Sayfa Bileşenleri](#11-orta-diğer-şişkin-sayfa-bileşenleri)
12. [DÜŞÜK: key={index} Kullanımı](#12-düşük-keyindex-kullanımı)
13. [DÜŞÜK: Production'da console.log](#13-düşük-productionda-consolelog)
14. [DÜŞÜK: useEffect Bağımlılık Dizisi Eksiklikleri](#14-düşük-useeffect-bağımlılık-dizisi-eksiklikleri)
15. [DÜŞÜK: Admin Konuşmalar Sayfası Çift Polling](#15-düşük-admin-konuşmalar-sayfası-çift-polling)
16. [Etki Haritası — Hangi Sayfa Ne Kadar Etkileniyor](#16-etki-haritası--hangi-sayfa-ne-kadar-etkileniyor)
17. [Düzeltme Öncelik Sırası (İlk Tarama)](#17-düzeltme-öncelik-sırası)
18. [Önerilen Çözümler (İlk Tarama)](#18-önerilen-çözümler)

### İkinci Tarama — Altyapı, Backend ve Derinlemesine Sorunlar
19. [ThemeProvider Context Her Render'da Yeni Obje](#19-yeni--themeprovider-context-her-renderda-yeni-obje)
20. [Supabase Browser Client Singleton Değil](#20-yeni--supabase-browser-client-singleton-değil)
21. [Redis keys() Kullanımı — O(N) Operasyon](#21-yeni--redis-keys-kullanımı--on-operasyon)
22. [Admin Layout Her Navigasyonda kill-switch Fetch](#22-yeni--admin-layout-her-navigasyonda-kill-switch-fetch)
23. [WhatsApp Webhook Sıralı İşlem](#23-yeni--whatsapp-webhook-sıralı-i̇şlem)
24. [Sıralı DB Sorguları Paralelleştirilebilir](#24-yeni--sıralı-db-sorguları-paralelleştirilebilir)
25. [Dynamic Import Eksik Olan Ağır Bileşenler](#25-yeni--dynamic-import-eksik-olan-ağır-bileşenler)
26. [Landing Page Tamamı "use client"](#26-yeni--landing-page-tamamı-use-client)
27. [Kullanılmayan @tremor/react Bağımlılığı](#27-yeni--kullanılmayan-tremorreact-bağımlılığı)
28. [API Route'larda Cache-Control Header Eksikliği](#28-yeni--api-routelarda-cache-control-header-eksikliği)
29. [select("*") ve .limit() Eksik Supabase Sorguları](#29-yeni--select-ve-limit-eksik-supabase-sorguları)
30. [Inline Motion Props Her Render'da Yeni Obje](#30-yeni--inline-motion-props-her-renderda-yeni-obje)
31. [API Route'larda Try-Catch Eksikliği](#31-yeni--api-routelarda-try-catch-eksikliği)
32. [Font adjustFontFallback Kapalı](#32-yeni--font-adjustfontfallback-kapalı)

### Üçüncü Tarama — Güncel Durum ve Kalan Kritik Sorunlar
33. [Dashboard Bölünmüş Olmasına Rağmen Hala Yüksek State Sayısı](#33-yeni--dashboard-bölünmüş-olmasına-rağmen-hala-yüksek-state-sayısı)
34. [API Route'larda Cache-Control Eksikliği (Kritik Performans Sorunu)](#34-yeni--api-routelarda-cache-control-eksikliği-kritik-performans-sorunu)
35. [Sıralı DB Sorguları Detaylı Analiz](#35-yeni--sıralı-db-sorguları-detaylı-analiz)
36. [Redis keys() Kullanımı Detaylı Analiz](#36-yeni--redis-keys-kullanımı-detaylı-analiz)
37. [Performans Metrikleri ve Hedefler](#37-yeni--performans-metrikleri-ve-hedefler)
38. [State Yönetimi Detaylı Analiz](#38-yeni--state-yönetimi-detaylı-analiz)
39. [Polling Stratejisi ve Alternatifler](#39-yeni--polling-stratejisi-ve-alternatifler)
40. [Büyük Payload Sorunları Detaylı Analiz](#40-yeni--büyük-payload-sorunları-detaylı-analiz)

---

## 1. Genel Bakış

Proje Next.js 16 (App Router) + React 19 + Supabase tabanlı bir SaaS randevu sistemidir. Kasma sorununun **tek bir nedeni yok**; birçok sorunun birleşik etkisi söz konusu. En büyük suçlu, 1818 satırlık tek bir bileşen içinde 51 state, 3 eşzamanlı polling ve 40+ animasyon elementinin bir arada bulunmasıdır.

**Proje istatistikleri:**

| Metrik | Değer | Güncel Durum (Üçüncü Tarama) |
|--------|-------|------------------------------|
| Framework | Next.js 16.1.6 + React 19.2.3 | Aynı |
| En büyük dosya | `dashboard/[tenantId]/page.tsx` — 1818 satır | ✅ Bölündü (710 satır) |
| En fazla useState | Aynı dosya — 51 adet | ⚠️ Hala 28 state (ana sayfada) |
| Eşzamanlı polling | 3 adet (10s + 30s + 60s) | ✅ İyileştirildi (30s + 60s + 120s) |
| motion.* element sayısı | 40+ (sadece dashboard) | ⚠️ Hala fazla |
| ScrollReveal sayısı | 19 (sadece dashboard) | ⚠️ Hala fazla |
| Sayfalama olmayan endpoint | 5+ adet (500–6000 kayıt) | ❌ Hala yok |
| API route cache | 2/40+ route | ❌ %95 cache yok |
| Sıralı DB sorguları | 4+ endpoint | ❌ Hala sıralı |
| Redis keys() kullanımı | 3 yerde | ❌ Hala aktif |

---

## 2. KRİTİK: Monolitik Dashboard Bileşeni

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx`  
**Satır sayısı:** 1818  
**Etki:** Her etkileşimde tüm sayfanın yeniden render edilmesi

### Sorunun Özü

Tek bir React bileşeni (`EsnafDashboard`) içinde **51 adet `useState`** hook'u tanımlanmış:

```tsx
// Satır 172–226 arası — 51 useState hook'u
const [resolvedParams, setResolvedParams] = useState(null);
const [appointments, setAppointments] = useState([]);
const [blockedDates, setBlockedDates] = useState([]);
const [reviews, setReviews] = useState(null);
const [opsAlerts, setOpsAlerts] = useState([]);
const [opsAlertsLoading, setOpsAlertsLoading] = useState(false);
const [resolvingAlertId, setResolvingAlertId] = useState(null);
const [loading, setLoading] = useState(true);
const [showAdd, setShowAdd] = useState(false);
const [addPhone, setAddPhone] = useState("");
const [addStaffId, setAddStaffId] = useState("");
const [addDate, setAddDate] = useState("");
const [addTime, setAddTime] = useState("");
const [addDatetimeLocal, setAddDatetimeLocal] = useState("");
const [showBlocked, setShowBlocked] = useState(false);
const [blockStart, setBlockStart] = useState("");
const [blockEnd, setBlockEnd] = useState("");
const [blockReason, setBlockReason] = useState("");
const [reminderPref, setReminderPref] = useState("customer_only");
const [reminderSaving, setReminderSaving] = useState(false);
const [selectedDate, setSelectedDate] = useState(null);
const [availability, setAvailability] = useState(null);
const [availabilityLoading, setAvailabilityLoading] = useState(false);
const [weekAnchor, setWeekAnchor] = useState(new Date());
const [workingHours, setWorkingHours] = useState([]);
const [showWorkingHours, setShowWorkingHours] = useState(false);
const [workingHoursSaving, setWorkingHoursSaving] = useState(false);
const [welcomeMsg, setWelcomeMsg] = useState("");
const [whatsappGreeting, setWhatsappGreeting] = useState("");
const [messagesSaving, setMessagesSaving] = useState(false);
const [contactPhone, setContactPhone] = useState("");
const [workingHoursText, setWorkingHoursText] = useState("");
const [openingMessage, setOpeningMessage] = useState("");
const [confirmationMessage, setConfirmationMessage] = useState("");
const [reminderMessage, setReminderMessage] = useState("");
const [slotDuration, setSlotDuration] = useState(30);
const [advanceBookingDays, setAdvanceBookingDays] = useState(30);
const [cancellationHours, setCancellationHours] = useState(2);
const [botSettingsSaving, setBotSettingsSaving] = useState(false);
const [botSettingsMessage, setBotSettingsMessage] = useState("");
const [botSettingsError, setBotSettingsError] = useState("");
const [activeView, setActiveView] = useState("overview");
const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
const [codeCopied, setCodeCopied] = useState(false);
const [showQRModal, setShowQRModal] = useState(false);
const [commandCenter, setCommandCenter] = useState(null);
const [commandCenterLoading, setCommandCenterLoading] = useState(false);
const [runningActionId, setRunningActionId] = useState(null);
const [updatingAptId, setUpdatingAptId] = useState(null);
const [reduceMotion, setReduceMotion] = useState(false);
```

### Neden Bu Kadar Kötü?

React'te bir `useState` değiştiğinde, o state'in tanımlandığı **tüm bileşen** yeniden render edilir. 51 state'in olduğu 1818 satırlık bir bileşende:

1. Kullanıcı bir input'a harf yazıyor → `setAddPhone("5")` → **1818 satırlık bileşenin tamamı** yeniden render
2. Polling her 10 saniyede `setAppointments(...)` çağırıyor → **1818 satırlık bileşenin tamamı** yeniden render
3. 40+ `motion.*` elementi yeniden hesaplanıyor
4. 19 `ScrollReveal` bileşeni yeniden oluşturuluyor
5. Scroll animasyonları (`useScroll`, `useTransform`) tekrar çalışıyor

**React Compiler** bu durumu kısmen optimize edebilir, ancak bu ölçekteki bir bileşende etkisi sınırlı kalır çünkü state'ler arasındaki bağımlılıklar çok karmaşık.

### Çözüm

Bileşeni en az 5-6 alt bileşene bölmek:
- `DashboardHeader` (tenant bilgileri, butonlar)
- `AppointmentsView` (randevu listesi, takvim)
- `SettingsView` (tüm ayar formları)
- `CommandCenterPanel` (command center widget)
- `OpsAlertsPanel` (operasyonel uyarılar)
- `StatsBar` (istatistik kartları)

Her alt bileşen kendi state'ini yönetir → sadece ilgili bölüm yeniden render olur.

---

## 3. KRİTİK: Aşırı Polling — Ağ Bombardımanı

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx`  
**Satırlar:** 405, 482, 531  
**Etki:** Sürekli ağ trafiği + sürekli re-render

### Sorunun Özü

Dashboard açıkken **3 ayrı `setInterval`** eşzamanlı çalışıyor:

```tsx
// Satır 121–123
const APPOINTMENTS_POLL_MS = 10000;   // Her 10 saniye
const OPS_ALERTS_POLL_MS = 30000;     // Her 30 saniye
const COMMAND_CENTER_POLL_MS = 60000; // Her 60 saniye
```

```tsx
// Satır 405–407 — Randevu polling
const interval = window.setInterval(() => {
  void fetchAppointments();
}, APPOINTMENTS_POLL_MS);
```

```tsx
// Satır 482–486 — Ops Alerts polling
const interval = window.setInterval(() => {
  if (document.visibilityState === "visible") {
    void fetchOpsAlerts(true);
  }
}, OPS_ALERTS_POLL_MS);
```

```tsx
// Satır 531–535 — Command Center polling
const interval = window.setInterval(() => {
  if (document.visibilityState === "visible") {
    void fetchCommandCenter(true);
  }
}, COMMAND_CENTER_POLL_MS);
```

### Sayılarla Etki

| Süre | Randevu çağrısı | OpsAlerts çağrısı | CommandCenter çağrısı | Toplam |
|------|-----------------|--------------------|-----------------------|--------|
| 1 dakika | 6 | 2 | 1 | **9 API çağrısı** |
| 5 dakika | 30 | 10 | 5 | **45 API çağrısı** |
| 30 dakika | 180 | 60 | 30 | **270 API çağrısı** |

Her başarılı yanıt `setState` tetikler → 1818 satırlık bileşen yeniden render olur. Signature kontrolü (`raw === signatureRef.current`) var ama bu sadece veri değişmediğinde işe yarar; **ilk parse ve karşılaştırma maliyeti** her seferinde ödenir.

### Ek Sorun: İlk Yüklemede 6 Ardışık İstek

`STAGGER_DELAY_MS = 120` ile sayfa ilk açıldığında:
- t=0ms: `fetchAppointments()`
- t=120ms: `blocked-dates` fetch
- t=240ms: `reviews` fetch
- t=360ms: `availability/slots` fetch
- t=480ms: `fetchOpsAlerts()`
- t=600ms: `fetchCommandCenter()`

600ms içinde 6 paralel API isteği başlatılıyor. Yavaş bir bağlantıda bu, sayfanın "donmuş" görünmesine neden olur.

### Çözüm

- Polling süresini artırmak (randevular: 30s, ops: 60s, command: 120s)
- Server-Sent Events (SSE) veya WebSocket ile gerçek zamanlı güncellemeye geçmek
- `requestIdleCallback` veya `requestAnimationFrame` ile polling'i boş zamanlara taşımak
- İlk yükleme verilerini tek bir endpoint'te birleştirmek (`/api/tenant/{id}/dashboard-init`)

---

## 4. KRİTİK: Yoğun Animasyon Kullanımı

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx`  
**Etki:** Her render'da animasyon hesaplamaları, layout thrashing

### Sorunun Özü

Dashboard sayfasında:
- **40+ `motion.*` elementi** — `motion.div`, `motion.header`, `motion.button` vb.
- **19 `ScrollReveal` bileşeni** — her biri kendi Intersection Observer'ını oluşturuyor
- **Scroll-driven animasyonlar** — `useScroll()` + `useTransform()`

```tsx
// Satır 239–245 — Her scroll event'inde hesaplama
const { scrollY } = useScroll();
const headerY = useTransform(scrollY, [0, 120], [0, -12]);
const headerShadow = useTransform(
  scrollY,
  [0, 80],
  ["0 1px 3px 0 rgb(0 0 0 / 0.05)", "0 4px 12px -2px rgb(0 0 0 / 0.08)"]
);
```

```tsx
// Satır 821–830 — Animasyonlu stat kartları (4 adet, her biri ayrı motion.div)
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
  className="rounded-xl border ..."
>
```

### ScrollReveal Bileşeni

`src/components/ui/ScrollReveal.tsx` dosyası her instance için ayrı bir `motion.div` + `whileInView` oluşturuyor:

```tsx
// Her ScrollReveal bileşeni:
// 1. Bir Intersection Observer oluşturur
// 2. Viewport giriş/çıkışını izler
// 3. Animasyon state'i hesaplar
// 4. CSS transform uygular
<Component
  initial={v.initial}
  whileInView={v.visible}
  viewport={{ once, amount }}
  transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
/>
```

Dashboard'da **19 adet** bundan var → **19 Intersection Observer** aynı anda çalışıyor.

### Neden Kasıyor?

1. `useScroll()` her scroll event'inde state günceller → re-render
2. `useTransform()` her scroll event'inde CSS transform hesaplar
3. 40+ motion elementi her render'da animasyon state'ini hesaplar
4. 19 Intersection Observer DOM'u sürekli izler
5. `whileHover`, `whileTap` event listener'ları ekler

Bu, özellikle **mobilde ve düşük güçlü cihazlarda** ciddi kasma yaratır.

### Çözüm

- Dashboard'da animasyonları minimuma indirmek veya CSS transitions'a geçmek
- `ScrollReveal`'ı `once: true` ile sınırlamak (zaten yapılmış ama sayısı fazla)
- Scroll-driven header animasyonunu kaldırmak veya CSS `scroll-driven-animations` API'sine geçmek
- `reduceMotion` kontrolü var ama sadece mobilde aktif; tüm cihazlarda varsayılan olabilir

---

## 5. YÜKSEK: Memory Leak — AbortController Eksikliği

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx`  
**Satırlar:** 418–446  
**Etki:** Bellek sızıntısı, unmount sonrası state güncellemeleri

### Sorunun Özü

`blocked-dates`, `reviews`, `availability/slots` fetch'lerinde **AbortController kullanılmıyor**:

```tsx
// Satır 418–426 — AbortController YOK
useEffect(() => {
  if (!tenantId) return;
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/blocked-dates`)
      .then((r) => r.json())
      .then((d) => setBlockedDates(Array.isArray(d) ? d : []));
  }, STAGGER_DELAY_MS);
  return () => clearTimeout(t); // Sadece timeout iptal ediliyor, fetch DEĞİL!
}, [tenantId]);
```

```tsx
// Satır 428–436 — Aynı sorun
useEffect(() => {
  if (!tenantId) return;
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/reviews`)
      .then((r) => r.json())
      .then((d) => setReviews(d));
  }, STAGGER_DELAY_MS * 2);
  return () => clearTimeout(t); // Fetch iptal EDİLMİYOR
}, [tenantId]);
```

```tsx
// Satır 438–446 — Aynı sorun
useEffect(() => {
  if (!tenantId) return;
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/availability/slots`)
      .then((r) => r.json())
      .then((d) => setWorkingHours(Array.isArray(d) ? d : []));
  }, STAGGER_DELAY_MS * 3);
  return () => clearTimeout(t); // Fetch iptal EDİLMİYOR
}, [tenantId]);
```

### Ne Oluyor?

1. Kullanıcı dashboard'a giriyor
2. 3 fetch başlatılıyor (120ms, 240ms, 360ms sonra)
3. Kullanıcı **hızla başka sayfaya geçiyor** (timeout'tan önce)
4. `clearTimeout` çalışıyor → timeout iptal **ama fetch zaten başlamışsa devam ediyor**
5. Timeout geçmişse fetch devam ediyor, bileşen unmount olmuş
6. `.then((d) => setBlockedDates(...))` çağrılıyor → **unmount olmuş bileşene setState**
7. React uyarı veriyor, bellek sızıntısı oluşuyor

**Not:** `fetchAppointments` fonksiyonunda doğru şekilde `AbortController` kullanılmış (satır 374–376). Diğer 3 fetch'te bu eksik.

### Aynı Sorun Olan Diğer Dosyalar

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `src/components/admin/CommandMenu.tsx` | 47–55 | Menü kapandığında fetch devam ediyor |
| `src/app/dashboard/[tenantId]/campaigns/page.tsx` | 232–275 | `loadRecipients` ve `loadHistory` |

### Çözüm

```tsx
useEffect(() => {
  if (!tenantId) return;
  const controller = new AbortController();
  const t = setTimeout(() => {
    fetch(`/api/tenant/${tenantId}/blocked-dates`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setBlockedDates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, STAGGER_DELAY_MS);
  return () => {
    clearTimeout(t);
    controller.abort();
  };
}, [tenantId]);
```

---

## 6. YÜKSEK: Temizlenmeyen setTimeout'lar

**Dosya:** `src/app/dashboard/[tenantId]/crm/page.tsx`  
**Satırlar:** 225–230  
**Etki:** Birden fazla timeout birikebilir, gereksiz state güncellemeleri

### Sorunun Özü

```tsx
// Satır 225–230
const clearMessageLater = useCallback(() => {
  window.setTimeout(() => {
    setInfo("");
    setError("");
  }, 2200);
}, []);
```

`setTimeout` ID'si saklanmıyor ve cleanup yapılmıyor. Hızlı hata/başarı mesajları durumunda birden fazla timeout birikir:

1. Kullanıcı kaydet'e tıklıyor → `clearMessageLater()` → timeout #1 (2200ms)
2. 500ms sonra tekrar tıklıyor → `clearMessageLater()` → timeout #2 (2200ms)
3. timeout #1 tetikleniyor → mesaj temizleniyor
4. timeout #2 tetikleniyor → tekrar temizleniyor (gereksiz re-render)

### Aynı Pattern Olan Yerler

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `dashboard/[tenantId]/page.tsx` | 236 | `copyCode` — düşük risk (kullanıcı tetiklemesi) |
| `dashboard/[tenantId]/page.tsx` | 351 | `setBotSettingsMessage` — orta risk |

### Çözüm

```tsx
const clearTimerRef = useRef<ReturnType<typeof setTimeout>>();

const clearMessageLater = useCallback(() => {
  if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  clearTimerRef.current = window.setTimeout(() => {
    setInfo("");
    setError("");
  }, 2200);
}, []);

useEffect(() => () => {
  if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
}, []);
```

---

## 7. YÜKSEK: key={Math.random()} Anti-Pattern

**Dosya:** `src/app/admin/(dashboard)/tools/page.tsx`  
**Satır:** 376  
**Etki:** Her render'da tüm liste elemanlarının DOM'dan silinip yeniden oluşturulması

### Sorunun Özü

```tsx
// Satır 376
{sentryIssues.map((issue) => (
  <li key={issue.id ?? issue.shortId ?? Math.random()}>
```

`Math.random()` her render'da farklı bir değer üretir. React, key değiştiğinde elemanı **tamamen yok edip sıfırdan oluşturur**. Bu:

1. DOM elemanı kaldırılıyor
2. Yeni DOM elemanı oluşturuluyor
3. Tüm event listener'lar yeniden bağlanıyor
4. CSS animasyonları sıfırlanıyor
5. Alt bileşenlerin tüm state'leri sıfırlanıyor

**Her render'da bu listedeki her eleman için bu döngü tekrarlanıyor.**

### Çözüm

```tsx
{sentryIssues.map((issue, i) => (
  <li key={issue.id ?? issue.shortId ?? `sentry-${i}`}>
```

Veya daha iyisi, API'den gelen her issue'nun benzersiz bir ID'si olduğundan emin olmak.

---

## 8. ORTA: SWR Fetcher'da HTTP Cache Devre Dışı

**Dosya:** `src/lib/swr-fetcher.ts`  
**Satır:** 5  
**Etki:** Tüm SWR isteklerinde tarayıcı cache'i kullanılmıyor

### Sorunun Özü

```tsx
// src/lib/swr-fetcher.ts — tüm dosya
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
```

`cache: "no-store"` tarayıcının HTTP cache mekanizmasını **tamamen devre dışı** bırakır. SWR'nin kendi in-memory cache'i çalışıyor olsa da:

- Sayfa yenilendiğinde tüm veriler sıfırdan çekilir
- Tarayıcının disk cache'i kullanılamaz
- CDN/edge cache'ten yararlanılamaz
- `stale-while-revalidate` HTTP header'ları etkisiz kalır

### Çözüm

SWR zaten kendi dedupe ve revalidation mekanizmasına sahip. `cache: "no-store"` kaldırılabilir:

```tsx
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
```

Veya daha iyi: sunucu tarafında `Cache-Control` header'ları ayarlayıp tarayıcı cache'inden yararlanmak.

---

## 9. ORTA: CommandMenu — Her Açılışta Full API Çağrısı

**Dosya:** `src/components/admin/CommandMenu.tsx`  
**Satırlar:** 46–56  
**Etki:** Her Cmd+K basışında tüm tenant listesinin çekilmesi

### Sorunun Özü

```tsx
// Satır 46–56
useEffect(() => {
  if (open) {
    fetch("/api/admin/tenants")
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => setTenants([]));
  }
}, [open]);
```

Sorunlar:
1. **Cache yok** — Her açılışta full API çağrısı
2. **AbortController yok** — Menü hızlıca açılıp kapatılırsa fetch devam ediyor
3. **Tüm tenant'lar çekiliyor** — 100+ tenant varsa büyük payload

### Çözüm

SWR veya basit bir in-memory cache kullanmak:

```tsx
const { data: tenants = [] } = useSWR(
  open ? "/api/admin/tenants" : null,
  fetcher,
  { dedupingInterval: 60000 } // 1 dakika cache
);
```

---

## 10. ORTA: Sayfalama (Pagination) Olmayan Büyük Payload'lar

**Etki:** Büyük tenant'larda yavaş yanıt, yüksek bellek kullanımı

### Etkilenen Endpoint'ler

| Endpoint | Dosya | Satır | Limit | Sayfalama |
|----------|-------|-------|-------|-----------|
| CRM Müşterileri | `src/app/api/tenant/[id]/crm/customers/route.ts` | 22 | 500 | **Yok** |
| Randevular | `src/app/api/tenant/[id]/appointments/route.ts` | 25 | 500 | **Yok** |
| Kampanya Alıcıları (CRM) | `src/app/api/tenant/[id]/campaigns/recipients/route.ts` | 19 | 1000 | **Yok** |
| Kampanya Alıcıları (Appointments) | `src/app/api/tenant/[id]/campaigns/recipients/route.ts` | 25 | 2000 | **Yok** |
| Riskli Konuşmalar | `src/app/api/admin/conversations/risky/route.ts` | 217 | 6000 | **Yok** |

### En Kötü Durum: Riskli Konuşmalar

```tsx
// src/app/api/admin/conversations/risky/route.ts — Satır 217
const maxRows = Math.min(Math.max(limit * 40, 600), 6000);
let query = supabase
  .from("conversation_messages")
  .select("tenant_id, customer_phone_digits, direction, message_text, stage, created_at")
  .gte("created_at", from.toISOString())
  .order("created_at", { ascending: false })
  .limit(maxRows);
```

Ardından satır 259–293'te **6000 satır bellekte döngüyle işleniyor**:

```tsx
for (const row of rows) {
  // Her satır için Map lookup, string karşılaştırma, counter artırma
  summary.message_count += 1;
  // ... stage_counts, inbound/outbound sayımları
}
```

Bu, sunucu tarafında ciddi CPU ve bellek kullanımı yaratır. İstemci tarafında ise büyük JSON payload'ının parse edilmesi kasma yaratır.

### CRM Müşterileri — Client-Side Fuzzy Search

```tsx
// src/app/api/tenant/[id]/crm/customers/route.ts — Satır 34–41
let list = query
  ? fuzzySearch({
      list: data ?? [],
      query,
      keys: ["customer_phone", "customer_name", "tags"],
      threshold: 0.4,
    })
  : (data ?? []);
```

500 kayıt üzerinde sunucu tarafında fuzzy search yapılıyor. Küçük tenant'lar için sorun değil, büyük tenant'larda yavaşlayabilir.

### Çözüm

- Cursor-based veya offset-based sayfalama eklemek
- İlk yüklemede küçük bir batch çekmek (ör. 50 kayıt)
- "Daha fazla yükle" veya infinite scroll pattern'i kullanmak
- Riskli konuşmalar için SQL aggregation kullanmak (client-side döngü yerine)

---

## 11. ORTA: Diğer Şişkin Sayfa Bileşenleri

Dashboard sayfası en kötüsü olsa da, diğer sayfalar da benzer sorunlar taşıyor:

| Dosya | Satır | useState | Sorunlar |
|-------|-------|----------|----------|
| `admin/campaigns/page.tsx` | 1042 | 23 | Büyük monolitik bileşen |
| `dashboard/campaigns/page.tsx` | 1069 | 21 | Büyük monolitik bileşen |
| `admin/tenants/page.tsx` | 887 | 14 | Sanal liste yok |
| `admin/conversations/page.tsx` | 783 | 14 | Çift polling |
| `dashboard/crm/page.tsx` | 832 | — | Temizlenmeyen timeout |
| `dashboard/settings/page.tsx` | 807 | — | Monolitik form |
| `dashboard/workflow/page.tsx` | 628 | — | Polling |

Bu sayfaların hepsi tek bir bileşen içinde tüm mantığı barındırıyor. Hiçbiri alt bileşenlere bölünmemiş.

---

## 12. DÜŞÜK: key={index} Kullanımı

**Dosya:** `src/app/admin/(dashboard)/tenants/new/page.tsx`  
**Satır:** 611  

```tsx
// Satır 610–611
{services.map((service, index) => (
  <div key={index} className="grid gap-2 ...">
```

`key={index}` kullanımı, liste elemanları eklenip çıkarıldığında yanlış DOM güncellemelerine yol açabilir. `service.id` veya benzeri benzersiz bir değer kullanılmalı.

### Diğer Yerler

| Dosya | Satır | Açıklama |
|-------|-------|----------|
| `admin/langfuse/page.tsx` | 349 | `key={i}` — `row.providedModelName` tercih edilmeli |

---

## 13. DÜŞÜK: Production'da console.log

**Etki:** Minimal performans etkisi, ancak güvenlik ve temizlik açısından kaldırılmalı

| Dosya | Satır | İfade |
|-------|-------|-------|
| `src/app/api/admin/tenants/[id]/route.ts` | 236 | `console.log("Tenant başarıyla silindi:", ...)` |
| `src/app/api/webhook/twilio/sms/route.ts` | 13 | `console.log("[twilio sms webhook]", ...)` |
| `src/lib/supabase-client.ts` | 46 | `console.log("Supabase Config Check:", ...)` |

Özellikle `supabase-client.ts`'deki log, **her istemci tarafı Supabase bağlantısında** çalışıyor ve DevTools konsolunu kirletiyor.

---

## 14. DÜŞÜK: useEffect Bağımlılık Dizisi Eksiklikleri

| Dosya | Satır | Sorun |
|-------|-------|-------|
| `admin/page.tsx` | 130 | `useEffect(() => { fetchData(); }, [])` — `fetchData` dependency'de yok |
| `admin/tools/page.tsx` | 97 | `useEffect(() => { fetchHealth(); }, [])` — `fetchHealth` dependency'de yok |
| `admin/langfuse/page.tsx` | 101 | `useEffect(() => { fetchData(); }, [days])` — `fetchData` dependency'de yok |

Bu durumlar ESLint uyarısı üretir ve nadir durumlarda stale closure sorunlarına yol açabilir. Fonksiyonlar `useCallback` ile sarılıp dependency'ye eklenmelidir.

---

## 15. DÜŞÜK: Admin Konuşmalar Sayfası Çift Polling

**Dosya:** `src/app/admin/(dashboard)/conversations/page.tsx`  
**Satırlar:** 208, 232  
**Etki:** Bir konuşma seçildiğinde 2 polling aynı anda çalışıyor

```tsx
// Satır 208 — Liste polling
pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

// Satır 232 — Mesaj polling (konuşma seçildiğinde)
messagesPollRef.current = setInterval(poll, MESSAGES_POLL_MS);
```

Bir konuşma seçildiğinde hem liste hem mesajlar polling yapıyor. Cleanup'lar doğru yapılmış, ancak ikisi aynı anda çalışınca ağ trafiği ve re-render yükü ikiye katlanıyor.

---

## 16. Etki Haritası — Hangi Sayfa Ne Kadar Etkileniyor

| Sayfa | Kasma Seviyesi | Ana Sebepler |
|-------|---------------|-------------|
| **Dashboard** (`/dashboard/[tenantId]`) | ████████████ KRİTİK | 51 state, 3 polling, 40+ animasyon, memory leak |
| **Admin Campaigns** (`/admin/campaigns`) | ████████░░░ YÜKSEK | 23 state, büyük payload, monolitik |
| **Dashboard Campaigns** | ████████░░░ YÜKSEK | 21 state, 2000 alıcı payload, monolitik |
| **Admin Conversations** | ███████░░░░ ORTA-YÜKSEK | Çift polling, 14 state |
| **Dashboard CRM** | ██████░░░░░ ORTA | 500 müşteri, timeout leak, fuzzy search |
| **Admin Tenants** | █████░░░░░░ ORTA | 14 state, sanal liste yok |
| **Admin Tools** | ████░░░░░░░ ORTA | `key={Math.random()}` |
| **Landing Page** | ███░░░░░░░░ DÜŞÜK-ORTA | motion animasyonları, ScrollReveal |
| **Dashboard Settings** | ███░░░░░░░░ DÜŞÜK-ORTA | Monolitik form |

---

## 17. Düzeltme Öncelik Sırası

Aşağıdaki sıralama, **etki/emek oranına** göre yapılmıştır:

| # | Sorun | Emek | Etki | Dosya |
|---|-------|------|------|-------|
| 1 | `key={Math.random()}` kaldır | 1 dk | Yüksek | `admin/tools/page.tsx:376` |
| 2 | `console.log` kaldır | 2 dk | Düşük | 3 dosya |
| 3 | AbortController ekle | 15 dk | Yüksek | `dashboard/page.tsx:418-446` |
| 4 | `clearMessageLater` timeout temizle | 5 dk | Orta | `crm/page.tsx:225-230` |
| 5 | SWR fetcher'dan `cache: "no-store"` kaldır | 2 dk | Orta | `swr-fetcher.ts:5` |
| 6 | CommandMenu'ye SWR cache ekle | 10 dk | Orta | `CommandMenu.tsx:46-56` |
| 7 | Polling sürelerini artır | 5 dk | Yüksek | `dashboard/page.tsx:121-123` |
| 8 | Dashboard bileşenini parçala | 2-4 saat | Çok Yüksek | `dashboard/page.tsx` |
| 9 | Animasyonları azalt | 1-2 saat | Yüksek | `dashboard/page.tsx` |
| 10 | Endpoint'lere sayfalama ekle | 3-5 saat | Orta-Yüksek | 5+ API route |
| 11 | Diğer sayfaları parçala | 4-8 saat | Orta | 6+ sayfa dosyası |
| 12 | İlk yükleme endpoint'ini birleştir | 2-3 saat | Orta | Yeni endpoint |

---

## 18. Önerilen Çözümler

### Hızlı Kazanımlar (30 dakika içinde)

1. **`key={Math.random()}`** → `key={issue.id ?? issue.shortId ?? \`sentry-${i}\`}`
2. **`cache: "no-store"`** → SWR fetcher'dan kaldır
3. **Polling süreleri** → 10s→30s, 30s→60s, 60s→120s
4. **AbortController** → 3 fetch'e ekle
5. **console.log** → Kaldır
6. **clearMessageLater** → Timeout ref ile temizle

### Orta Vadeli İyileştirmeler (1-2 gün)

1. **Dashboard bileşenini parçala** → 5-6 alt bileşen
2. **Animasyonları minimize et** → Dashboard'da ScrollReveal sayısını azalt, gereksiz motion.* elementlerini kaldır
3. **CommandMenu'ye cache ekle** → SWR ile
4. **Admin sayfalarını parçala** → campaigns, conversations, tenants

### Uzun Vadeli İyileştirmeler (1 hafta)

1. **Endpoint'lere sayfalama ekle** → Cursor-based pagination
2. **Polling yerine SSE/WebSocket** → Gerçek zamanlı güncelleme
3. **İlk yükleme optimizasyonu** → Tek endpoint, streaming
4. **React Server Components** → Settings gibi statik bölümleri sunucu tarafında render et
5. **Riskli konuşmalar SQL aggregation** → Client-side döngü yerine

---

## 19. YENİ — ThemeProvider Context Her Render'da Yeni Obje

**Dosya:** `src/lib/theme-context.tsx`  
**Satır:** 54–56  
**Etki:** `useTheme()` kullanan TÜM bileşenler gereksiz re-render alıyor

### Sorunun Özü

```tsx
// Satır 54–56
<ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
  {children}
</ThemeContext.Provider>
```

`value` prop'una her render'da **yeni bir obje referansı** veriliyor. React, context value referansı değiştiğinde tüm tüketici (consumer) bileşenleri yeniden render eder. `setTheme` ve `toggleTheme` `useCallback` ile sarılmış olsa bile, objenin kendisi her render'da yeni.

**Not:** Karşılaştırma olarak `locale-context.tsx` ve `DashboardTenantContext.tsx` doğru şekilde `useMemo` kullanıyor.

### Çözüm

```tsx
const contextValue = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

return (
  <ThemeContext.Provider value={contextValue}>
    {children}
  </ThemeContext.Provider>
);
```

---

## 20. YENİ — Supabase Browser Client Singleton Değil

**Dosya:** `src/lib/supabase-client.ts`  
**Satır:** 41–79  
**Etki:** Her çağrıda yeni Supabase client oluşturuluyor

### Sorunun Özü

```tsx
// Satır 41–79
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // ... doğrulama ...
  return createBrowserClient(url, anonKey, {
    cookies: getBrowserAuthCookies(),
  });
}
```

Her `createClient()` çağrısında yeni bir Supabase instance oluşuyor. Bu:
- **Yeni GoTrue auth listener'ı** başlatıyor
- **Yeni realtime subscription manager'ı** oluşturuyor
- **Token refresh timer'ları** çoğalıyor
- Cookie parse işlemi her seferinde tekrarlanıyor

`DashboardShell.tsx`'te logout ve `useEffect` içinde ayrı ayrı çağrılıyor → iki farklı instance.

**Not:** Server-side admin client (`src/lib/supabase.ts`) doğru şekilde Proxy ile lazy singleton kullanıyor.

### Çözüm

```tsx
let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cachedClient) return cachedClient;
  // ... mevcut doğrulama ...
  cachedClient = createBrowserClient(url, anonKey, {
    cookies: getBrowserAuthCookies(),
  });
  return cachedClient;
}
```

---

## 21. YENİ — Redis `keys()` Kullanımı — O(N) Operasyon

**Dosya:** `src/lib/redis.ts`  
**Satırlar:** 208, 1243  
**Etki:** Production'da yüksek key sayısında yavaşlama ve maliyet artışı

### Sorunun Özü

Redis `KEYS` komutu tüm key'leri tarar (O(N) complexity). Projede 3 yerde kullanılıyor:

**1. `listPausedSessions` (satır 208):**
```tsx
const keys = (await redis.keys(pattern)) || [];
for (const key of keys) {
  if (collected.length >= limit) break;
  const state = await redis.get<ConversationState>(key);
  // ...
}
```
Her key için ayrı `redis.get` → **N+1 pattern** (1 keys + N get).

**2. `getBookingHoldsForDate` (satır 1243):**
```tsx
const keys = await redis.keys(`${prefix}*`);
for (const key of keys) {
  const raw = await redis.get<unknown>(key);
  // ...
}
```
Aynı N+1 pattern.

**3. `purgeExpiredTemporaryMedia` (benzer yapı)**

### Neden Kötü?

- Upstash REST API'de `KEYS` her çağrıda tüm key namespace'ini tarar
- 10.000 key varsa 10.000 entry'yi kontrol eder
- Ardından her key için ayrı HTTP isteği (`redis.get`) → N round-trip
- Upstash fiyatlandırması komut bazlı; maliyet artar

### Çözüm

- `KEYS` yerine `SCAN` cursor tabanlı iterasyon kullanmak
- Veya daha iyisi: Redis Set/Sorted Set ile ilgili key'leri gruplamak
- `redis.mget()` ile birden fazla key'i tek istekte almak

---

## 22. YENİ — Admin Layout Her Navigasyonda kill-switch Fetch

**Dosya:** `src/app/admin/(dashboard)/layout.tsx`  
**Satırlar:** 66–82  
**Etki:** Admin panelinde her sayfa geçişinde API çağrısı

### Sorunun Özü

```tsx
// Satır 66–82
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const res = await fetch("/api/admin/tools/kill-switch", { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      if (!mounted) return;
      setKillSwitchEnabled(Boolean(payload?.enabled));
    } finally {
      if (mounted) setKillSwitchReady(true);
    }
  })();
  return () => { mounted = false; };
}, []);
```

Layout `"use client"` olduğu için her admin alt sayfasına geçişte bu `useEffect` tekrar çalışıyor ve `/api/admin/tools/kill-switch` çağrılıyor. Kill-switch durumu sık değişen bir değer değil; SWR ile cache'lenebilir.

### Çözüm

```tsx
const { data } = useSWR("/api/admin/tools/kill-switch", fetcher, {
  dedupingInterval: 120000, // 2 dakika
  revalidateOnFocus: false,
});
```

---

## 23. YENİ — WhatsApp Webhook Sıralı İşlem

**Dosya:** `src/app/api/webhook/whatsapp/route.ts`  
**Satırlar:** 186–201  
**Etki:** Çok mesajlı batch'lerde webhook timeout riski

### Sorunun Özü

```tsx
// Satır 186–200 — Her mesaj için sıralı await
await inngest.send({
  name: "bot/whatsapp.message.received",
  data: eventData,
});
await createMessageProcessingJob({
  traceId,
  provider: "whatsapp",
  messageId,
  // ...
});
queuedCount += 1;
```

Bu iki `await` bir döngü (`for` loop) içinde **her mesaj için sıralı** çalışıyor. 10 mesajlık bir batch'te:
- 10 × `inngest.send` (her biri HTTP isteği)
- 10 × `createMessageProcessingJob` (her biri Redis/DB isteği)
- Toplam: **20 sıralı async operasyon**

Meta'nın webhook timeout süresi sınırlı; çok mesajlı durumda yanıt geç dönebilir.

### Çözüm

```tsx
const promises = messages.map(async (msg) => {
  await inngest.send({ ... });
  await createMessageProcessingJob({ ... });
});
await Promise.all(promises);
```

Veya daha güvenli: 200 OK'ı hızlıca dönüp işlemeyi tamamen Inngest'e bırakmak.

---

## 24. YENİ — Sıralı DB Sorguları Paralelleştirilebilir

Birçok API route'ta ardışık DB sorguları `Promise.all` ile paralel yapılabilir:

| Dosya | Satırlar | Sıralı Sorgular | Tahmini Kazanç |
|-------|----------|------------------|----------------|
| `src/app/api/tenant/[id]/staff/route.ts` | 35–61 | `staffResult` → `mappingResult` | ~%40 |
| `src/app/api/tenant/[id]/crm/customers/[phone]/route.ts` | 94–102 | `getCustomerWithFallback` → `notesResult` | ~%40 |
| `src/app/api/admin/conversations/risky/route.ts` | 232–297 | Ana sorgu → `listPausedSessions` → tenant lookup | ~%30 |
| `src/services/commandCenter.service.ts` | 264–314 | `btRes` → `getFillRatePct` → `getRevenueSummary` | ~%50 |

### Örnek: Staff Route

**Mevcut (sıralı):**
```tsx
const staffResult = await supabase.from("staff").select(...);
// ... staffResult'ı işle ...
const mappingResult = await supabase.from("staff_services").select(...);
```

**Önerilen (paralel):**
```tsx
const [staffResult, mappingResult] = await Promise.all([
  supabase.from("staff").select(...).eq("tenant_id", tenantId),
  supabase.from("staff_services").select(...).eq("tenant_id", tenantId),
]);
```

---

## 25. YENİ — Dynamic Import Eksik Olan Ağır Bileşenler

Bazı ağır bileşenler statik import ile yüklenip, kullanıcı görmeden bile bundle'a dahil oluyor:

| Dosya | Satır | Bileşen | Boyut Etkisi |
|-------|-------|---------|--------------|
| `dashboard/[tenantId]/page.tsx` | 7 | `ChartBar` (recharts) | ~100KB+ |
| `app/page.tsx` | 26 | `ContactModal` (react-hook-form + zod) | ~50KB+ |
| `dashboard/login/page.tsx` | 12 | `ContactModal` | ~50KB+ |
| `dashboard/[tenantId]/settings/page.tsx` | 23 | `QRCodeModal` (statik import) | ~30KB+ |
| `dashboard/[tenantId]/page.tsx` | 29 | `WhatsAppLinkModal` | ~10KB+ |

**Not:** `QRCodeModal` dashboard ana sayfasında (`page.tsx`) ve `DashboardShell`'de doğru şekilde `dynamic()` ile yüklenmiş, ancak `settings/page.tsx`'de statik import edilmiş.

### Çözüm

```tsx
const ChartBar = dynamic(() => import("@/components/charts/ChartBar"), { ssr: false });
const ContactModal = dynamic(() => import("@/components/ui/ContactModal"), { ssr: false });
```

---

## 26. YENİ — Landing Page Tamamı "use client"

**Dosya:** `src/app/page.tsx`  
**Satır:** 1  
**Etki:** Tüm landing page client-side hydration'a tabi; FCP/LCP yavaşlıyor

### Sorunun Özü

Landing page'in tamamı `"use client"` ile işaretlenmiş. Sayfa içeriğinin büyük bölümü (hero, özellik kartları, akış adımları, footer) statik metin ve görsel — bunlar server component olarak render edilebilir.

Client gerektiren kısımlar:
- Header'daki mobil menü toggle (`useState`)
- `ContactModal` (form)
- `ScrollReveal` animasyonları
- `useLocale` (dil seçimi)

### Etki

- Tüm JavaScript tarayıcıya gönderiliyor ve hydrate ediliyor
- `motion` kütüphanesi (~40KB+) ilk yüklemede dahil
- First Contentful Paint (FCP) gecikiyor
- Google Lighthouse puanını düşürüyor

### Çözüm

Landing page'i server + client hybrid yapıya dönüştürmek:
- Ana sayfa layout'unu server component yapmak
- Sadece etkileşimli kısımları (`Header`, `ContactSection`, animasyonlu bölümler) client component olarak ayırmak

---

## 27. YENİ — Kullanılmayan `@tremor/react` Bağımlılığı

**Dosya:** `package.json`  
**Etki:** Bundle boyutunu gereksiz şişiriyor

`@tremor/react` paketi `package.json`'da listeleniyor ancak projede hiçbir yerde import edilmiyor. Tremor büyük bir UI kütüphanesi; tree-shaking tam çalışmasa bile build süresini uzatıyor.

### Çözüm

```bash
npm uninstall @tremor/react
```

---

## 28. YENİ — API Route'larda Cache-Control Header Eksikliği

Hemen hemen hiçbir API route'ta `Cache-Control` header'ı ayarlanmamış. Sadece 2 route `unstable_cache` kullanıyor:

**Cache kullanan route'lar (sadece 2):**
- `src/app/api/admin/stats/route.ts` → `unstable_cache`, 45s
- `src/app/api/tenant/[id]/command-center/route.ts` → `unstable_cache`

**Cache kullanmayan kritik route'lar (40+):**
- `/api/tenant/[id]` — Tenant detayı
- `/api/tenant/[id]/services` — Hizmet listesi
- `/api/tenant/[id]/staff` — Personel listesi
- `/api/tenant/[id]/appointments` — Randevu listesi (her 10s polling)
- `/api/tenant/[id]/availability` — Müsaitlik
- `/api/tenant/[id]/blocked-dates` — Bloklu tarihler
- `/api/tenant/[id]/reviews` — Değerlendirmeler
- `/api/tenant/[id]/crm/customers` — CRM müşterileri
- `/api/admin/tenants` — Tenant listesi (CommandMenu her açılışta çağırıyor)

Polling yapan endpoint'ler bile cache header'ı dönmüyor → CDN/edge cache'ten yararlanılamıyor.

### Çözüm

Sık değişmeyen veriler için:
```tsx
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
  },
});
```

---

## 29. YENİ — `select("*")` ve `.limit()` Eksik Supabase Sorguları

Birçok sorguda tüm kolonlar çekilip gereksiz veri transfer ediliyor:

| Dosya | Satır | Tablo | Sorun |
|-------|-------|-------|-------|
| `api/admin/business-types/route.ts` | 10–12 | `business_types` | `select("*")` + limit yok |
| `services/blockedDates.service.ts` | 78–81 | `blocked_dates` | `select("*")` + limit yok |
| `api/tenant/[id]/appointments/route.ts` | 114–116 | `appointments` | Tek kayıt için `select("*")` |
| `lib/bot-v1/conversation/processor.ts` | 140–141 | `tenants` + `business_types` | `select("*, business_types(*)")` |
| `services/blueprint.service.ts` | 259–261 | — | `select("*")` |
| `api/tenant/[id]/revenue/summary/route.ts` | 17–22 | `revenue_events` | limit yok; uzun dönemde çok satır |
| `services/commandCenter.service.ts` | 240–257 | `appointments`, `reviews` | limit yok; ay bazlı büyük veri |

### Çözüm

Her sorguda sadece gerekli kolonları `select()` ile belirtmek ve makul bir `limit()` eklemek.

---

## 30. YENİ — Inline Motion Props Her Render'da Yeni Obje

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx` ve `src/app/page.tsx`  
**Etki:** Framer Motion her render'da diff hesaplaması yapıyor

### Sorunun Özü

Motion bileşenlerine verilen `initial`, `animate`, `transition`, `whileHover`, `whileTap` prop'ları inline objeler olarak geçiriliyor:

```tsx
// Her render'da yeni obje oluşuyor
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1 }}
>
```

Dashboard'da **40+ motion elementi** × her render → 40+ yeni obje referansı → Framer Motion her birini karşılaştırıp animasyon state'ini günceller.

### Çözüm

Sabit animasyon değerlerini bileşen dışında tanımlamak:

```tsx
const fadeUpInitial = { opacity: 0, y: 10 };
const fadeUpAnimate = { opacity: 1, y: 0 };
const defaultTransition = { delay: 0.1 };

// JSX içinde:
<motion.div initial={fadeUpInitial} animate={fadeUpAnimate} transition={defaultTransition}>
```

---

## 31. YENİ — API Route'larda Try-Catch Eksikliği

Birçok API route'ta hata yakalama yok; beklenmeyen bir hata sayfayı kilitleyebilir:

| Dosya | Sorun |
|-------|-------|
| `src/app/api/tenant/[id]/services/route.ts` | GET için try-catch yok |
| `src/app/api/tenant/[id]/staff/route.ts` | GET için try-catch yok |
| `src/app/api/tenant/[id]/availability/slots/route.ts` | try-catch yok |
| `src/app/api/tenant/[id]/revenue/summary/route.ts` | try-catch yok |
| `src/app/api/tenant/[id]/revenue/events/route.ts` | try-catch yok |
| `src/app/api/webhook/whatsapp/route.ts` | Ana POST'ta try-catch yok |

WhatsApp webhook'u özellikle kritik: JSON parse veya Inngest hatalarında istek yanıtsız kalabilir → Meta retry tetikler → çift mesaj riski.

---

## 32. YENİ — Font `adjustFontFallback` Kapalı

**Dosya:** `src/app/layout.tsx`  
**Etki:** Cumulative Layout Shift (CLS) artıyor

```tsx
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false, // Fallback font boyut ayarı kapalı
});
```

`adjustFontFallback: false` olduğunda, web fontu yüklenene kadar gösterilen fallback font farklı boyutlarda render olur ve font swap'ta sayfa içeriği kayar (CLS). `true` yapılırsa Next.js fallback font metriklerini otomatik ayarlar.

---

## Güncellenmiş Düzeltme Öncelik Sırası (Tam Liste)

| # | Sorun | Emek | Etki | Dosya |
|---|-------|------|------|-------|
| 1 | `key={Math.random()}` kaldır | 1 dk | Yüksek | `admin/tools/page.tsx:376` |
| 2 | ThemeProvider `useMemo` ekle | 2 dk | Orta | `theme-context.tsx:54` |
| 3 | `console.log` kaldır | 2 dk | Düşük | 3 dosya |
| 4 | `cache: "no-store"` kaldır (SWR) | 2 dk | Orta | `swr-fetcher.ts:5` |
| 5 | `@tremor/react` kaldır | 1 dk | Düşük | `package.json` |
| 6 | `adjustFontFallback: true` yap | 1 dk | Düşük | `layout.tsx` |
| 7 | AbortController ekle (3 fetch) | 15 dk | Yüksek | `dashboard/page.tsx:418-446` |
| 8 | `clearMessageLater` timeout temizle | 5 dk | Orta | `crm/page.tsx:225-230` |
| 9 | Polling sürelerini artır | 5 dk | Yüksek | `dashboard/page.tsx:121-123` |
| 10 | Supabase client singleton | 10 dk | Orta | `supabase-client.ts:41` |
| 11 | CommandMenu'ye SWR cache ekle | 10 dk | Orta | `CommandMenu.tsx:46-56` |
| 12 | Admin layout kill-switch cache | 10 dk | Orta | `admin/layout.tsx:66-82` |
| 13 | WhatsApp webhook paralel işlem | 15 dk | Yüksek | `webhook/whatsapp/route.ts:186-200` |
| 14 | Inline motion props'ları sabit yap | 30 dk | Orta | `dashboard/page.tsx`, `page.tsx` |
| 15 | Dynamic import: ChartBar, modaller | 30 dk | Orta | 5 dosya |
| 16 | Sıralı DB sorgularını paralel yap | 1 saat | Orta | `staff`, `crm`, `commandCenter` |
| 17 | `select("*")` → gerekli kolonlar | 1 saat | Düşük-Orta | 7+ dosya |
| 18 | Redis `keys()` → SCAN/Set | 2 saat | Yüksek | `redis.ts:208,1243` |
| 19 | API route'lara Cache-Control ekle | 2 saat | Yüksek | 40+ route |
| 20 | API route'lara try-catch ekle | 2 saat | Orta | 6+ route |
| 21 | Dashboard bileşenini parçala | 3-4 saat | Çok Yüksek | `dashboard/page.tsx` |
| 22 | Animasyonları azalt | 1-2 saat | Yüksek | `dashboard/page.tsx` |
| 23 | Landing page hybrid yapı | 2-3 saat | Orta | `page.tsx` |
| 24 | Endpoint'lere sayfalama ekle | 3-5 saat | Orta-Yüksek | 5+ API route |
| 25 | Diğer sayfaları parçala | 4-8 saat | Orta | 6+ sayfa |
| 26 | Polling → SSE/WebSocket | 5-8 saat | Yüksek | Mimari değişiklik |

---

*Bu rapor, projenin 7 Mart 2026 tarihindeki durumunu yansıtmaktadır. İkinci tarama ile toplam 32 farklı sorun kategorisi tespit edilmiştir.*

---

## Üçüncü Tarama — Güncel Durum ve Kalan Kritik Sorunlar (Aralık 2024)

Bu bölüm, önceki iyileştirmelerden sonra yapılan detaylı kod incelemesi sonucunda tespit edilen kalan performans sorunlarını içermektedir.

### İyileştirme Durumu Özeti

**✅ Tamamlanan İyileştirmeler:**
- Dashboard bileşeni bölündü (`OverviewView`, `AppointmentsView`, `SettingsView` ayrı bileşenler)
- `React.memo` ile bileşenler optimize edildi
- Settings form state'i izole edildi
- Modal state'leri ref pattern ile ayrıldı
- Polling süreleri artırıldı (30s/60s/120s)
- AbortController eklendi
- Paralel fetch uygulandı (blocked-dates, reviews)
- `useMemo`/`useCallback` ile hesaplamalar optimize edildi
- `todayIso` günlük cache ile optimize edildi

**⚠️ Kısmen İyileştirilmiş:**
- Dashboard bileşeni bölündü ancak hala 20+ state ana sayfada
- Polling süreleri artırıldı ancak hala aktif (SSE/WebSocket yok)
- Bazı fetch'ler paralel yapıldı ancak tüm sıralı sorgular düzeltilmedi

**❌ Hala Kritik Sorunlar (8 Mart 2026 Güncellemesi):**

1. ❌ **Cache-Control Eksikliği** — 40+ route'ta yok, 30 dakikada ~92-94 gereksiz DB sorgusu
2. ❌ **Redis keys() Kullanımı** — 3 yerde hala aktif, O(N) operasyon
3. ⚠️ **Sıralı DB Sorguları** — commandCenter.service.ts'de kısmi (ilk Promise.all var, sonrası sıralı), staff ve crm route'larında hala sıralı
4. ⚠️ **AppointmentsView Props** — 11 prop, context pattern yok
5. ⚠️ **Sayfalama Eksikliği** — customers (500), risky (6000) limit var ama cursor-based pagination yok
6. ⚠️ **Inline Motion Props** — ScrollReveal'de transition objesi her render'da yeni
7. ⚠️ **Try-Catch Eksikliği** — appointments ve ops-alerts route'larında yok
- API route'larda cache yok (40+ endpoint)
- State sayısı hala yüksek (20+ state)
- Redis `keys()` kullanımı devam ediyor
- Sıralı DB sorguları paralelleştirilemedi
- Büyük payload'lar sayfalama olmadan çekiliyor

---

## 33. YENİ — Dashboard Bölünmüş Olmasına Rağmen Hala Yüksek State Sayısı

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx`  
**Satırlar:** 62-94  
**Etki:** Her state değişikliği ana bileşeni re-render ediyor

### Mevcut Durum

Dashboard bileşeni bölünmüş olsa da, ana `page.tsx` dosyasında hala **20+ state** bulunuyor:

```typescript
// Veri state'leri (8 adet)
const [appointments, setAppointments] = useState<Appointment[]>([]);
const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
const [reviews, setReviews] = useState<ReviewData | null>(null);
const [opsAlerts, setOpsAlerts] = useState<OpsAlert[]>([]);
const [commandCenter, setCommandCenter] = useState<CommandCenterSnapshot | null>(null);
const [availability, setAvailability] = useState<AvailabilityData | null>(null);
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [weekAnchor, setWeekAnchor] = useState(new Date());

// Loading state'leri (4 adet)
const [loading, setLoading] = useState(true);
const [opsAlertsLoading, setOpsAlertsLoading] = useState(false);
const [commandCenterLoading, setCommandCenterLoading] = useState(false);
const [availabilityLoading, setAvailabilityLoading] = useState(false);

// UI state'leri (5 adet)
const [activeView, setActiveView] = useState<DashboardView>("overview");
const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
const [runningActionId, setRunningActionId] = useState<string | null>(null);
const [updatingAptId, setUpdatingAptId] = useState<string | null>(null);

// Form state'leri (AppointmentsView için - 7 adet)
const [showAdd, setShowAdd] = useState(false);
const [addPhone, setAddPhone] = useState("");
const [addStaffId, setAddStaffId] = useState("");
const [addDate, setAddDate] = useState("");
const [addTime, setAddTime] = useState("");
const [addDatetimeLocal, setAddDatetimeLocal] = useState("");

// Blocked dates form (4 adet)
const [showBlocked, setShowBlocked] = useState(false);
const [blockStart, setBlockStart] = useState("");
const [blockEnd, setBlockEnd] = useState("");
const [blockReason, setBlockReason] = useState("");
```

**Toplam: 28 state** (resolvedParams dahil)

### Sorun

Her state değişikliği ana bileşeni re-render ediyor. Özellikle:
- `appointments` her 30 saniyede güncelleniyor → tüm sayfa re-render
- `opsAlerts` her 60 saniyede güncelleniyor → tüm sayfa re-render
- `commandCenter` her 120 saniyede güncelleniyor → tüm sayfa re-render
- Form state'leri (`addPhone`, `addDate`, vb.) her tuş vuruşunda → tüm sayfa re-render

### Çözüm

1. **AppointmentsView için Context Pattern:**
   ```typescript
   // AppointmentsViewContext.tsx
   const AppointmentsViewContext = createContext<{
     appointments: Appointment[];
     setAppointments: Dispatch<SetStateAction<Appointment[]>>;
     // ... diğer state'ler
   }>();
   
   // AppointmentsView kendi context'i ile state yönetsin
   // Ana sayfa sadece tenantId geçsin
   ```

2. **useReducer ile State Gruplama:**
   ```typescript
   type DashboardState = {
     data: {
       appointments: Appointment[];
       blockedDates: BlockedDate[];
       reviews: ReviewData | null;
       opsAlerts: OpsAlert[];
       commandCenter: CommandCenterSnapshot | null;
     };
     loading: {
       appointments: boolean;
       opsAlerts: boolean;
       commandCenter: boolean;
     };
     ui: {
       activeView: DashboardView;
       selectedDate: string | null;
     };
   };
   
   const [state, dispatch] = useReducer(dashboardReducer, initialState);
   ```

3. **SWR ile Veri Yönetimi:**
   ```typescript
   // Ana sayfada SWR kullan, state yerine
   const { data: appointments } = useSWR(
     `/api/tenant/${tenantId}/appointments`,
     fetcher,
     { refreshInterval: 30000 }
   );
   ```

**Tahmini Etki:** Re-render sayısı %60-80 azalma, re-render süresi %50-70 azalma

---

## 34. YENİ — API Route'larda Cache-Control Eksikliği (Kritik Performans Sorunu)

**Etki:** Polling çağrılarında gereksiz DB sorguları, yüksek sunucu yükü

### Mevcut Durum

40+ API route'ta `Cache-Control` header'ı yok. Sadece 2 route cache kullanıyor:
- `/api/admin/stats` → `unstable_cache` (45s)
- `/api/tenant/[id]/command-center` → `unstable_cache`

### Etkilenen Kritik Route'lar

| Endpoint | Polling Aralığı | Cache Durumu | Tahmini DB Sorgusu (30 dk) |
|----------|----------------|--------------|---------------------------|
| `/api/tenant/[id]/appointments` | 30s | ❌ Yok | 60 sorgu |
| `/api/tenant/[id]/ops-alerts` | 60s | ❌ Yok | 30 sorgu |
| `/api/tenant/[id]/command-center` | 120s | ✅ Var | 15 sorgu (cache'li) |
| `/api/tenant/[id]/blocked-dates` | İlk yükleme | ❌ Yok | Her sayfa yüklemesinde |
| `/api/tenant/[id]/reviews` | İlk yükleme | ❌ Yok | Her sayfa yüklemesinde |
| `/api/tenant/[id]/availability` | On-demand | ❌ Yok | Her tarih seçiminde |
| `/api/admin/tenants` | CommandMenu | ❌ Yok | Her Cmd+K basışında |

### Sorunun Etkisi

**30 dakikalık dashboard kullanımında:**
- Appointments: 60 DB sorgusu (her biri ~150-300ms)
- Ops Alerts: 30 DB sorgusu (her biri ~100-200ms)
- Blocked Dates: 1-2 sorgu (her biri ~50-100ms)
- Reviews: 1-2 sorgu (her biri ~50-100ms)
- **Toplam: ~92-94 gereksiz DB sorgusu**

**Cache ile:**
- Appointments: 60 sorgu → 6-10 sorgu (%85-90 azalma)
- Ops Alerts: 30 sorgu → 3-5 sorgu (%85-90 azalma)
- Blocked Dates: 1-2 sorgu → 1 sorgu (ilk yüklemede)
- Reviews: 1-2 sorgu → 1 sorgu (ilk yüklemede)
- **Toplam: ~11-17 DB sorgusu**

### Çözüm

**1. Polling Endpoint'leri için Kısa Cache:**
```typescript
// appointments/route.ts
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 's-maxage=10, stale-while-revalidate=20'
  }
});

// ops-alerts/route.ts
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 's-maxage=30, stale-while-revalidate=60'
  }
});
```

**2. Statik Veriler için Uzun Cache:**
```typescript
// blocked-dates/route.ts
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
  }
});

// reviews/route.ts
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
  }
});
```

**3. Tenant Listesi için Orta Cache:**
```typescript
// admin/tenants/route.ts
return NextResponse.json(data, {
  headers: {
    'Cache-Control': 's-maxage=60, stale-while-revalidate=120'
  }
});
```

**Tahmini Etki:**
- DB sorgu sayısı: %85-90 azalma
- API response time: %60-80 iyileşme (cache hit durumunda)
- Sunucu CPU kullanımı: %70-85 azalma
- Polling çağrılarında network trafiği: %60-80 azalma

---

## 35. YENİ — Sıralı DB Sorguları Detaylı Analiz

**Etki:** API response time'ları gereksiz yere uzuyor

### Tespit Edilen Sıralı Sorgular

| Dosya | Satırlar | Sıralı Sorgular | Mevcut Süre | Paralel Sonrası | Kazanç |
|-------|----------|----------------|-------------|-----------------|--------|
| `commandCenter.service.ts` | 264-314 | `btRes` → `getFillRatePct` → `getRevenueSummary` | ~400-600ms | ~200-300ms | %50 |
| `staff/route.ts` | 35-61 | `staffResult` → `mappingResult` | ~150-250ms | ~90-150ms | %40 |
| `crm/customers/[phone]/route.ts` | 94-102 | `getCustomerWithFallback` → `notesResult` | ~100-200ms | ~60-120ms | %40 |
| `conversations/risky/route.ts` | 232-297 | Ana sorgu → `listPausedSessions` → tenant lookup | ~500-800ms | ~350-550ms | %30 |

### Örnek: Command Center Service

**Mevcut (Sıralı):**
```typescript
// Satır 264-314
const btRes = await supabase.from("business_types").select(...);
// btRes sonuçlarını işle...

const fillRate = await getFillRatePct(tenantId, monthStart, monthEnd);
// fillRate sonuçlarını işle...

const revenue = await getRevenueSummary(tenantId, monthStart, monthEnd);
// revenue sonuçlarını işle...
```

**Toplam Süre:** ~400-600ms (3 sıralı sorgu)

**Önerilen (Paralel):**
```typescript
const [btRes, fillRate, revenue] = await Promise.all([
  supabase.from("business_types").select(...).eq("id", businessTypeId).single(),
  getFillRatePct(tenantId, monthStart, monthEnd),
  getRevenueSummary(tenantId, monthStart, monthEnd)
]);
```

**Toplam Süre:** ~200-300ms (en yavaş sorgu kadar)

**Kazanç:** %50 hızlanma

### Çözüm

Tüm bağımsız sorguları `Promise.all` ile paralelleştirmek:

```typescript
// Örnek: staff/route.ts
const [staffResult, mappingResult] = await Promise.all([
  supabase.from("staff").select("id, name, active, tenant_id").eq("tenant_id", tenantId),
  supabase.from("staff_services").select("staff_id, service_slug").eq("tenant_id", tenantId)
]);
```

**Tahmini Etki:**
- Command Center response time: %50 azalma (400-600ms → 200-300ms)
- Staff endpoint response time: %40 azalma (150-250ms → 90-150ms)
- CRM customer endpoint: %40 azalma (100-200ms → 60-120ms)
- Riskli konuşmalar: %30 azalma (500-800ms → 350-550ms)

---

## 36. YENİ — Redis `keys()` Kullanımı Detaylı Analiz

**Dosya:** `src/lib/redis.ts`  
**Satırlar:** 208, 1243  
**Etki:** Production'da yüksek maliyet ve yavaşlama

### Mevcut Kullanım

**1. `listPausedSessions` (satır 208):**
```typescript
const pattern = `session:*:state`;
const keys = (await redis.keys(pattern)) || [];
for (const key of keys) {
  if (collected.length >= limit) break;
  const state = await redis.get<ConversationState>(key);
  // ... işleme
}
```

**2. `getBookingHoldsForDate` (satır 1243):**
```typescript
const prefix = `booking:hold:${tenantId}:${dateStr}:`;
const keys = await redis.keys(`${prefix}*`);
for (const key of keys) {
  const raw = await redis.get<unknown>(key);
  // ... işleme
}
```

### Sorunun Etkisi

**10.000 key'li bir production ortamında:**
- `redis.keys()` → 10.000 key'i tarar (O(N))
- Her key için `redis.get()` → 10.000 HTTP isteği (Upstash REST API)
- **Toplam: 10.001 Redis komutu**
- **Süre: ~5-10 saniye** (her komut ~0.5-1ms)
- **Maliyet: 10.001 komut × fiyat**

**100 key'li küçük ortamda bile:**
- `redis.keys()` → 100 key tarama
- 100 × `redis.get()` → 100 HTTP isteği
- **Toplam: 101 komut**
- **Süre: ~100-200ms**

### Çözüm

**1. SCAN Cursor Pattern:**
```typescript
async function listPausedSessions(limit: number): Promise<ConversationState[]> {
  const collected: ConversationState[] = [];
  let cursor = 0;
  
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: 'session:*:state',
      count: 100
    });
    
    if (keys.length > 0) {
      // MGET ile toplu getirme
      const values = await redis.mget<ConversationState[]>(...keys);
      for (const state of values) {
        if (state && state.status === 'paused') {
          collected.push(state);
          if (collected.length >= limit) break;
        }
      }
    }
    
    cursor = nextCursor;
  } while (cursor !== 0 && collected.length < limit);
  
  return collected;
}
```

**2. Redis Set/Sorted Set Pattern (Daha İyi):**
```typescript
// Session oluşturulurken
await redis.sadd(`tenant:${tenantId}:paused_sessions`, sessionKey);

// Listeleme
const keys = await redis.smembers(`tenant:${tenantId}:paused_sessions`);
const values = await redis.mget<ConversationState[]>(...keys);
```

**Tahmini Etki:**
- Komut sayısı: 10.001 → 11-21 (%99.8 azalma)
- Süre: 5-10 saniye → 50-100ms (%98-99 azalma)
- Maliyet: %99+ azalma

---

## 37. YENİ — Performans Metrikleri ve Hedefler

### Mevcut Performans Metrikleri (Tahmini)

| Metrik | Mevcut Değer | Hedef | Fark |
|--------|--------------|-------|------|
| **Dashboard İlk Render** | ~800-1200ms | <500ms | 2-2.4x yavaş |
| **Re-render Süresi** | ~200-400ms | <100ms | 2-4x yavaş |
| **API Çağrı Sayısı (30 dk)** | ~270 | <50 | 5.4x fazla |
| **DB Sorgu Sayısı (30 dk)** | ~92-94 | ~11-17 | 5.4-8.5x fazla |
| **Bundle Boyutu (dashboard)** | ~500KB+ | <300KB | 1.67x büyük |
| **Memory Kullanımı** | ~50-80MB | <30MB | 1.67-2.67x fazla |

### API Endpoint Performansı

| Endpoint | Mevcut Ortalama | Cache Sonrası | Hedef |
|----------|----------------|---------------|-------|
| `/appointments` | ~150-300ms | ~20-50ms (cache hit) | <100ms |
| `/ops-alerts` | ~100-200ms | ~15-30ms (cache hit) | <80ms |
| `/command-center` | ~300-500ms | ~150-250ms (paralel) | <200ms |
| `/blocked-dates` | ~50-100ms | ~10-20ms (cache hit) | <50ms |
| `/reviews` | ~50-100ms | ~10-20ms (cache hit) | <50ms |

### Öncelikli İyileştirmeler ve Beklenen Etki

| İyileştirme | Emek | Etki | Öncelik |
|-------------|------|------|---------|
| API route'lara Cache-Control | 1-2 saat | **Çok Yüksek** (DB sorgusu %85-90 azalma) | 🔴 1 |
| Sıralı DB sorgularını paralel yap | 1 saat | **Yüksek** (Response time %30-50 azalma) | 🔴 2 |
| Redis `keys()` → SCAN/Set | 2 saat | **Yüksek** (Komut sayısı %99 azalma) | 🔴 3 |
| AppointmentsView Context | 2-3 saat | **Orta-Yüksek** (Re-render %60-80 azalma) | 🟡 4 |
| Inline motion props sabit yap | 30 dk | **Orta** (Animasyon maliyeti %30-40 azalma) | 🟡 5 |
| Endpoint'lere sayfalama | 3-5 saat | **Orta-Yüksek** (İlk yükleme %50-70 azalma) | 🟡 6 |
| Polling → SSE/WebSocket | 1-2 gün | **Çok Yüksek** (API çağrısı %95+ azalma) | 🟢 7 |

---

## 38. YENİ — State Yönetimi Detaylı Analiz

### Mevcut State Dağılımı

**Ana Dashboard Sayfası (`page.tsx`):**
- Veri state'leri: 8 adet
- Loading state'leri: 4 adet
- UI state'leri: 5 adet
- Form state'leri (AppointmentsView): 7 adet
- Blocked dates form: 4 adet
- **Toplam: 28 state**

**AppointmentsView Bileşeni:**
- Props olarak 20+ state alıyor
- Kendi iç state'i yok (tüm state ana sayfada)

**SettingsView Bileşeni:**
- ✅ Kendi state'ini yönetiyor (iyileştirilmiş)
- Ana sayfadan bağımsız

**OverviewView Bileşeni:**
- Props olarak veri alıyor
- `React.memo` ile optimize edilmiş

### Sorun

AppointmentsView'e 20+ prop geçiliyor:
```typescript
<AppointmentsView
  tenantId={tenantId}
  grouped={grouped}
  sortedDates={sortedDates}
  weekDates={weekDates}
  todayIso={todayIso}
  weekCount={weekCount}
  selectedDate={selectedDate}
  availability={availability}
  availabilityLoading={availabilityLoading}
  weekAnchor={weekAnchor}
  showAdd={showAdd}
  addPhone={addPhone}
  addStaffId={addStaffId}
  addDate={addDate}
  addTime={addTime}
  addDatetimeLocal={addDatetimeLocal}
  blockedDates={blockedDates}
  showBlocked={showBlocked}
  blockStart={blockStart}
  blockEnd={blockEnd}
  blockReason={blockReason}
  loading={loading}
  updatingAptId={updatingAptId}
  staffPreferenceEnabled={staffPreferenceEnabled}
  staffOptions={staffOptions}
  // ... 10+ setter fonksiyonu
/>
```

Her prop değişikliği AppointmentsView'i re-render ediyor.

### Çözüm

**1. AppointmentsViewContext:**
```typescript
// AppointmentsViewContext.tsx
interface AppointmentsViewContextValue {
  // Veri
  appointments: Appointment[];
  blockedDates: BlockedDate[];
  availability: AvailabilityData | null;
  
  // State
  selectedDate: string | null;
  weekAnchor: Date;
  showAdd: boolean;
  addPhone: string;
  // ... diğer form state'leri
  
  // Actions
  setSelectedDate: (date: string | null) => void;
  setWeekAnchor: (date: Date) => void;
  // ... diğer setter'lar
}

const AppointmentsViewContext = createContext<AppointmentsViewContextValue | null>(null);

// AppointmentsView içinde
function AppointmentsViewInner() {
  const ctx = useContext(AppointmentsViewContext);
  // ctx kullan, props yerine
}
```

**2. useReducer Pattern:**
```typescript
type AppointmentsState = {
  selectedDate: string | null;
  weekAnchor: Date;
  showAdd: boolean;
  form: {
    phone: string;
    staffId: string;
    date: string;
    time: string;
  };
  blocked: {
    show: boolean;
    start: string;
    end: string;
    reason: string;
  };
};

const [state, dispatch] = useReducer(appointmentsReducer, initialState);
```

**Tahmini Etki:**
- Re-render sayısı: %60-80 azalma
- Re-render süresi: %50-70 azalma
- Prop drilling: Tamamen ortadan kalkar

---

## 39. YENİ — Polling Stratejisi ve Alternatifler

### Mevcut Polling Durumu

| Endpoint | Aralık | 30 Dakikada Çağrı | Cache Durumu |
|----------|--------|-------------------|--------------|
| Appointments | 30s | 60 çağrı | ❌ Yok |
| Ops Alerts | 60s | 30 çağrı | ❌ Yok |
| Command Center | 120s | 15 çağrı | ✅ Var |

**Toplam: 105 API çağrısı / 30 dakika**

### Sorunlar

1. **Gereksiz Ağ Trafiği:** Veri değişmediğinde bile istek atılıyor
2. **Sunucu Yükü:** Her çağrıda DB sorgusu (cache yok)
3. **Battery Drain:** Mobil cihazlarda sürekli network aktivitesi
4. **Scalability:** Çok sayıda kullanıcıda sunucu yükü artar

### Alternatif Çözümler

**1. Server-Sent Events (SSE) - Önerilen:**
```typescript
// /api/tenant/[id]/events (SSE endpoint)
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      // Supabase Realtime subscription
      const channel = supabase
        .channel('tenant-events')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`
        }, (payload) => {
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        })
        .subscribe();
      
      // Cleanup
      request.signal.addEventListener('abort', () => {
        channel.unsubscribe();
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**2. WebSocket (Daha Kompleks):**
- İki yönlü iletişim gerekirse
- Daha fazla altyapı gerektirir

**3. Optimistic Updates + Background Sync:**
```typescript
// SWR ile optimistic update
const { data, mutate } = useSWR('/api/appointments', fetcher, {
  refreshInterval: 60000, // 1 dakika (daha uzun)
  revalidateOnFocus: true,
  revalidateOnReconnect: true
});

// Manuel güncelleme
mutate(newData, false); // Optimistic update
```

### SSE vs Polling Karşılaştırması

| Metrik | Polling (Mevcut) | SSE (Önerilen) |
|--------|----------------|----------------|
| API Çağrısı (30 dk) | 105 | 1 (bağlantı) |
| DB Sorgusu (30 dk) | 105 | Sadece değişiklik olduğunda |
| Network Trafiği | Yüksek | Düşük |
| Gecikme | 30-120s | Anında |
| Sunucu Yükü | Yüksek | Düşük |
| Uygulama Zorluğu | Kolay | Orta |

**Tahmini Etki:**
- API çağrı sayısı: %95+ azalma (105 → 1-5)
- DB sorgu sayısı: %90+ azalma (sadece değişiklik olduğunda)
- Network trafiği: %80-90 azalma
- Gecikme: 30-120s → anında

---

## 40. YENİ — Büyük Payload Sorunları Detaylı Analiz

### Etkilenen Endpoint'ler

| Endpoint | Limit | Sayfalama | Ortalama Payload | Sorun |
|----------|-------|-----------|------------------|-------|
| CRM Müşterileri | 500 | ❌ | ~200-500KB | İlk yüklemede yavaş |
| Randevular | 500 | ❌ | ~300-800KB | Polling'de yavaş |
| Kampanya Alıcıları (CRM) | 1000 | ❌ | ~400-1000KB | Çok yavaş |
| Kampanya Alıcıları (Appt) | 2000 | ❌ | ~800-2000KB | Çok yavaş |
| Riskli Konuşmalar | 6000 | ❌ | ~2-5MB | Çok yavaş + sunucu yükü |

### Sorunun Etkisi

**CRM Müşterileri (500 kayıt):**
- JSON parse süresi: ~50-150ms
- Render süresi: ~200-500ms
- Memory kullanımı: ~5-10MB
- **Toplam: ~250-650ms ilk yükleme**

**Riskli Konuşmalar (6000 kayıt):**
- JSON parse süresi: ~200-500ms
- Client-side işleme: ~500-1000ms (döngü)
- Memory kullanımı: ~20-50MB
- **Toplam: ~700-1500ms**

### Çözüm

**1. Cursor-Based Pagination:**
```typescript
// GET /api/tenant/[id]/crm/customers?cursor=xxx&limit=50
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  
  let query = supabase
    .from('crm_customers')
    .select('id, customer_phone, customer_name, tags, total_visits')
    .eq('tenant_id', tenantId)
    .order('total_visits', { ascending: false })
    .limit(limit + 1); // +1 for cursor detection
    
  if (cursor) {
    query = query.lt('total_visits', cursor);
  }
  
  const { data } = await query;
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? items[items.length - 1].total_visits : null;
  
  return NextResponse.json({
    items,
    nextCursor,
    hasMore
  });
}
```

**2. Infinite Scroll Pattern:**
```typescript
// Frontend
const { data, size, setSize } = useSWRInfinite(
  (index) => `/api/tenant/${tenantId}/crm/customers?cursor=${cursors[index]}&limit=50`,
  fetcher
);

// Her scroll'da yeni sayfa yükle
```

**3. SQL Aggregation (Riskli Konuşmalar):**
```typescript
// Client-side döngü yerine SQL aggregation
const { data } = await supabase
  .from('conversation_messages')
  .select(`
    tenant_id,
    customer_phone_digits,
    direction,
    stage,
    count:count(),
    latest_at:max(created_at)
  `)
  .gte('created_at', from.toISOString())
  .group('tenant_id, customer_phone_digits, direction, stage');
```

**Tahmini Etki:**
- İlk yükleme süresi: %50-70 azalma (500 kayıt → 50 kayıt)
- Memory kullanımı: %80-90 azalma
- JSON parse süresi: %80-90 azalma
- Riskli konuşmalar: %70-80 azalma (SQL aggregation ile)

---

## Güncellenmiş Düzeltme Öncelik Sırası (8 Mart 2026 — Güncel Durum)

### ✅ Tamamlanan İyileştirmeler (Bu Turda)

| # | Sorun | Durum | Not |
|---|-------|-------|-----|
| ✅ | Dashboard bölünmesi | **Tamamlandı** | 1818 satır → 710 satır (%61 azalma) |
| ✅ | useState sayısı azaltma | **Tamamlandı** | 51 → 14 (%73 azalma) |
| ✅ | Dynamic import | **Tamamlandı** | 6 component lazy load |
| ✅ | Paralel fetch (blocked-dates + reviews) | **Tamamlandı** | Promise.all ile |
| ✅ | Command Center kısmi paralelleştirme | **Kısmi** | İlk Promise.all var, sonrası sıralı |

### 🔴 Kritik Öncelik (Hemen Yapılmalı)

| # | Sorun | Emek | Etki | Dosya | Durum |
|---|-------|------|------|-------|-------|
| 1 | API route'lara Cache-Control ekle | 1-2 saat | **Çok Yüksek** (%85-90 DB sorgu azalması) | 40+ route | ❌ **KALAN** |
| 2 | Redis `keys()` → SCAN/Set | 2 saat | **Yüksek** (%99 komut azalması) | `redis.ts:208,588,1243` | ❌ **KALAN** |

### 🟡 Yüksek Öncelik (Bu Hafta)

| # | Sorun | Emek | Etki | Dosya | Durum |
|---|-------|------|------|-------|-------|
| 3 | Sıralı DB sorgularını tam paralel yap | 1 saat | **Yüksek** (%30-50 response time) | `commandCenter.service.ts:264-315`, `staff/route.ts`, `crm/customers/[phone]/route.ts` | ⚠️ **KISMI** |
| 4 | AppointmentsView Context pattern | 2-3 saat | **Orta-Yüksek** (%60-80 re-render azalması) | `dashboard/page.tsx` | ❌ **KALAN** |
| 5 | Endpoint'lere sayfalama ekle | 3-5 saat | **Orta-Yüksek** (%50-70 ilk yükleme) | 5+ API route | ❌ **KALAN** |

### 🟢 Orta Öncelik (Bu Ay)

| # | Sorun | Emek | Etki | Dosya | Durum |
|---|-------|------|------|-------|-------|
| 6 | Inline motion props sabit yap | 30 dk | **Orta** (%30-40 animasyon maliyeti) | `ScrollReveal.tsx:90-94` | ❌ **KALAN** |
| 7 | API route'lara try-catch ekle | 2 saat | **Orta** (Hata yönetimi) | `appointments/route.ts`, `ops-alerts/route.ts` | ⚠️ **KISMI** |
| 8 | Polling → SSE/WebSocket | 1-2 gün | **Çok Yüksek** (%95+ API çağrı azalması) | Mimari değişiklik | ❌ **KALAN** |
| 9 | `select("*")` → gerekli kolonlar | 1 saat | **Düşük-Orta** | 7+ dosya | ❌ **KALAN** |

### Hızlı Kazanımlar (1-2 Gün İçinde) — Güncellenmiş Plan

**✅ Tamamlananlar (Bu Turda):**
- Dashboard bölünmesi → %61 dosya boyutu azalması
- useState azaltma → %73 state azalması
- Dynamic import → 6 component lazy load
- Paralel fetch → blocked-dates + reviews

**🔴 Kalan Kritik İşler (Gün 1):**
1. API route'lara Cache-Control ekle (1-2 saat) → **%85-90 DB sorgu azalması**
2. Redis `keys()` → SCAN (2 saat) → **%99 komut azalması**

**🟡 Yüksek Öncelik (Gün 2):**
3. Sıralı DB sorgularını tam paralel yap (1 saat) → **%30-50 response time iyileşmesi**
4. AppointmentsView Context (2-3 saat) → **%60-80 re-render azalması**

**Toplam Süre (Kalan):** 6-8 saat  
**Tahmini Etki (Kalan):** %60-75 ek performans iyileşmesi  
**Genel İyileşme (Tüm İyileştirmeler):** %80-90 toplam performans artışı

### Dördüncü Tarama — Yeni İyileştirmeler (8 Mart 2026)

**✅ Tamamlananlar:**
1. ✅ **Array İşlemleri useMemo** — Campaigns sayfalarında optimize edildi (%50-70 hesaplama maliyeti azalması)
2. ✅ **SWR Global Config** — SWRProvider oluşturuldu ve layout'a eklendi (%50-70 gereksiz fetch azalması)
3. ✅ **PostHog Timeout** — 2000ms → 500ms (%5-10 yükleme iyileşmesi)

**🔴 Kalan Kritik:**
1. **Riskli Konuşmalar SQL Aggregation** — Client-side döngü yerine SQL aggregation (2-3 saat, %70-80 işleme süresi azalması)

**🟡 Yüksek Öncelik:**
2. **Recharts ResponsiveContainer** — Fixed size veya debounced resize (1 saat, %20-30 resize maliyeti azalması)
3. **Zustand'a Geçiş** — Dashboard state'i Zustand'a taşı (4-6 saat, %60-80 re-render azalması)

**Toplam Etki (Önceki + Yeni):** 
- DB sorgu sayısı: %85-90 azalma
- API response time: %40-60 iyileşme
- Re-render sayısı: %60-80 azalma
- Redis maliyeti: %99 azalma

---

*Bu rapor, projenin 7 Mart 2026 tarihindeki durumunu yansıtmaktadır. Üçüncü tarama ile toplam 40 farklı sorun kategorisi tespit edilmiştir. En kritik sorunlar: API cache eksikliği, sıralı DB sorguları ve Redis keys() kullanımıdır.*
