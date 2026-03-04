# Ahi AI — Birlesik Master Plan (Uygulanabilirlik + Fazli Icra)

Bu belge, V3 platform yol haritasi ile admin panel hedeflerini **mevcut kod tabanina gore** yeniden duzenler.
Amac, buyuk kapsami tek seferde degil, **riski kontrollu fazlarla** teslim etmektir.

---

## 1) Yonetici Ozeti

- Plan **yapilabilir**.
- Ancak mevcut repo durumuna gore en buyuk bosluk admin tarafindadir (14 modulun cogu henuz yok).
- Platform cekirdeginde kritik kazanımlar zaten mevcut:
  - Coklu tenant routing (marker/name/session/history/nlp/default)
  - Tenant switch log altyapisi
  - Booking lock + hold (race condition korumasi)
  - Voice STT (sesli mesaj transcribe)
  - 24 saat pencere/template toparlama akisi
  - Model routing (mini vs complex)
- Bu nedenle icra stratejisi:
  - Once **operasyonel emniyet + kontrol**
  - Sonra **admin hizli islemler**
  - Sonra **gozlemlenebilirlik + canli mudahale**
  - Sonra **ileri analitik ve otomasyon**

---

## 2) Kod Tabanina Gore Durum Tespiti

### 2.1 Tamamlanmis / Guclu Olanlar

1. Domain standardizasyonu ve URL yardimcisi
2. Mobil dashboard shell iyilestirmeleri
3. Tenant routing ve switch reason akisi
4. Session/phone-tenant mapping TTL (30 gun)
5. Booking lock/hold + slot cakisma korumasi
6. STT ile sesli mesaj islemi
7. 24 saat pencere kontrolu ve template recovery
8. Bot tarafinda deterministic cancel/late niyetleri
9. Admin temel dashboard + tenant CRUD + kampanya sayfalari
10. Langfuse gozlem sayfasi ve API baglantisi

### 2.2 Kismen Hazir Olanlar

1. Pazarlik/abuse niyetleri botta algilaniyor ama adminde canli mudahale paneli yok
2. Rate limiting var, ancak global kriz yonetimi (kill switch) yok
3. CRM tablolari var, fakat Time Machine icin conversation replay tablosu yok
4. Playwright testleri var, fakat adminden tetiklenen QA orkestrasyonu yok

### 2.3 Net Eksik Olanlar (Bu planin teslim kapsaminda)

1. Global Kill Switch (admin UI + API + worker enforcement)
2. Quick Add Tenant (hizli sag panel akisi)
3. Subscription Extend API/UX
4. Magic Link API/UX + migration
5. Riskli konusmalar listesi + takeover/send/resume API
6. Time Machine (conversation_messages tablosu + 3 panel debug)
7. Live Logs (SSE) ve Visual Brain (live-steps)
8. Profitability radar (tenant maliyet/gelir paneli)
9. Admin Cmd+K operasyon paleti
10. run-qa admin endpoint + cron baglantisi

---

## 3) Fazli Uygulama Plani (Sira + Bagimlilik + Cikis Kriteri)

> Not: Her faz sonunda "deploy edilebilir" seviye hedeflenir. Fazlar birbirine bagimlidir.

### Faz 0 — Baseline ve Emniyet (1-2 gun)

**Hedef:** Buyuk gelistirme oncesi tabani sabitlemek.

Teslimatlar:
1. Planin bu belgeye gore revizyonu
2. Modullerin mevcut/eksik envanteri
3. Faz bazli branch/disiplin kurali
4. Kritik env kontrol listesi

Cikis kriteri:
1. Her faz icin net API/UI kapsam listesi
2. "Ne var / ne yok" belirsizligi kalmamis olmali

Durum: **Tamamlandi** (bu dokumanla)

---

### Faz 1 — Operasyonel Kontrol Katmani (2-3 gun)

**Hedef:** Krizde sistemi tek tusla guvenli moda almak.

Teslimatlar:
1. Redis tabanli global kill switch key/yardimcilari
2. `GET/POST /api/admin/tools/kill-switch`
3. Admin header’da "Sistemi Dondur / Coz" kontrolu
4. WhatsApp worker’da kill switch enforcement
5. Bakim modu yaniti + audit stage

Bagimlilik:
1. Admin auth/proxy (hazir)
2. Redis katmani (hazir)

