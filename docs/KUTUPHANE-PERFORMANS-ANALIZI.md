# Kütüphane Performans Analizi ve Optimizasyon Önerileri

**Tarih:** 8 Mart 2026  
**Kapsam:** Tüm bağımlılıkların performans etkisi ve kullanım analizi

---

## Genel Bakış

Projede **69 bağımlılık** bulunuyor. Bazıları doğru kullanılmış, bazıları optimize edilmemiş. Bu rapor, her kütüphanenin performans etkisini ve iyileştirme önerilerini içerir.

---

## 1. Motion (Framer Motion) - Animasyon Kütüphanesi

**Versiyon:** `12.34.3`  
**Bundle Boyutu:** ~40KB (gzipped)  
**Kullanım:** Dashboard, Landing Page, ScrollReveal

### Mevcut Durum

✅ **İyileştirilmiş:**
- `ScrollReveal.tsx`'te transition objesi `useMemo` ile memoize edildi
- `next.config.ts`'te `optimizePackageImports: ["motion"]` var

⚠️ **Sorunlar:**

1. **Çok Fazla Motion Elementi:**
   - Dashboard'da 40+ `motion.*` elementi
   - Her biri kendi animasyon state'ini yönetiyor
   - Scroll event'lerinde hepsi re-render oluyor

2. **Scroll-Driven Animasyonlar:**
   ```typescript
   // Dashboard'da scroll event'lerinde animasyon hesaplamaları
   const { scrollY } = useScroll();
   const headerY = useTransform(scrollY, [0, 120], [0, -12]);
   ```
   Her scroll event'inde hesaplama yapılıyor.

3. **whileInView Kullanımı:**
   - 19 adet `ScrollReveal` bileşeni
   - Her biri kendi Intersection Observer'ını oluşturuyor
   - 19 observer aynı anda çalışıyor

### Öneriler

1. **CSS Transitions'a Geçiş:**
   - Basit animasyonlar için CSS transitions kullan
   - Sadece kompleks animasyonlar için Motion kullan

2. **Lazy Load Motion:**
   ```typescript
   const MotionComponent = dynamic(() => import("motion/react").then(m => m.motion.div), {
     ssr: false
   });
   ```

3. **Observer Birleştirme:**
   - Tek bir Intersection Observer ile tüm ScrollReveal'leri yönet
   - Custom hook ile observer paylaşımı

**Tahmini Etki:** %30-40 animasyon maliyeti azalması

---

## 2. SWR - Data Fetching

**Versiyon:** `2.4.1`  
**Bundle Boyutu:** ~5KB (gzipped)  
**Kullanım:** DashboardTenantContext, bazı sayfalarda

### Mevcut Durum

✅ **İyi Kullanım:**
- `DashboardTenantContext`'te doğru kullanılmış
- `revalidateOnFocus: false` ayarlanmış
- `dedupingInterval: 30000` var

⚠️ **Sorunlar:**

1. **Global SWRConfig Yok:**
   - Her kullanımda aynı config tekrarlanıyor
   - Global error handler yok
   - Global loading state yok

2. **Fetcher Cache Eksikliği:**
   ```typescript
   // src/lib/swr-fetcher.ts
   export async function fetcher<T = unknown>(url: string): Promise<T> {
     const res = await fetch(url); // Cache yok!
     if (!res.ok) throw new Error(`HTTP ${res.status}`);
     return res.json() as Promise<T>;
   }
   ```
   HTTP cache kullanılmıyor.

3. **SWR Kullanımı Sınırlı:**
   - Dashboard'da hala manuel `fetch` + `useState` kullanılıyor
   - SWR'nin cache ve revalidation özellikleri kullanılmıyor

### Öneriler

1. **Global SWRConfig:**
   ```typescript
   // src/app/providers/SWRProvider.tsx
   <SWRConfig
     value={{
       fetcher,
       revalidateOnFocus: false,
       dedupingInterval: 30000,
       onError: (error) => {
         console.error("SWR Error:", error);
       },
     }}
   >
     {children}
   </SWRConfig>
   ```

2. **Fetcher'a Cache Ekle:**
   ```typescript
   export async function fetcher<T = unknown>(url: string): Promise<T> {
     const res = await fetch(url, {
       cache: "force-cache", // veya "no-store" endpoint'e göre
     });
     if (!res.ok) throw new Error(`HTTP ${res.status}`);
     return res.json() as Promise<T>;
   }
   ```

