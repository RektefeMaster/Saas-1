# Kütüphane Kullanım Rehberi

Bu rehber, projede kurulu kütüphaneleri **günlük geliştirmede nasıl kullanacağını** pratik örneklerle anlatır.

---

## Admin Araçlar Paneli

**Admin → Araçlar** sayfasından tüm kütüphane fonksiyonlarını tek ekrandan test edebilirsin:

- **Toast** — Başarı, hata, bilgi, uyarı bildirimlerini dene
- **PostHog** — Test event gönder
- **Cache** — Key-value kaydet, getir, temizle (Unstorage/Redis)
- **E-posta** — Test e-postası gönder (Resend)
- **Sentry** — Test hatası gönder
- **Log** — Test log yaz (Pino)

---

## 1. UI & Bildirimler

### Toast (sonner)

Kullanıcıya anlık geri bildirim vermek için:

```tsx
import { toast } from "@/lib/toast";

// Basit bildirimler
toast.success("Kayıt başarılı!");
toast.error("Bir hata oluştu", "Lütfen tekrar deneyin");
toast.info("Bilgi", "İşlem devam ediyor");
toast.warning("Uyarı", "Bu işlem geri alınamaz");

// API çağrısı ile (loading → success/error otomatik)
toast.promise(
  fetch("/api/save").then((r) => r.json()),
  {
    loading: "Kaydediliyor...",
    success: "Kaydedildi!",
    error: (err) => `Hata: ${err.message}`,
  }
);
```

---

### cn() — Dinamik className (clsx + tailwind-merge)

Koşullu veya birleşik sınıflar için:

```tsx
import { cn } from "@/lib/cn";

// Koşullu sınıf
<button className={cn(
  "rounded-lg px-4 py-2",
  isActive && "bg-blue-500 text-white",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />

// Props ile override
<div className={cn("p-4 bg-slate-100", className)} />
```

---

## 2. Form & Validasyon

### react-hook-form + zod

Form state + validasyon için:

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Ad zorunlu"),
  email: z.string().email("Geçerli e-posta girin"),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <input {...register("name")} />
      {errors.name && <span>{errors.name.message}</span>}
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}
      <button type="submit">Gönder</button>
    </form>
  );
}
```

---

### validator (e-posta, URL)

API route veya servislerde:

```ts
import { isValidEmail, isValidUrl } from "@/lib/validation";

if (!isValidEmail(email)) return Response.json({ error: "Geçersiz e-posta" }, { status: 400 });
if (!isValidUrl(url, { requireProtocol: true })) return Response.json({ error: "Geçersiz URL" }, { status: 400 });
```

---

## 3. Loglama

### pino (logger)

API route ve servislerde yapılandırılmış log:

```ts
import { logger, createChildLogger } from "@/lib/logger";

// Basit log
logger.info("İşlem başladı");
logger.error({ err }, "Hata oluştu");
logger.debug({ userId, action }, "Debug bilgisi");

// Tenant/trace bazlı (webhook, bot vb.)
const child = createChildLogger({ tenantId, traceId });
child.info("Mesaj işlendi");
```

---

## 4. Cache & Storage

### unstorage

Geçici veri veya cache için (Redis varsa Redis, yoksa memory):

```ts
import { storage } from "@/lib/storage";

// Key-value
await storage.setItem("cache:user:123", JSON.stringify(userData));
const data = await storage.getItem("cache:user:123");

// TTL yok; manuel silmek gerekir veya key'e tarih ekleyebilirsin
await storage.removeItem("cache:user:123");
```

**Not:** `base: "ahi-ai:cache:"` ile tüm key'ler bu prefix ile başlar.

---

## 5. Arama

### fuse.js (bulanık arama)

Liste içinde arama:

```ts
import { fuzzySearch, fuzzySearchBest } from "@/lib/fuse-search";

// Liste filtreleme
const filtered = fuzzySearch({
  list: tenants,
  query: searchTerm,
  keys: ["name", "slug"],
  limit: 20,
});

// Tek en iyi eşleşme (örn. hizmet eşleştirme)
const best = fuzzySearchBest(services, "saç kesimi", ["name", "slug", "searchText"], 0.4);
if (best) console.log(best.item);
```

---

## 6. Tarih & Süre

### humanize-duration

Dakika → okunabilir metin:

```ts
import { humanizeMinutes } from "@/lib/humanize-duration";

humanizeMinutes(30);   // "30 dakika"
humanizeMinutes(90);   // "1 saat 30 dakika"
humanizeMinutes(120); // "2 saat"
```

---

### slugify

URL-safe string:

```ts
import { slugify } from "@/lib/slugify";

slugify("Saç Kesimi & Boya"); // "sac-kesimi-boya"
slugify("Özel Hizmet", 50);   // max 50 karakter
```

---

## 7. PostHog — Özel Eventler

Sayfa görüntüleme otomatik. Özel event eklemek için:

```tsx
"use client";

import posthog from "posthog-js";

// Buton tıklama
posthog.capture("kampanya_gonderildi", { tenantId, campaignId, recipientCount });