Cikis kriteri:
1. Switch acikken bot LLM akisina girmez
2. Switch kapaninca normal akis geri gelir
3. UI ve API durumu tutarli gorunur

Durum: **Kismen tamamlandi (Kill Switch teslim edildi, Faz 1 kalanlari devam edecek)**

---

### Faz 2 — Admin Hizli Operasyonlar (3-4 gun)

**Hedef:** Operasyon ekibinin tenant yonetim hizini arttirmak.

Teslimatlar:
1. Quick Add Tenant (`POST /api/admin/tenants/quick`) + drawer UI
2. Subscription Extend (`PATCH /api/admin/tenants/[id]/extend-subscription`)
3. Magic Link migration + endpoint + tek kullanimli akıs
4. Tenant listesinde hizli aksiyonlar (limit arttir, uzat, link gonder)

Bagimlilik:
1. Faz 1
2. Supabase migration seti (027/028)

Cikis kriteri:
1. Yeni tenant 60 sn altinda acilabilmeli
2. Uzatma ve magic link islemleri audit log ile izlenebilmeli

Durum: **Baslatildi (Quick Add + Extend + Magic Link backend ve temel UI teslim edildi)**

---

### Faz 3 — Gozlemlenebilirlik ve Debug (4-5 gun)

**Hedef:** "Neden bu mesajda bozuldu?" sorusunu dakikalar icinde cevaplamak.

Teslimatlar:
1. `conversation_messages` migration (029)
2. Webhook/worker mesaj loglama katmani
3. Time Machine API (`/api/admin/tools/time-machine`)
4. Time Machine UI (WhatsApp + Langfuse + Sentry 3 panel)
5. `sentry-issues` endpointi (gercek issue listesi)

Bagimlilik:
1. Faz 1
2. Langfuse + Sentry env

Cikis kriteri:
1. Telefon + zaman araligiyla mesaj/trace/hata korelasyonu gorulebilmeli
2. Son 24 saat hatalari panelden acilabilmeli

Durum: **Tamamlandi (029 migration + worker mesaj loglama + Time Machine API/UI + sentry-issues endpoint teslim edildi)**

---

### Faz 4 — Canli Mudahale ve Risk Konusmalar (4-5 gun)

**Hedef:** Bot dongulerini canlida insanla kesmek.

Teslimatlar:
1. Riskli konusmalar listeleme API + sayfa
2. `takeover / send / resume` endpointleri
3. Session state: `PAUSED_FOR_HUMAN` admin kaynakli kontrol
4. Worker tarafinda human takeover bypass garantisi
5. Ops alert entegrasyonu

Bagimlilik:
1. Faz 3 (mesaj kaydi ve izlenebilirlik)

Cikis kriteri:
1. Admin devralinca bot cevap vermemeli
2. Resume sonrasi bot kontrollu sekilde geri donmeli

Durum: **Baslatildi (Riskli konusmalar API/UI + takeover/send/resume endpointleri + worker bypass teslim edildi)**

---

### Faz 5 — Canli Izleme ve Akis Haritasi (3-4 gun)

**Hedef:** Sistemin canli durumunu tek ekranda gormek.

Teslimatlar:
1. `live-logs` SSE endpointi
2. `live-steps` endpointi
3. Visual Brain sayfasi (state dagilimi)
4. Sağlik haritasi genisletmesi

Bagimlilik:
1. Faz 4

Cikis kriteri:
1. Son olaylar gercek zamanli akmali
2. State dagilimi canli gorunmeli

Durum: **Beklemede**

---

### Faz 6 — Karlilik ve Maliyet Kontrolu (3-4 gun)

**Hedef:** Tenant bazli maliyet/gelir dengesini yonetmek.

Teslimatlar:
1. Profitability endpoint (`/api/admin/tools/profitability`)
2. Gelir verisi alanlari (`monthly_revenue` veya plan mapping)
3. Cuzdan Radari UI (kirmizi tenant aksiyonlari)

Bagimlilik:
1. Faz 3 (Langfuse cost data)
2. Gerekli tenant gelir alani

Cikis kriteri:
1. Tenant bazli birim maliyet ve tahmini marj gorunmeli
2. Limit/fiyat aksiyonlari panelden tetiklenebilmeli

