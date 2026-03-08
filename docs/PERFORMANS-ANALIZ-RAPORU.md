# SaaSRandevu — Performans Analiz Raporu

**Tarih:** 7 Mart 2026  
**Kapsam:** Tüm frontend sayfaları, API route'ları, veri çekme stratejileri, animasyonlar, bellek yönetimi  
**Sonuç:** Internet sitesi ve paneller ciddi kasma/yavaşlık sorunu yaşıyor. Aşağıda tüm sorunlar detaylı olarak açıklanmıştır.

## Doğrulama ve Uygulama Durumu (7 Mart 2026 Revizyon)

Bu revizyonda rapordaki bulgular tek tek yeniden kontrol edilip kod tarafında doğrulanan maddeler uygulanmıştır.

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

---

## 1. Genel Bakış

Proje Next.js 16 (App Router) + React 19 + Supabase tabanlı bir SaaS randevu sistemidir. Kasma sorununun **tek bir nedeni yok**; birçok sorunun birleşik etkisi söz konusu. En büyük suçlu, 1818 satırlık tek bir bileşen içinde 51 state, 3 eşzamanlı polling ve 40+ animasyon elementinin bir arada bulunmasıdır.

**Proje istatistikleri:**

| Metrik | Değer |
|--------|-------|
| Framework | Next.js 16.1.6 + React 19.2.3 |
| En büyük dosya | `dashboard/[tenantId]/page.tsx` — 1818 satır |
| En fazla useState | Aynı dosya — 51 adet |
| Eşzamanlı polling | 3 adet (10s + 30s + 60s) |
| motion.* element sayısı | 40+ (sadece dashboard) |
| ScrollReveal sayısı | 19 (sadece dashboard) |
| Sayfalama olmayan endpoint | 5+ adet (500–6000 kayıt) |

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
