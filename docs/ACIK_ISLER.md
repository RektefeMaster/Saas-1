# Açık İşler — Uygulama Planı

Bu belge, denetim sonucunda açık kalan işleri **ne / neden / nerede / nasıl**
düzeyinde tarif eder. Sıra, etkiye göre verilmiştir.

Genel kural: her madde bittiğinde `npx tsc --noEmit`, `npx eslint src`,
`npx vitest run` ve `npm run build` temiz olmalı.

---

## 1. Bilgi Bankası — bot okuyor, kimse dolduramıyor ✅ TAMAMLANDI

**Durum:** Yazma tarafı eklendi; tablo artık panelden doldurulabiliyor.

### Sorun (doğrulandı)

`tenant_knowledge_entries` tablosu vardı (migration 042) ve bot her konuşmada
okuyordu, ama servis dosyasında tek bir yazma işlemi yoktu: API route'u yok,
panel ekranı yok. Tablo kalıcı olarak boştu.

### Yapılanlar

**a) Servis — `src/services/tenantKnowledge.service.ts`**

`listKnowledgeForPanel`, `createKnowledgeEntry`, `updateKnowledgeEntry`
eklendi. DB mantığı serviste, route ince tutuldu (mevcut `blocked-dates`
kalıbı). Kurallar:

- Yeni kayıt her zaman `draft` doğar — yazmak ile yayınlamak ayrı adım.
- `approved` yapılırken `approved_at` + `approved_by` yazılır; yayından
  kalkarsa bu izler temizlenir.
- Başlık/metin/kategori değişirse `version = version + 1`.
- Fiyat kalıbı görülürse **uyarı** döner (engelleme yok) — `detectPriceLikeContent`.
- Onaylı kayıt sınırı `MAX_APPROVED_ENTRIES = 15`, **sunucu tarafında**
  zorlanır; sadece panelde kısıtlamak yeterli değildi. Sayım her zaman gerçek
  toplamdan gelir (listeden türetilmez — liste 200 ile sınırlı ve filtrelenebilir).
- Bot limiti `BOT_KNOWLEDGE_LIMIT = 10` (eski: 20) → prompt maliyeti yarıya indi.
- `formatKnowledgeForPrompt` gövdedeki satır sonlarını tek boşluğa indiriyor:
  panel çok satırlı metin yazdırabildiği için kayıt başına tek satır kuralı
  aksi halde bozulurdu.
- Tarih alanları: `<input type="date">`'ten gelen bitiş tarihi gün sonuna
  (`23:59:59.999Z`) çekiliyor — yoksa kampanya bir gün erken biterdi. Bozuk
  tarih DB'ye gitmeden 400 dönüyor.

**b) API — `src/app/api/tenant/[id]/knowledge/route.ts`**

`GET ?status=all|draft|approved|archived` / `POST` / `PATCH`. Üç handler da
`requireTenantApiAccess` ile korunuyor. (`requireValidTenantId` ayrıca
çağrılmadı; `requireTenantApiAccess` zaten ilk iş olarak onu çalıştırıp
düzgün 400 dönüyor.)

**c) Panel — `src/app/dashboard/[tenantId]/knowledge/page.tsx`**

Liste + durum rozeti + ekle/düzenle formu. "Onayla" ayrı buton; onaylı olmayan
kayıtta **"Bot bunu henüz kullanmıyor"** uyarısı görünüyor. Karakter sayacı
400'ü aşınca "bot yalnızca ilk 400 karakteri okur" diyor. Başlıkta
`Onaylı kayıt: N/15` sayacı var. `DashboardShell` `baseNav`'ına `knowledge`
sekmesi eklendi (mobilde "Diğer" menüsüne düşüyor).

### Doğrulama

- `src/services/__tests__/tenantKnowledge.test.ts`: prompt uzunluğu bot
  limitinde öngörülebilir bütçe içinde kalıyor, gövde 400 karakterde kesiliyor,
  fiyat tespiti yanlış alarm vermiyor.
- Panelden 2 kayıt oluşturup birini onaylama / WhatsApp'tan sorma adımı
  **canlıda elle** yapılmalı (bu ortamda DB yok).

---

## 2. Yeni V1 katmanının derin denetimi ✅ DENETLENDİ

`88b867c` commit'inin (122 dosya / +9.055 satır) beş başlığı da tarandı.
Sonuçlar:

**1) Yarım bağlanmış özellik taraması.** Migration 038–045'in tabloları
tek tek kontrol edildi (yazan / okuyan / panelden erişilebilen):