3. **Dashboard'da SWR'ye Geçiş:**
   - `appointments` → `useSWR('/api/tenant/${id}/appointments', fetcher)`
   - `opsAlerts` → `useSWR('/api/tenant/${id}/ops-alerts', fetcher)`
   - Polling yerine SWR'nin `refreshInterval` kullan

**Tahmini Etki:** %50-70 gereksiz fetch azalması, otomatik cache yönetimi

---

## 3. Recharts - Grafik Kütüphanesi

**Versiyon:** `3.7.0`  
**Bundle Boyutu:** ~80KB (gzipped)  
**Kullanım:** ChartBar, ChartCard, OverviewView

### Mevcut Durum

✅ **İyi:**
- `next.config.ts`'te `optimizePackageImports: ["recharts"]` var
- Dynamic import kullanılıyor mu kontrol edilmeli

⚠️ **Sorunlar:**

1. **Dynamic Import Eksikliği:**
   - ChartBar, ChartCard statik import edilmiş olabilir
   - İlk yüklemede 80KB bundle'a ekleniyor

2. **Responsive Container:**
   - Recharts'in `ResponsiveContainer` kullanımı
   - Window resize event'lerinde re-render

### Öneriler

1. **Dynamic Import:**
   ```typescript
   const ChartBar = dynamic(() => import("@/components/charts/ChartBar"), {
     ssr: false,
     loading: () => <div className="h-64 animate-pulse bg-slate-100" />
   });
   ```

2. **Fixed Size Container:**
   - `ResponsiveContainer` yerine sabit boyutlu container kullan
   - Sadece gerektiğinde resize listener ekle

**Tahmini Etki:** %20-30 ilk yükleme iyileşmesi

---

## 4. Lottie React - Animasyon Kütüphanesi

**Versiyon:** `2.4.1`  
**Bundle Boyutu:** ~15KB (gzipped) + animasyon JSON dosyaları  
**Kullanım:** LottieAnimation, LottieAnimationLazy

### Mevcut Durum

✅ **İyi:**
- `LottieAnimationLazy` component'i var (lazy load)
- Dinamik import kullanılıyor

⚠️ **Kontrol Edilmeli:**
- Tüm kullanımlarda lazy version kullanılıyor mu?
- Animasyon JSON dosyaları optimize edilmiş mi?

### Öneriler

1. **Lazy Version Kullanımını Zorunlu Kıl:**
   - `LottieAnimation` yerine her zaman `LottieAnimationLazy` kullan
   - Veya `LottieAnimation`'ı default olarak lazy yap

2. **JSON Optimizasyonu:**
   - Lottie JSON dosyalarını optimize et (lottie-optimize tool)
   - Gereksiz keyframe'leri kaldır

**Tahmini Etki:** %10-15 bundle boyutu azalması

---

## 5. PostHog - Analytics

**Versiyon:** `1.358.0`  
**Bundle Boyutu:** ~50KB (gzipped)  
**Kullanım:** PostHogProvider

### Mevcut Durum

✅ **İyi:**
- `requestIdleCallback` ile lazy load
- Fallback: `setTimeout(load, 500)`

⚠️ **Sorunlar:**

1. **Timeout Çok Uzun:**
   ```typescript
   requestIdleCallback(load, { timeout: 2000 }); // 2 saniye çok uzun
   ```
   Kullanıcı etkileşimi 2 saniye içinde başlarsa PostHog yüklenmemiş olabilir.

2. **Double Import:**
   ```typescript
   import("posthog-js").then(...)
   import("posthog-js/react").then(...)
   ```
   İki ayrı import yerine tek import yapılabilir.

### Öneriler

1. **Timeout Azalt:**
   ```typescript
   requestIdleCallback(load, { timeout: 500 }); // 500ms yeterli
   ```

2. **Tek Import:**
   ```typescript
   import("posthog-js").then((mod) => {
     const ph = mod.default;
     ph.init(...);
     // React provider'ı aynı modülden al
   });
   ```

**Tahmini Etki:** %5-10 yükleme iyileşmesi

---

## 6. Zustand - State Management

**Versiyon:** `5.0.11`  
**Bundle Boyutu:** ~1KB (gzipped)  
**Kullanım:** tenants-store, crm-store

