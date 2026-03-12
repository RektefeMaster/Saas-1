# Dashboard Performans Analizi

## İşletme vs Admin Yükleme Ayrımı

**Rota yapısı:**
- `/dashboard/*` → `DashboardLayout` (DashboardShell) → `DashboardTenantProvider` sadece tenant sayfalarında
- `/admin/*` → `AdminLayout` → CommandMenu, HealthIndicator (admin API'leri)

**Karışma yok:** İşletme paneli ve admin paneli farklı layout'lar kullanır. DashboardShell hiçbir zaman admin rotalarında render edilmez. Admin layout hiçbir zaman tenant verisi çekmez.

| Rota | Veri kaynağı | API'ler |
|------|--------------|---------|
| /dashboard/[tenantId] | DashboardTenantContext | /api/tenant/* |
| /admin | Admin layout | /api/admin/* |

---

## 1. Re-render Sorunu (En Kritik)

### Durum
- **~45 useState** tek bir `EsnafDashboard` bileşeninde
- Her state değişikliği **tüm sayfanın** (~1760 satır) yeniden render edilmesine yol açıyor
- Örnek: `codeCopied` değişince (Kopyala tıklandığında) tüm dashboard yeniden çiziliyor

### Etkilenen state grupları
| Grup | State sayısı | Sıklık | Etki |
|------|--------------|--------|------|
| UI modal/toggle | 8 | Düşük | showWhatsAppModal, showQRModal, showAdd, showBlocked, showWorkingHours, codeCopied, activeView, mobileOpen |
| Form alanları (Settings) | 15+ | Yüksek | Her tuş vuruşunda re-render |
| Veri (API) | 12 | Orta | appointments, blockedDates, reviews, commandCenter, opsAlerts, availability... |
| Loading/saving | 8 | Orta | loading, opsAlertsLoading, availabilityLoading... |

### Öneri
- **Bileşen bölme**: Overview, Appointments, Settings ayrı bileşenlere taşınmalı
- **Settings form**: `MessageSettings` gibi kendi state'ini tutan bir `SettingsView` bileşeni
- **Modal state**: `useReducer` veya küçük context ile modal state'leri izole edilebilir

---

## 2. Veri Fetch Stratejisi

### Mevcut akış (mount)
```
t=0ms    → appointments (hemen)
t=120ms  → blocked-dates
t=240ms  → reviews  
t=360ms  → availability/slots (working hours)
t=480ms  → ops-alerts (visibility check)
t=600ms  → command-center (visibility check)
```

### Sorunlar
- **Stagger gereksiz**: blocked-dates, reviews, availability/slots birbirine bağımlı değil → paralel çekilebilir
- **availability/slots**: Sadece Settings'te çalışma saatleri düzenlenirken kullanılıyor; overview'da gerekli mi kontrol edilmeli
- **working hours**: `weekDates` ile takvim için kullanılıyor; aslında appointments zaten tarih bilgisi içeriyor

### Poll aralıkları
| Endpoint | Aralık | visibility check |
|----------|--------|------------------|
| appointments | 30s | ✅ |
| ops-alerts | 60s | ✅ |
| command-center | 120s | ✅ |

### Öneri
- blocked-dates, reviews, availability/slots → **paralel** (stagger kaldır veya tek 120ms delay)
- İlk yüklemede 6 istek yerine 2–3 batch: (1) appointments, (2) blocked+reviews+slots paralel, (3) ops+command paralel

---

## 3. Context ve Tenant Verisi

### DashboardTenantContext
```
tenant (SWR) → features (SWR) → staff (SWR, staff_preference=true ise)
```
- tenant ve features **paralel** çekilebilir (SWR zaten paralel)
- staff, features'a bağlı (staff_preference) → bu sıralı kalmalı

### Context güncellemesi
- `setTenant` çağrıldığında (örn. ayar kaydedildikten sonra) tüm context tüketicileri re-render oluyor
- Dashboard sayfası `tenant`, `setTenant`, `staffOptions`, `staffPreferenceEnabled` kullanıyor

### Öneri
- Context value'yu `useMemo` ile sıkı bağımlılıkla memoize et (zaten yapılıyor)
- Gereksiz context tüketimini azalt: sadece ihtiyaç duyan alt bileşenler `useDashboardTenant` kullansın

---

## 4. Ağır Bileşenler

### ChartBar
- `weekDates`, `grouped` → appointments değişince yeniden hesaplanıyor
- `useMemo` ile `grouped` zaten memoize; ChartBar'a giren data da öyle

### CommandCenterSection
- ✅ Dynamic import ile lazy load yapıldı

---

## 5. Gereksiz Hesaplamalar

### `todayIso`
```javascript
const todayIso = new Date().toISOString().slice(0, 10);
```
- Her render'da yeniden hesaplanıyor
- `useMemo` ile günlük bazda cache edilebilir (date değişmedikçe aynı)

### `grouped`, `sortedDates`, `weekDates`
- ✅ `useMemo` ile memoize edilmiş

### `nextAppointment`, `weekCount`
- ✅ `useMemo` ile memoize edilmiş

---

## 6. Öncelik Sıralaması

| # | İyileştirme | Etki | Zorluk |
|---|-------------|------|--------|
| 1 | Settings view'ı ayrı bileşene taşı (form state izolasyonu) | Yüksek | Orta |
| 2 | Overview / Appointments / Settings tab içeriklerini ayrı bileşenlere böl | Yüksek | Orta |
| 3 | İlk fetch'leri paralel yap (blocked, reviews, slots) | Orta | Düşük |
| 4 | todayIso useMemo | Düşük | Düşük |
| 5 | Modal state'lerini küçük context veya reducer ile izole et | Orta | Orta |

---

## 7. Hızlı Kazanımlar (Hemen Uygulanabilir)

1. **Stagger kaldır, paralel fetch**: blocked-dates, reviews, availability/slots aynı anda ✅ (Promise.all ile uygulandı)
2. **todayIso useMemo**: `useMemo(() => new Date().toISOString().slice(0, 10), [])` — gün değişince güncellemek için `date-fns` startOfDay veya basit bir ref ile günlük invalidation

---

## 8. Uygulanan İyileştirmeler (Güncel)

- **useCallback**: handleSaveReminderPref, handleSaveMessages, handleSaveBotSettings, handleAddBlocked, handleDeleteBlocked, handleAddAppointment, handleSaveWorkingHours — child bileşenlere sabit referans, gereksiz re-render azaltıldı.
- **React.memo**: OverviewView, AppointmentsView, SettingsView memo ile sarıldı; props değişmediğinde (örn. codeCopied değişimi) view'lar yeniden render olmuyor.
- **DashboardCodeCopy**: Kod kopyalama state'i (codeCopied) ana sayfadan çıkarıldı; "Kopyala" tıklanınca sadece bu bileşen re-render oluyor.
- **Paralel fetch**: blocked-dates, reviews paralel; availability/slots artık sadece SettingsView içinde (Ayarlar açıldığında) çekiliyor, ana sayfa yükü azaldı.
- **Settings form state izolasyonu**: Tüm ayar formu state'i (reminderPref, welcomeMsg, slotDuration, workingHours, …) SettingsView içine taşındı. Her tuş vuruşunda sadece SettingsView re-render oluyor, ana dashboard sayfası değil. Kaydet işlemleri de SettingsView içinde.
- **DashboardModals**: WhatsApp ve QR modal state'leri ana sayfadan çıkarıldı. `DashboardModals` ref ile openWhatsApp/openQR sunuyor; modal aç/kapa sadece bu bileşeni re-render ediyor.
- **Admin panel**: fetchData useCallback ile sarıldı, useEffect dependency stabil.
- **todayIso**: Günlük invalidation eklendi; `useMemo(..., [Math.floor(Date.now()/86400000)])` ile takvim günü değişince güncellenir.
- **Ops + Command Center**: İlk yüklemede ve sekme tekrar görünür olduğunda iki istek paralel atılıyor; ayrı ayrı effect yerine tek effect ile visibility'de ikisi birden tetikleniyor.
- **AppointmentsView form state izolasyonu**: Tüm randevu ekleme formu state'leri (showAdd, addPhone, addDate, addTime, addDatetimeLocal, addStaffId) ve blocked dates formu state'leri (showBlocked, blockStart, blockEnd, blockReason) AppointmentsView içine taşındı. Her tuş vuruşunda sadece AppointmentsView re-render oluyor, ana dashboard sayfası değil.
- **Availability state izolasyonu**: selectedDate, availability, availabilityLoading state'leri ve fetchAvailability fonksiyonu AppointmentsView içine taşındı. Sadece AppointmentsView açıkken ve tarih seçildiğinde availability çekiliyor.
- **weekAnchor state izolasyonu**: weekAnchor state'i AppointmentsView içine taşındı. Hafta navigasyonu sadece AppointmentsView'ı etkiliyor.
- **State sayısı azaltıldı**: Ana sayfadaki state sayısı 28+ 'dan 13'e düştü. Form state'leri ve UI state'leri ilgili view bileşenlerine taşındı.
- **todayCount optimize edildi**: `todayCount` hesaplaması useMemo ile optimize edildi, her render'da yeniden hesaplanmıyor.
- **weekDates optimize edildi**: OverviewView için `weekDates` hesaplaması useMemo ile optimize edildi, günlük bazda cache ediliyor.