| Tablo | Yazan | Okuyan | Panel | Sonuç |
|---|---|---|---|---|
| `tenant_memberships` | ✔ | ✔ | ✔ (inbox atama) | sağlam |
| `conversations` | ✔ | ✔ | ✔ | sağlam |
| `crm_pipeline_transitions` | ✔ | ✔ | ✔ (CRM) | sağlam |
| `domain_events` | ✔ | ✔ | ✖ | **kasıtlı** (aşağıda) |
| `followup_jobs` | ✔ | ✔ (cron) | ✖ | kasıtlı, arka plan işi |
| `tenant_knowledge_entries` | ✖ → ✔ | ✔ | ✖ → ✔ | madde 1 ile kapandı |
| `conversation_quality_feedback` | ✔ | ✔ | ✔ (inbox) | sağlam |

**2) Çift yönlü akış kontrolü.** `followup_jobs` incelendi: claim edilip
gönderilemeyen iş **geri açılıyor** — `processDueFollowUps` her turda 15
dakikadan uzun süre `sending`de kalanları `scheduled`a döndürüyor
(`safeFollowUp.service.ts:142-152`). `unread_count` sıfırlama tarafı da
mevcut (`conversations/[conversationId]/route.ts:102`). Açık uç yok.

**3) Idempotency.** `domain_events` tablosunda `uq_domain_events_idempotency`
benzersiz indeksi var; `publishDomainEvent` 23505'i yakalayıp yalnızca
`processed_at` boşsa yeniden tüketiyor (yarım kalan crash replay'i),
işlenmişse hiçbir yan etki üretmiyor. **Tüm publisher'lar idempotency key
veriyor** — `crm-events.ts`, `tools/executor.ts`, `noShow.service.ts` tek tek
kontrol edildi. `crm_pipeline_transitions` `from === to` durumunda no-op
(`transitionPipelineStage`), `scheduleFollowUp` aynı trigger'ın önceki
kaydını iptal edip yenisini yazıyor. Üçünde de tekrar gönderim riski yok.

**4) Yetki.** `/api/tenant/*` altındaki tüm route'lar tarandı. Proxy
(`src/proxy.ts:226`) zaten tüm `/api/tenant/*` yolunu sahiplik kontrolüyle
kapatıyor; handler'daki `requireTenantApiAccess` ikinci savunma katmanı.
`conversations/*` route'larının hepsinde mevcut. **Tek eksik bulundu ve
düzeltildi:** `crm/customers/[phone]/route.ts` GET'i — kardeşleri
(`crm/customers`, `crm/reminders`, `.../notes`) kontrol ederken bu atlanmıştı;
üstelik müşteri kartı + notları, yani kişisel veri döndürüyor.

**5) Panelden erişilebilirlik.** `domain_events` panelde yok ve **öyle
kalmalı**: bu bir iç outbox tablosu, işletmenin okuyacağı bir şey değil.
Etkileri zaten CRM aşaması, lead skoru ve takip mesajı olarak panele
yansıyor. Ayrı bir ekran ikinci bir gerçek kaynağı olurdu.

---

## 3. Karar bekleyen küçük işler

### 3a. `Halı yıkama` kopya satırı — **Seçenek A seçildi (bırakıldı)**

`business_types` tablosunda hem `hali-yikama` hem `Halı yıkama` var. Aktif
işletme kullanmıyor; soft-delete edilmiş bir tenant referans verdiği için
guard'lı DELETE 0 satır etkiliyor.

Karar: **dokunulmadı.** Zararsız katalog kaydı, silinmiş işletmenin geçmişini
doğru gösteriyor ve kurulum sihirbazı zaten listelemiyor
(`isWizardAllowedBusinessTypeSlug`). Kod tarafında yapılacak bir şey yok; bu
madde kapandı. Birleştirme (Seçenek B) gerekirse eski sürümdeki SQL git
geçmişinde duruyor.

### 3b. Kullanılmayan 5 export ✅ TEMİZLENDİ

Beşi de tek tek doğrulandı (yalnızca tanımları vardı, tek çağrı yok):

- `ThemeToggle` → `src/app/admin/theme-toggle.tsx` **dosyası silindi**
  (`ThemeLocaleSwitch` aynı işi yapıyor ve kullanılıyor).
- `ViewTransitionsWrapper` → `src/components/ViewTransitionsWrapper.tsx`
  **dosyası silindi**; içindeki error boundary de yalnızca yorum satırındaki
  koddan çağrılıyordu, gövde zaten boş bir Fragment döndürüyordu.
- `requireTenantMatch` → `tenantScope.middleware.ts`'den çıkarıldı
  (`requireValidTenantId` ve `TenantScopeError` kullanılmaya devam ediyor).
- `stageRank` → `crmPipeline.service.ts`'den çıkarıldı; tek kullanıcısı olduğu
  için `STAGE_ORDER` sabiti de düştü.
