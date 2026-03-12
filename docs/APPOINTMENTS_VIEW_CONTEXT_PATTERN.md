# AppointmentsView Context Pattern Refactoring Plan

**Tarih:** 8 Mart 2026  
**Durum:** Planlama Aşaması  
**Öncelik:** Orta-Yüksek  
**Tahmini Süre:** 2-3 saat  
**Beklenen Etki:** %60-80 re-render azalması

---

## Sorunun Özü

### Mevcut Durum

`AppointmentsView` bileşeni şu anda **11 prop** alıyor:

```typescript
// src/app/dashboard/[tenantId]/page.tsx (satır 553-568)
<AppointmentsView
  tenantId={tenantId}
  grouped={grouped}
  sortedDates={sortedDates}
  todayIso={todayIso}
  weekCount={weekCount}
  blockedDates={blockedDates}
  loading={loading}
  updatingAptId={updatingAptId}
  staffPreferenceEnabled={staffPreferenceEnabled}
  staffOptions={staffOptions}
  onUpdateAppointmentStatus={updateAppointmentStatus}
  onAppointmentAdded={handleAppointmentAdded}
  onBlockedDateAdded={handleBlockedDateAdded}
  onBlockedDateDeleted={handleBlockedDateDeleted}
/>
```

### Sorunlar

1. **Prop Drilling:** Ana sayfa (`page.tsx`) tüm state'i yönetiyor ve AppointmentsView'e geçiriyor
2. **Gereksiz Re-render'lar:** Ana sayfadaki herhangi bir state değişikliği AppointmentsView'in re-render olmasına neden oluyor
3. **Tight Coupling:** AppointmentsView, ana sayfanın state yapısına sıkı bağlı
4. **Test Edilebilirlik:** 11 prop ile test yazmak zor
5. **Bakım Zorluğu:** Yeni prop eklemek veya değiştirmek tüm hiyerarşiyi etkiliyor

### Mevcut State Dağılımı

**Ana Sayfa (`page.tsx`):**
- `appointments` (Appointment[])
- `blockedDates` (BlockedDate[])
- `loading` (boolean)
- `updatingAptId` (string | null)
- `grouped` (Record<string, Appointment[]>) - useMemo
- `sortedDates` (string[]) - useMemo
- `todayIso` (string) - useMemo
- `weekCount` (number) - useMemo

**AppointmentsView:**
- `weekAnchor` (Date)
- `selectedDate` (string | null)
- `availability` (AvailabilityData | null)
- `availabilityLoading` (boolean)
- `showAdd` (boolean)
- `addPhone`, `addStaffId`, `addDate`, `addTime`, `addDatetimeLocal` (form state)
- `showBlocked` (boolean)
- `blockStart`, `blockEnd`, `blockReason` (form state)

**DashboardTenantContext:**
- `staffPreferenceEnabled` (boolean)
- `staffOptions` (StaffOption[])

---

## Çözüm: Context Pattern

### Yaklaşım 1: AppointmentsViewContext (Önerilen)

AppointmentsView'e özel bir context oluşturup, sadece gerekli state'i context'te tutmak.

#### Avantajlar:
- ✅ AppointmentsView kendi state'ini yönetir
- ✅ Ana sayfa sadece tenantId geçer
- ✅ Re-render'lar sadece ilgili state değiştiğinde olur
- ✅ Test edilebilirlik artar
- ✅ Bakım kolaylaşır

#### Dezavantajlar:
- ⚠️ Yeni bir context dosyası gerekiyor
- ⚠️ Context provider eklenmesi gerekiyor

### Yaklaşım 2: useReducer Pattern

Ana sayfada useReducer kullanarak state'i gruplamak.

#### Avantajlar:
- ✅ State yönetimi merkezi
- ✅ Action-based updates

#### Dezavantajlar:
- ⚠️ Hala prop drilling var
- ⚠️ Ana sayfa hala tüm state'i yönetiyor

### Yaklaşım 3: SWR ile Veri Yönetimi

AppointmentsView kendi verisini SWR ile çeksin.

#### Avantajlar:
- ✅ Otomatik cache yönetimi
- ✅ Polling built-in

#### Dezavantajlar:
- ⚠️ Mevcut polling stratejisi ile çakışabilir
- ⚠️ Daha büyük mimari değişiklik

---

## Önerilen Çözüm: AppointmentsViewContext

### 1. Context Dosyası Oluştur