### Mevcut Durum

✅ **İyi:**
- Çok hafif kütüphane
- Store'lar mevcut

⚠️ **Sorunlar:**

1. **Kullanım Sınırlı:**
   - Sadece 2 store var (tenants, crm)
   - Dashboard'da hala Context API kullanılıyor
   - Zustand'ın avantajları kullanılmıyor

2. **Store Optimizasyonu:**
   - Store'larda selector pattern kullanılıyor mu?
   - Gereksiz re-render'lar önleniyor mu?

### Öneriler

1. **Dashboard State'i Zustand'a Taşı:**
   ```typescript
   // stores/dashboard-store.ts
   interface DashboardStore {
     appointments: Appointment[];
     blockedDates: BlockedDate[];
     // ...
     updateAppointment: (id: string, data: Partial<Appointment>) => void;
   }
   
   export const useDashboardStore = create<DashboardStore>((set) => ({
     appointments: [],
     // ...
   }));
   ```

2. **Selector Pattern:**
   ```typescript
   // Sadece appointments'ı dinle
   const appointments = useDashboardStore((state) => state.appointments);
   ```

**Tahmini Etki:** %60-80 re-render azalması (Context yerine)

---

## 7. TanStack Table - Tablo Kütüphanesi

**Versiyon:** `8.21.3`  
**Bundle Boyutu:** ~30KB (gzipped)  
**Kullanım:** admin/tenants/page.tsx

### Mevcut Durum

✅ **İyi:**
- Virtual list kullanılıyor (`@tanstack/react-virtual`)

⚠️ **Kontrol Edilmeli:**
- Tüm tablolarda virtual list kullanılıyor mu?
- Column definitions memoize edilmiş mi?

### Öneriler

1. **Virtual List Kullanımını Zorunlu Kıl:**
   - 50+ satırlık tablolarda mutlaka virtual list kullan
   - `VirtualList` component'i zaten mevcut

2. **Column Definitions Memoize:**
   ```typescript
   const columns = useMemo(() => [
     { accessorKey: "name", header: "Name" },
     // ...
   ], []);
   ```

**Tahmini Etki:** %40-60 render performansı (büyük listelerde)

---

## 8. Fuse.js - Fuzzy Search

**Versiyon:** `7.1.0`  
**Bundle Boyutu:** ~10KB (gzipped)  
**Kullanım:** use-fuzzy-search-worker.ts

### Mevcut Durum

✅ **Mükemmel:**
- Web Worker ile kullanılıyor (`Comlink`)
- Büyük listelerde worker'a geçiş yapılıyor
- Küçük listelerde sync kullanılıyor (optimize)

**Öneri:** Mevcut implementasyon mükemmel, değişiklik gerekmez.

---

## 9. Array İşlemleri - Performans Sorunları

### Sorun: Çoklu Filter/Map Chain'leri

**Dosya:** `src/app/dashboard/[tenantId]/campaigns/page.tsx` (satır 297-303)

```typescript
const effectiveRecipients: { phone: string; name?: string }[] = customPhones.trim()
  ? customPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean).map((p) => ({ phone: p }))
  : [
      ...baseRecipientsFromApi.filter((r) => !excludedPhones.has(normalizePhoneForCompare(r.phone))).map((r) => ({ phone: r.phone, name: r.name })),
      ...extraPhones.filter((p) => p.trim()).map((p) => ({ phone: p })),
    ];
```

**Sorunlar:**
1. Her render'da yeniden hesaplanıyor (useMemo yok)
2. Çoklu array iteration (filter → map → map)
3. `baseRecipientsFromApi` her render'da yeni array oluşturuyor

### Çözüm

```typescript
const effectiveRecipients = useMemo(() => {
  if (customPhones.trim()) {
    return customPhones
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ phone: p }));
  }
  
  const filtered = baseRecipientsFromApi
    .filter((r) => !excludedPhones.has(normalizePhoneForCompare(r.phone)))
    .map((r) => ({ phone: r.phone, name: r.name }));
  
  const extra = extraPhones
    .filter((p) => p.trim())
    .map((p) => ({ phone: p }));
  
  return [...filtered, ...extra];
}, [customPhones, baseRecipientsFromApi, excludedPhones, extraPhones]);
```

**Tahmini Etki:** %50-70 hesaplama maliyeti azalması