- `botConversationMachine` → **silindi.** Belge değeri yoktu: makinedeki
  `tarih_saat_bekleniyor`, `saat_secimi_bekleniyor` ve `iptal_onay_bekleniyor`
  geçişleri `VALID_TRANSITIONS`'takilerin çok gerisinde kalmıştı (gerçek tablo
  bilinçli olarak genişletilmişti, makine güncellenmemişti) — yani yanlış
  şemayı belgeliyordu. Tek kullanıcısı gidince **`xstate` bağımlılığı da
  kaldırıldı**.

`viewport` (`src/app/layout.tsx`) **silinmedi** — Next.js onu isme göre okur.

---

## 4. CRM listesi ölçek sınırı — bilinçli olarak ertelendi

`src/app/api/tenant/[id]/crm/customers/route.ts` en fazla **500 müşteri**
çekiyor, arama bu 500 kayıt üzerinde `fuse.js` ile yapılıyor. 500'ü aşan bir
işletmede 501. müşteri aramada sessizce görünmez.

Çözüm hazır (pg_trgm + GIN indeksi, sunucu tarafı `ilike`/`similarity`,
sayfalama; `VirtualList` panelde zaten var):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_crm_customers_search ON crm_customers
  USING GIN ((coalesce(customer_name,'') || ' ' || customer_phone) gin_trgm_ops);
```

**Bu oturumda yapılmadı.** Tetikleyici: bir işletme 400 müşteriye
yaklaştığında. Şu an en büyük tenant çok altında; erken yapmak gereksiz
karmaşıklık olur.

---

## 5. Panel modül sıralaması ✅ DÜZELTİLDİ

Bilgi Bankası sekmesi eklenirken çıktı: kurulum sihirbazı `ui_preferences`e
`moduleOrder: ["overview","calendar","pricing","workflow","crm","settings"]`
yazıyordu. Gerçek nav'da 10 modül var; listede olmayanlar `?? 999` ile sona
atılıyordu. Wizard'la kurulan **her** işletmede kenar çubuğu şöyleydi:

`Özet · Fiyat Listesi · İş Akışı · Müşteri Defteri · Ayarlar · Gelen Kutusu · Bilgi Bankası · Kampanyalar`

Ayarlar ortada, en çok kullanılan ekran (Gelen Kutusu) onun altında.

Üç noktadan düzeltildi:

1. **`src/app/dashboard/nav-order.ts`** (yeni, 20 satır): `applyModuleOrder`
   sıralamayı ancak liste **görünen tüm modülleri kapsıyorsa** uyguluyor.
   Kısmi liste kullanıcı niyeti taşımaz. Bu, veri taşımadan mevcut
   işletmelerdeki bozuk sıralamayı da anında düzeltiyor.
2. **Sihirbazdan `moduleOrder` yazımı kaldırıldı.** Sıralamayı düzenleten
   hiçbir arayüz yok; yazılan şey elle güncellenmesi unutulmuş bir sabitti.
3. **Ölü `calendar` onay kutusu kaldırıldı** — öyle bir modül yok, işareti
   kaldırmak hiçbir şey yapmıyordu.

`src/app/dashboard/__tests__/nav-order.test.ts` eski sabitle regresyonu
yakalıyor (eski mantıkta iki assertion da düşüyor, doğrulandı).

**Bilinçli olarak yapılmadı:** `moduleVisibility` listesine `inbox`,
`packages`, `campaigns`, `staff`, `knowledge` eklenmedi. `packages` ve `staff`
zaten `feature_flags` ile kapatılıyor; ikinci bir görünürlük anahtarı
belgenin sonundaki "ikinci bir sistem kurulmamalı" kuralını çiğnerdi.

---

## Yapılmayacaklar (bilinçli kararlar)

Bunlar denetimde tartışıldı ve **dokunulmamasına** karar verildi; tekrar
gündeme gelirse gerekçesi burada:

- **`availability_slots` tekilleştirme.** Kopya *yok*. İlk bakışta 4 kopya
  görünmüştü; sorgu `tenant_id` ile gruplanmadığı için 4 farklı tenant'ın
  satırları kopya sanılmıştı. Tabloda zaten
  `(tenant_id, day_of_week, COALESCE(staff_id,…))` benzersiz indeksi var.
- **`recurring_appointments` tablosu.** Boş olduğu doğrulanıp düşürüldü;
  tekrarlayan randevu artık gerçek randevu satırları üretiyor
  (`appointmentSeries.service.ts`).
- **`capabilities` / canonical sektör kodları.** `feature_flags` ile
  çakışıyordu, silindi. Yeni bir yetenek gerekirse `feature_flags`'e anahtar
  eklenmeli — ikinci bir sistem kurulmamalı.
- **`domain_events` için panel ekranı.** İç outbox tablosu; etkileri zaten
  CRM/takip ekranlarında görünüyor.