// Kullanıcı tanımlama (login sonrası)
posthog.identify(userId, { email, plan: "pro" });

// Funnel için
posthog.capture("checkout_basladi");
posthog.capture("checkout_tamamlandi", { amount: 99 });
```

PostHog dashboard'da bu event'leri görüntüleyebilir, funnel ve retention analizi yapabilirsin.

---

## 8. Sentry — Manuel Hata Raporlama

Çoğu hata otomatik yakalanır. Özel durumlar için:

```ts
import * as Sentry from "@sentry/nextjs";

// Manuel capture
Sentry.captureException(new Error("Özel hata"));

// Bağlam ekleme
Sentry.withScope((scope) => {
  scope.setTag("tenantId", tenantId);
  scope.setExtra("payload", payload);
  Sentry.captureException(err);
});

// Breadcrumb (adım adım iz)
Sentry.addBreadcrumb({ category: "booking", message: "Randevu oluşturuluyor", level: "info" });
```

---

## 9. Resend — E-posta Gönderme

İletişim formu zaten kullanıyor. Başka yerden e-posta atmak için:

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const { error } = await resend.emails.send({
  from: "Ahi AI <onboarding@resend.dev>",
  to: email,
  subject: "Randevu Onayı",
  html: "<p>Randevunuz onaylandı.</p>",
});

if (error) {
  logger.error({ err: error }, "Resend error");
}
```

**Not:** `from` adresi Resend'de doğrulanmış domain olmalı (production için).

---

## 10. Inngest — Arka Plan İşleri

Webhook zaten kullanıyor. Yeni background job eklemek için:

```ts
// src/lib/inngest/functions/my-job.ts
import { inngest } from "@/lib/inngest/client";

export const myJobFn = inngest.createFunction(
  { id: "my-job", retries: 2 },
  { event: "my/event.triggered" },
  async ({ event, step }) => {
    // Uzun süren iş
    await step.run("process", async () => {
      // ...
    });
  }
);
```

```ts
// src/app/api/inngest/route.ts — functions listesine ekle
import { myJobFn } from "@/lib/inngest/functions/my-job";

export const { serve } = createHandler({
  client: inngest,
  functions: [processWhatsAppMessageFn, myJobFn],
});
```

Tetiklemek için:

```ts
import { inngest } from "@/lib/inngest/client";

await inngest.send({ name: "my/event.triggered", data: { id: "123" } });
```

---

## 11. Grafikler (Tremor)

Dashboard'larda grafik:

```tsx
import { BarChart, AreaChart } from "@tremor/react";

const data = [
  { date: "2025-01", randevu: 45, gelir: 3200 },
  { date: "2025-02", randevu: 52, gelir: 4100 },
];

<BarChart
  data={data}
  index="date"
  categories={["randevu", "gelir"]}
  colors={["blue", "emerald"]}
/>
```

---

## 12. Test

### Vitest (unit)

```bash
npm run test        # watch mode
npm run test:run    # tek seferlik
```

Yeni test dosyası: `src/lib/__tests__/my-module.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { myFunction } from "../my-module";

describe("myFunction", () => {
  it("doğru sonuç döner", () => {
    expect(myFunction("input")).toBe("expected");
  });
});
```

---

### Playwright (E2E)

```bash
npm run test:e2e
```

Yeni test: `e2e/my-flow.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("kullanıcı giriş yapabilir", async ({ page }) => {
  await page.goto("/login");
  await page.fill('[name="email"]', "test@test.com");
  await page.fill('[name="password"]', "secret");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
});
```

---

## 13. Langfuse

LLM çağrıları otomatik trace edilir. Yapman gereken:

1. [cloud.langfuse.com](https://cloud.langfuse.com) → Projene gir
2. **Traces** sekmesinde OpenAI çağrılarını, token maliyetlerini, hataları incele
3. Tenant bazlı filtreleme yap (metadata ile)

Kod tarafında ekstra bir şey yapmana gerek yok; `observeOpenAI` zaten client'ı sarmalıyor.

---

## 14. Özet Cheat Sheet

| İhtiyaç | Kullan |
|---------|--------|
| Kullanıcıya bildirim | `toast.success()` / `toast.error()` |
| Koşullu CSS sınıfı | `cn("base", condition && "extra")` |
| Form + validasyon | `useForm` + `zodResolver` + `zod` |
| E-posta/URL doğrulama | `isValidEmail()`, `isValidUrl()` |
| Loglama | `logger.info()`, `logger.error()` |
| Cache | `storage.setItem()` / `storage.getItem()` |
| Bulanık arama | `fuzzySearch()`, `fuzzySearchBest()` |
| Süre formatı | `humanizeMinutes()` |
| URL slug | `slugify()` |
| Özel analitik | `posthog.capture()` |
| Manuel hata raporu | `Sentry.captureException()` |
| E-posta gönder | `resend.emails.send()` |
| Arka plan işi | Inngest `createFunction` + `inngest.send()` |
| Grafik | `BarChart`, `AreaChart` (@tremor/react) |
| Unit test | Vitest |
| E2E test | Playwright |

---

*Son güncelleme: Mart 2025*