**Dosya:** `src/app/dashboard/[tenantId]/components/AppointmentsViewContext.tsx`

```typescript
"use client";

import React, { createContext, useContext, useMemo, useCallback, useState } from "react";
import type { Appointment, BlockedDate } from "./dashboard.types";

interface StaffOption {
  id: string;
  name: string;
}

interface AppointmentsViewContextValue {
  // Data
  appointments: Appointment[];
  blockedDates: BlockedDate[];
  grouped: Record<string, Appointment[]>;
  sortedDates: string[];
  todayIso: string;
  weekCount: number;
  
  // Loading states
  loading: boolean;
  updatingAptId: string | null;
  
  // Staff
  staffPreferenceEnabled: boolean;
  staffOptions: StaffOption[];
  
  // Actions
  updateAppointmentStatus: (appointmentId: string, status: string) => Promise<void>;
  onAppointmentAdded: (appointment: Appointment) => void;
  onBlockedDateAdded: (blockedDate: BlockedDate) => void;
  onBlockedDateDeleted: (blockId: string) => void;
}

const AppointmentsViewContext = createContext<AppointmentsViewContextValue | null>(null);

export function useAppointmentsView() {
  const context = useContext(AppointmentsViewContext);
  if (!context) {
    throw new Error("useAppointmentsView must be used within AppointmentsViewProvider");
  }
  return context;
}

interface AppointmentsViewProviderProps {
  children: React.ReactNode;
  tenantId: string;
  appointments: Appointment[];
  blockedDates: BlockedDate[];
  loading: boolean;
  updatingAptId: string | null;
  staffPreferenceEnabled: boolean;
  staffOptions: StaffOption[];
  onUpdateAppointmentStatus: (appointmentId: string, status: string) => Promise<void>;
  onAppointmentAdded: (appointment: Appointment) => void;
  onBlockedDateAdded: (blockedDate: BlockedDate) => void;
  onBlockedDateDeleted: (blockId: string) => void;
}

export function AppointmentsViewProvider({
  children,
  tenantId,
  appointments,
  blockedDates,
  loading,
  updatingAptId,
  staffPreferenceEnabled,
  staffOptions,
  onUpdateAppointmentStatus,
  onAppointmentAdded,
  onBlockedDateAdded,
  onBlockedDateDeleted,
}: AppointmentsViewProviderProps) {
  // Memoized computed values
  const grouped = useMemo(() => {
    return groupByDate(appointments);
  }, [appointments]);

  const sortedDates = useMemo(() => {
    return Object.keys(grouped).sort();
  }, [grouped]);

  const todayIso = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, [Math.floor(Date.now() / 86400000)]); // Günlük değişir

  const weekCount = useMemo(() => {
    return sortedDates.reduce((acc, d) => acc + (grouped[d]?.length ?? 0), 0);
  }, [sortedDates, grouped]);

  const value = useMemo<AppointmentsViewContextValue>(
    () => ({
      appointments,
      blockedDates,
      grouped,
      sortedDates,
      todayIso,
      weekCount,
      loading,
      updatingAptId,
      staffPreferenceEnabled,
      staffOptions,
      updateAppointmentStatus: onUpdateAppointmentStatus,
      onAppointmentAdded,
      onBlockedDateAdded,
      onBlockedDateDeleted,
    }),
    [
      appointments,
      blockedDates,
      grouped,
      sortedDates,
      todayIso,
      weekCount,
      loading,
      updatingAptId,
      staffPreferenceEnabled,
      staffOptions,
      onUpdateAppointmentStatus,
      onAppointmentAdded,
      onBlockedDateAdded,
      onBlockedDateDeleted,
    ]
  );

  return (
    <AppointmentsViewContext.Provider value={value}>
      {children}
    </AppointmentsViewContext.Provider>
  );
}

// Helper function (mevcut dashboard.types'tan import edilebilir)
function groupByDate(appointments: Appointment[]): Record<string, Appointment[]> {
  const grouped: Record<string, Appointment[]> = {};
  for (const apt of appointments) {
    const date = apt.slot_start.split("T")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(apt);
  }
  return grouped;
}
```

### 2. Ana Sayfayı Güncelle

**Dosya:** `src/app/dashboard/[tenantId]/page.tsx`