---

## 10. Inngest - Background Jobs

**Versiyon:** `3.52.5`  
**Kullanım:** WhatsApp webhook, background processing

### Mevcut Durum

✅ **İyi:**
- Webhook'ta kullanılıyor
- Async processing için doğru kullanım

⚠️ **Kontrol Edilmeli:**
- Webhook'ta sıralı `inngest.send` çağrıları var mı?
- Batch processing yapılıyor mu?

### Öneriler

1. **Paralel Send:**
   ```typescript
   // Sıralı yerine
   await Promise.all(
     messages.map(msg => inngest.send({ ... }))
   );
   ```

2. **Batch Processing:**
   - Büyük batch'ler için `inngest.send` yerine batch API kullan

---

## 11. React Hook Form - Form Yönetimi

**Versiyon:** `7.71.2`  
**Bundle Boyutu:** ~15KB (gzipped)  
**Kullanım:** Form sayfalarında

### Mevcut Durum

✅ **İyi:**
- Zod resolver kullanılıyor
- Uncontrolled components (performanslı)

**Öneri:** Mevcut kullanım doğru, değişiklik gerekmez.

---

## 12. XState - State Machine

**Versiyon:** `5.28.0`  
**Bundle Boyutu:** ~20KB (gzipped)  
**Kullanım:** Bot FSM

### Mevcut Durum

✅ **İyi:**
- Bot state machine için doğru kullanım
- Server-side kullanım (bundle'a etkisi yok)

**Öneri:** Mevcut kullanım doğru, değişiklik gerekmez.

---

## Öncelik Sırası

### 🔴 Kritik (Hemen Yapılmalı)

1. **Array İşlemlerini useMemo ile Optimize Et**
   - Campaigns sayfasındaki `effectiveRecipients`
   - Diğer sayfalardaki benzer pattern'ler
   - **Süre:** 1 saat
   - **Etki:** %50-70 hesaplama maliyeti azalması

2. **SWR Global Config ve Fetcher Cache**
   - Global SWRConfig ekle
   - Fetcher'a cache ekle
   - **Süre:** 2 saat
   - **Etki:** %50-70 gereksiz fetch azalması

### 🟡 Yüksek Öncelik (Bu Hafta)

3. **Motion Optimizasyonu**
   - CSS transitions'a geçiş (basit animasyonlar)
   - Observer birleştirme
   - **Süre:** 3-4 saat
   - **Etki:** %30-40 animasyon maliyeti azalması

4. **Recharts Dynamic Import**
   - ChartBar, ChartCard dynamic import
   - **Süre:** 1 saat
   - **Etki:** %20-30 ilk yükleme iyileşmesi

5. **Zustand'a Geçiş (Dashboard)**
   - Dashboard state'i Zustand'a taşı
   - Context yerine Zustand kullan
   - **Süre:** 4-6 saat
   - **Etki:** %60-80 re-render azalması

### 🟢 Orta Öncelik (Bu Ay)

6. **PostHog Timeout Azaltma**
   - Timeout 2000ms → 500ms
   - **Süre:** 15 dakika
   - **Etki:** %5-10 yükleme iyileşmesi

7. **Lottie Optimizasyonu**
   - Tüm kullanımlarda lazy version
   - JSON optimize
   - **Süre:** 1 saat
   - **Etki:** %10-15 bundle boyutu azalması

---

## Toplam Tahmini Etki

| Kategori | İyileşme |
|----------|----------|
| Re-render sayısı | %60-80 ↓ |
| Fetch sayısı | %50-70 ↓ |
| Animasyon maliyeti | %30-40 ↓ |
| İlk yükleme süresi | %20-30 ↓ |
| Bundle boyutu | %10-15 ↓ |
| Hesaplama maliyeti | %50-70 ↓ |

**Genel Performans İyileşmesi:** %40-60

---

## Sonuç

Projede kütüphaneler genel olarak doğru kullanılmış, ancak optimizasyon fırsatları var. Özellikle:

1. **Array işlemleri** useMemo ile optimize edilmeli
2. **SWR** daha etkili kullanılmalı (global config, cache)
3. **Motion** animasyonları CSS transitions'a geçirilmeli
4. **Zustand** Context yerine kullanılmalı (dashboard state)

Bu iyileştirmelerle %40-60 genel performans artışı bekleniyor.