Durum: **Beklemede**

---

### Faz 7 — QA Otomasyon ve Rollout (2-3 gun)

**Hedef:** Canliya cikis riskini azaltmak.

Teslimatlar:
1. `run-qa` endpointi (Playwright suite tetikleme)
2. Cron/manuel QA calistirma akisi
3. Rollout checklist + feature flag matrisi

Bagimlilik:
1. Faz 2-6 kapsami

Cikis kriteri:
1. Kritik akislarda smoke E2E pass
2. Rollout adimlari dokumante

Durum: **Beklemede**

---

## 4) Veri Modeli Revize Plani

### Mevcut tablolar (kullaniliyor)
1. `tenant_switch_logs`
2. `phone_tenant_mappings`
3. `crm_customers`, `crm_notes`, `crm_reminders`
4. Booking icin Redis lock/hold anahtarlari

### Yeni migration ihtiyaci
1. **027**: `tenants.subscription_end_at`, `tenants.subscription_plan`, (opsiyonel) `rate_limit_override`, `monthly_revenue`
2. **028**: `magic_links` (token, tenant_id, expires_at, used_at, created_by)
3. **029**: `conversation_messages` (trace_id, tenant_id, phone, direction, payload, created_at)
4. **030**: `risk_conversations` (opsiyonel materialized/derived)

---

## 5) API Revizyonu (Gercek Uygulama Hedefleri)

### Faz 1
1. `GET /api/admin/tools/kill-switch`
2. `POST /api/admin/tools/kill-switch`

### Faz 2
1. `POST /api/admin/tenants/quick`
2. `PATCH /api/admin/tenants/[id]/extend-subscription`
3. `POST /api/admin/tenants/[id]/magic-link`

### Faz 3
1. `GET /api/admin/tools/time-machine`
2. `GET /api/admin/tools/sentry-issues`

### Faz 4
1. `GET /api/admin/conversations/risky`
2. `POST /api/admin/conversations/takeover`
3. `POST /api/admin/conversations/send`
4. `POST /api/admin/conversations/resume`

### Faz 5-7
1. `GET /api/admin/tools/live-logs` (SSE)
2. `GET /api/admin/conversations/live-steps`
3. `GET /api/admin/tools/profitability`
4. `POST /api/admin/tools/run-qa`

---

## 6) Riskler ve Karsiliklari

1. Redis yoksa kill switch etkisiz kalma riski
- Karsilik: memory fallback + UI warning

2. Supabase migration drift riski
- Karsilik: migration gate checklist + startup schema check

3. Time Machine veri hacmi buyume riski
- Karsilik: retention policy + index + limitli sorgu

4. Admin canli mudahale suistimal riski
- Karsilik: event log + role check + action audit

---

## 7) KPI ve Kabul Kriterleri

1. Kill switch aktivasyon suresi < 2 sn
2. Slot cakisma vakasi = 0 (lock/hold etkin)
3. Tenant routing dogruluk trendi artmali (switch_reason dagilimi)
4. Mesajdan randevuya donusum orani haftalik izlenmeli
5. LLM maliyet/tenant panelde gorunur olmali

---

## 8) Guncel Icra Durumu

- Bu turde yapilanlar:
1. Plan dosyasi kod tabanina gore revize edildi
2. Fazli sira netlestirildi
3. Faz 1 icin Global Kill Switch teslim edildi (Redis + API + Admin UI + Worker enforcement)
4. Faz 2 backend teslimleri eklendi (`/api/admin/tenants/quick`, `extend-subscription`, `magic-link`)
5. Tenant detay paneline abonelik uzatma ve magic link kontrol kartlari eklendi
6. Quick Add formu tenant liste ekranina eklendi
7. Faz 3 teslimleri eklendi (`conversation_messages` migration, worker conversation log, `/api/admin/tools/time-machine`, `/admin/time-machine`)
8. Faz 3 API teslimi tamamlandi (`/api/admin/tools/sentry-issues`)
9. Faz 4 ilk teslimleri eklendi (`/api/admin/conversations/risky`, `takeover/send/resume`, `/admin/conversations`, worker human takeover bypass)
10. Faz 4 ikinci tur eklendi (tenant bazli risk esigi: `config_override.ops_risk_config.min_score`)

---

*Son guncelleme: 4 Mart 2026*