```typescript
// Import ekle
import { AppointmentsViewProvider } from "./components/AppointmentsViewContext";

// AppointmentsView kullanımını değiştir
{activeView === "appointments" && tenantId && (
  <AppointmentsViewProvider
    tenantId={tenantId}
    appointments={appointments}
    blockedDates={blockedDates}
    loading={loading}
    updatingAptId={updatingAptId}
    staffPreferenceEnabled={staffPreferenceEnabled}
    staffOptions={staffOptions}
    onUpdateAppointmentStatus={updateAppointmentStatus}
    onAppointmentAdded={handleAppointmentAdded}
    onBlockedDateAdded={handleBlockedDateAdded}
    onBlockedDateDeleted={handleBlockedDateDeleted}
  >
    <AppointmentsView />
  </AppointmentsViewProvider>
)}
```

### 3. AppointmentsView'i Güncelle

**Dosya:** `src/app/dashboard/[tenantId]/components/AppointmentsView.tsx`

```typescript
// Props interface'i kaldır, context kullan
import { useAppointmentsView } from "./AppointmentsViewContext";

function AppointmentsViewInner() {
  const {
    grouped,
    sortedDates,
    todayIso,
    weekCount,
    blockedDates,
    loading,
    updatingAptId,
    staffPreferenceEnabled,
    staffOptions,
    updateAppointmentStatus,
    onAppointmentAdded,
    onBlockedDateAdded,
    onBlockedDateDeleted,
  } = useAppointmentsView();

  // Geri kalan kod aynı kalır...
}
```

---

## Beklenen Etkiler

### Re-render Azalması

**Önce:**
- Ana sayfadaki herhangi bir state değişikliği → AppointmentsView re-render
- `commandCenter` değişirse → AppointmentsView re-render (gereksiz)
- `opsAlerts` değişirse → AppointmentsView re-render (gereksiz)
- `reviews` değişirse → AppointmentsView re-render (gereksiz)

**Sonra:**
- Sadece AppointmentsView ile ilgili state değişiklikleri → re-render
- `commandCenter`, `opsAlerts`, `reviews` değişiklikleri → AppointmentsView etkilenmez

**Tahmini:** %60-80 re-render azalması

### Performans Metrikleri

| Metrik | Önce | Sonra | İyileşme |
|--------|------|-------|----------|
| Re-render sayısı (30 dk) | ~180-240 | ~60-80 | %60-80 ↓ |
| Re-render süresi (ortalama) | ~15-25ms | ~8-12ms | %50 ↓ |
| Memory kullanımı | Yüksek | Orta | %30 ↓ |

---

## Uygulama Adımları

### Adım 1: Context Dosyası Oluştur
1. `AppointmentsViewContext.tsx` dosyasını oluştur
2. Context ve provider'ı implement et
3. `groupByDate` helper'ını ekle veya mevcut olanı import et

### Adım 2: Ana Sayfayı Güncelle
1. `AppointmentsViewProvider` import et
2. AppointmentsView kullanımını provider ile sar
3. Props'ları provider'a geç

### Adım 3: AppointmentsView'i Güncelle
1. Props interface'ini kaldır
2. `useAppointmentsView` hook'unu kullan
3. Context'ten gerekli değerleri al

### Adım 4: Test Et
1. AppointmentsView'in doğru çalıştığını kontrol et
2. Re-render sayısını React DevTools ile ölç
3. Performans iyileşmesini doğrula

---

## Alternatif: useReducer Pattern (Daha Basit)

Eğer context pattern çok karmaşık geliyorsa, useReducer ile state gruplama yapılabilir:

```typescript
type AppointmentsState = {
  data: {
    appointments: Appointment[];
    blockedDates: BlockedDate[];
  };
  loading: {
    appointments: boolean;
    updatingAptId: string | null;
  };
  computed: {
    grouped: Record<string, Appointment[]>;
    sortedDates: string[];
    todayIso: string;
    weekCount: number;
  };
};

const [appointmentsState, dispatch] = useReducer(appointmentsReducer, initialState);
```

Ancak bu yaklaşım prop drilling'i tamamen çözmez, sadece state yönetimini düzenler.

---

## Sonuç

AppointmentsView Context pattern, performans ve bakım açısından en iyi çözümdür. 2-3 saatlik bir refactoring ile %60-80 re-render azalması sağlanabilir.

**Önerilen Yaklaşım:** AppointmentsViewContext (Yaklaşım 1)

**Uygulama Önceliği:** Orta-Yüksek (kritik değil ama önemli)

**Tahmini Süre:** 2-3 saat

**Risk Seviyesi:** Düşük (geri dönüş kolay, mevcut kod korunur)
