# CRM Master Report (TR-First, Global-Ready)

## 1. Executive Summary
Bu raporun amaci, Ahi AI'yi yalnizca randevu alan WhatsApp botu olmaktan cikarip yerel isletmelerin gelir ve operasyon motoruna donusturmektir.

Hedef ciktisi:
- Isletme sahibine para kazandiran panel
- Sektor secimiyle aninda sekil degistiren dikey panel
- Mobilde 1 dakika icinde kritik aksiyon alma
- KVKK ve TR mevzuatina uygun, global genislemeye hazir bir cekirdek

Bu turda kod tarafinda aktif hale getirilen temel alanlar:
- Blueprint engine temeli
- Command Center metrik ve aksiyon katmani
- Revenue event ledger temeli
- Reactivation otomasyonu (adaylama + kuyruklama)
- Reputation summary endpointi
- Resource yonetimi endpointleri
- Immutable tenant event log standardi

## 2. Stratejik Kararlar
- Pazar odagi: Turkiye once, global-ready altyapi
- Pilot dikeyler: Kuafor/Guzellik + Dis/Estetik
- Segment: Tek sube SMB
- Gelir modeli: Katmanli abonelik
- Entegrasyon onceligi: Muhasebe + odeme
- Yol haritasi: 6 ay sikı fazlama

## 3. Mevcut Urun Baseline (Kod Tabanina Gore)
### Guclu Yonler
- Multi-tenant cekirdek mevcut
- WhatsApp AI tool-calling akisi calisiyor
- Randevu, iptal, gecikme, no-show alanlari mevcut
- CRM temel modelleri (customers/notes/reminders) mevcut
- Ops alerts mevcut
- Hizmet/fiyat modul cekirdegi mevcut

### Bosluklar (Bu raporun hedefledigi)
- Gelir odakli aksiyon katmani (proaktif) eksik
- Dikeye ozel veri nesneleri UI'da tam acilmiyor
- Immutable event standardi eksik
- Revenue ledger cekirdegi eksik
- Reactivation motoru ve segmentasyon eksik
- Compliance profil merkezilesmesi eksik

## 4. Benchmark Ozeti (Global + Local)
### Ortak Basari Noktalari
1. Panel veri gostermiyor, aksiyon oneriyor.
2. Onboarding sektore gore otomatik aciliyor.
3. Mobilde hizli akisa oncelik veriliyor.
4. Gelir ve retention metrikleri ana sayfada.
5. Otopilot kampanya/hatirlatma ile manuel emek azaltiliyor.

### Rekabetten Alinacaklar
- GoHighLevel: Otomasyon-first pipeline ve campaign orchestration
- Phorest/Vagaro/Zenoti/Boulevard: Salon odakli is akislari ve personel verimlilik
- Shopmonkey: Job-card ve servis emri mantigi
- ServiceTitan/Jobber: Operasyon + tahsilat baglantisi
- Klaviyo: Segment + reactivation yaklasimi

### Rekabetten Kacinilacaklar
- Cok karmasik setup wizard
- Birbirinden kopuk moduller
- Aksiyon uretemeyen raporlama ekrani
- Mobilde masaustu kopyasi layout

## 5. Urun Prensipleri
### Yapilacaklar
- Her ekranda "simdi ne yapalim" aksiyonu
- En kritik KPI'lari tek satirda gosteren command center
- Sektor secimiyle alan/modul degisimi
- Data entry yerine otomatik cikarim
- Kisa butonlar: Geri kazan, Bos slotu doldur, No-show'u azalt

### Yapilmayacaklar
- Sol menude gereksiz menu kalabaligi
- Sadece gecmis rapor odakli paneller
- Dikey farklarini yalnizca etiketle gecmek
- Finans gercegini panel disina itmek

## 6. Hedef Mimari (Decision-Complete)
### 6.1 Cekirdek Moduller
1. Command Center
2. Smart Calendar + Capacity
3. CRM 360
4. Revenue OS
5. Retention Automation
6. Ops Intelligence

### 6.2 Dikey Blueprint Motoru
Blueprint su katmanlari tanimlar:
- Ana nesne (customer_visit, patient_episode, vehicle_job_card)
- Zorunlu alanlar
- Kaynak turleri
- KPI setleri
- Otomasyon defaultlari
- Finans fallback politikalari

## 7. Pilot Dikey Tasarimi
## 7.1 Kuafor/Guzellik
- Ana nesne: customer_visit
- Kaynak: chair + specialist + device
- Kritik akisyon: 30-45 gun geri cagir

## 7.2 Dis/Estetik
- Ana nesne: patient_episode
- Kaynak: room + doctor + device
- Kritik aksiyon: tedavi plani devamliligi

## 7.3 Oto Servis (Faz-2)
- Ana nesne: vehicle_job_card
- Kaynak: lift + technician
- Kritik aksiyon: periyodik bakim geri cagirim

## 8. Data Model (Bu Turda Uygulanan Foundation)
Yeni migration: `016_master_crm_foundation.sql`

Eklenen tablolar:
- tenant_blueprint_overrides
- tenant_resources
- revenue_events
- retention_segments
- automation_rules
- compliance_profiles
- tenant_event_logs (immutable)

Eklenen standart:
- tenant_event_logs tablosu update/delete kapali (trigger)
- Kritik eylemler event olarak kayit altina alinir

## 9. API Yuzeyi (Bu Turda Acilan Gruplar)
- `GET/PATCH /api/tenant/:id/blueprint`
- `GET/POST /api/tenant/:id/resources`
- `PATCH/DELETE /api/tenant/:id/resources/:resourceId`
- `GET/POST /api/tenant/:id/revenue/events`
- `GET /api/tenant/:id/revenue/summary`
- `GET/POST /api/tenant/:id/automation/reactivation`
- `GET /api/tenant/:id/reputation/summary`
- `GET /api/tenant/:id/command-center`

## 10. Dashboard Uygulamasi (Bu Tur)
`/dashboard/[tenantId]` icine yeni bir Command Center bolumu eklendi.

Saglananlar:
- KPI kartlari (ciro, doluluk, no-show, riskte musteri)
- Aksiyon kartlari (reactivation, slot fill, no-show mitigation, reputation)
- Tek tusla otomasyon tetikleme

## 11. Event Sourcing Standardi
Asagidaki aksiyonlara immutable event log eklendi:
- appointment.created
- appointment.cancelled
- appointment.status.updated
- tenant.settings.updated
- crm.note.created
- resource.created / resource.updated / resource.deleted
- revenue.event.created
- automation.reactivation.queued
- blueprint.updated

## 12. 6 Aylik Fazlama
## Faz-1 (Hafta 1-4)
- Research pack tamamla
- KPI hiyerarsisini sabitle
- Blueprint sözlesmelerini dondur

## Faz-2 (Hafta 5-8)
- Kuafor + Dis blueprint UI farklilastirma
- Onboardingde otomatik kaynak/otomasyon bootstrap

## Faz-3 (Hafta 9-12)
- Reactivation + slot-fill + review-booster otomasyonlari
- Segment bazli kampanya olcumleme

## Faz-4 (Hafta 13-16)
- Revenue OS v1
- Tahsilat ve muhasebe connectorlari

## Faz-5 (Hafta 17-20)
- Rol-yetki
- Audit genisletme
- Tenant izolasyon sertlestirme

## Faz-6 (Hafta 21-24)
- Pilot rollout
- Paketleme/fiyatlama validasyonu
- PMF olcumleri

## 13. KPI Tree
North-star:
- AI destekli gelir aksiyonlarindan uretilecek aylik ek ciro

Operational:
- no_show_rate_pct
- fill_rate_pct
- cancellation_rate_pct
- open_ops_alerts

CRM:
- at_risk_customers
- reactivation_conversion_pct
- repeat_visit_cycle_days

Commercial:
- trial_to_paid
- churn
- ARPA
- NRR

## 14. Compliance ve Guvenlik
- KVKK mode default acik
- GDPR-ready yapilandirma default acik
- Healthcare mode dis/estetikte acik
- Data retention policy profile bazli
- Kritik aksiyonlar immutable event logda

## 15. Basari Kriterleri (Kabul)
1. Sektor seciminden sonra panel farklilasmasi < 1 sn
2. Reactivation endpointi aday olusturup kampanya kuyruklar
3. Revenue summary net/gross dagilimi dondurur
4. Command Center aksiyonlari tetiklenebilir
5. Event log update/delete kabul etmez

## 16. Sonraki Teknik Adimlar
1. Blueprint'e gore UI modul gorunurlugunu otomatiklestir
2. Revenue ledger'i odeme entegrasyonuna bagla
3. Reactivation kampanya sonucunu conversion event ile kapat
4. Role-based access control ekle (owner/manager/staff)
5. Multi-branch veri modeli (phase-gated)

## 17. Kaynaklar
- https://help.gohighlevel.com/support/solutions/articles/155000001662-ai-employee-overview
- https://help.gohighlevel.com/support/solutions/articles/155000000720-workflow-ai-agent-step
- https://www.phorest.com/features/
- https://www.shopmonkey.io/features/
- https://sales.vagaro.com/
- https://www.zenoti.com/
- https://www.joinblvd.com/features
- https://www.servicetitan.com/features
- https://www.jobber.com/features
- https://www.housecallpro.com/features
- https://www.shopify.com/pos
- https://www.klaviyo.com/features
- https://ebelge.gib.gov.tr/anasayfa.html
- https://edefter.gov.tr/index.html
- https://www.reddit.com/r/smallbusiness/comments/wx7xjk/which_crm_are_you_using_for_small_business/
- https://github.com/twentyhq/twenty
- https://github.com/odoo/odoo
- https://github.com/espocrm/espocrm
- https://github.com/salesagility/SuiteCRM

---

## Ek-1: Phase Backlog

# CRM Phase Backlog (Execution-Ready)

## Scope
Bu backlog, 6 aylik planin uygulanabilir teknik parcaciklara ayrilmis halidir.

## Faz-1 (Hafta 1-4): Foundation Freeze
### Epic 1.1 - Blueprint Contract Freeze
- Story: BlueprintDefinition tipini dondur
- Story: Hair/Beauty + Dental/Esthetic + Generic map kesinlestir
- Story: Tenant bazli override sozlesmesini sabitle
- Acceptance:
  - API response versioned
  - Backward compatibility notlari yazili

### Epic 1.2 - Metric Contract Freeze
- Story: Command center KPI hesap kurallari dokumante edilsin
- Story: North-star formulu tek source-of-truth olsun
- Acceptance:
  - KPI formula doc published
  - Snapshot endpoint deterministic

### Epic 1.3 - Audit/Event Standard
- Story: Immutable event table + trigger aktif
- Story: Kritik endpointler event yazar
- Acceptance:
  - Update/delete blocked
  - Event coverage >= %80 critical flows

## Faz-2 (Hafta 5-8): Blueprint Engine v1
### Epic 2.1 - Sector-aware Onboarding
- Story: Tenant creationda blueprint bootstrap
- Story: Compliance profile auto-provision
- Story: Automation defaults auto-provision
- Acceptance:
  - New tenant has blueprint + compliance + baseline automations

### Epic 2.2 - Sector-aware Panel Rendering
- Story: Dashboard modules visibility blueprint-aware
- Story: Resource UI shows sector templates
- Story: KPI cards adapt by blueprint
- Acceptance:
  - Kuafor ve Dis panelleri farkli gorunur/alan sunar

### Epic 2.3 - Resource Capacity Integration
- Story: tenant_resources CRUD full
- Story: Smart calendar capacity uses resource constraints
- Acceptance:
  - Resource status affects slot availability

## Faz-3 (Hafta 9-12): Retention Automation
### Epic 3.1 - Reactivation Engine
- Story: Candidate scoring + risk tiers
- Story: Queue campaign endpoint
- Story: Campaign outcome event model
- Acceptance:
  - Candidate list quality reviewable
  - Queue -> reminders pipeline stable

### Epic 3.2 - Slot Fill Automation
- Story: Cancel event triggers slot-fill candidate generation
- Story: Waitlist + at-risk blended outreach rule
- Acceptance:
  - Cancelled slots have measurable refill rate

### Epic 3.3 - Review Booster
- Story: Reputation summary endpoint
- Story: Low-rating recovery queue
- Acceptance:
  - Low rating follow-up tasks auto-created

## Faz-4 (Hafta 13-16): Revenue OS v1
### Epic 4.1 - Revenue Ledger
- Story: revenue_events full lifecycle
- Story: Summary + source breakdown
- Story: Appointment-to-revenue linking
- Acceptance:
  - Daily/Monthly reconciliation possible

### Epic 4.2 - Finance Integrations
- Story: Connector interface for accounting
- Story: e-belge/e-defter adapter scaffold
- Acceptance:
  - Integration adapter contracts tested

### Epic 4.3 - Staff Contribution
- Story: Revenue by staff report
- Story: Cancellation/no-show impact by staff
- Acceptance:
  - Staff leaderboard with defensible metrics

## Faz-5 (Hafta 17-20): Hardening
### Epic 5.1 - Security
- Story: Role-based access (owner/manager/staff)
- Story: Endpoint-level authorization guards
- Acceptance:
  - Unauthorized access tests pass

### Epic 5.2 - Performance
- Story: Command center query optimization
- Story: Caching and pagination where needed
- Acceptance:
  - Mobile P95 < 2.5s on critical routes

### Epic 5.3 - Multi-tenant Resilience
- Story: Tenant isolation audits
- Story: Load tests for busy tenants
- Acceptance:
  - No cross-tenant leakage

## Faz-6 (Hafta 21-24): Pilot & PMF
### Epic 6.1 - Pilot Rollout
- Story: 10-20 pilot tenant cohort
- Story: Adoption instrumentation
- Acceptance:
  - Weekly usage + action adoption dashboards live

### Epic 6.2 - Packaging & Monetization
- Story: Tiered plan gates
- Story: Trial conversion instrumentation
- Acceptance:
  - Trial-to-paid funnel measurable end-to-end

### Epic 6.3 - PMF Calibration
- Story: Churn interviews + usage telemetry join
- Story: Roadmap reprioritization
- Acceptance:
  - Next 2 quarter roadmap data-driven updated

## Cross-Cutting Work
- Data quality checks
- Analytics tracking
- Backfill migrations
- Rollback playbooks
- Incident runbooks

## Definition of Done (Global)
- API + UI + migration + tests + docs tamam
- Event log coverage korunmus
- KPI definitions unchanged or versioned
- Backward compatibility notes updated

---

## Ek-2: Gap Audit

# CRM Gap Audit (Pass-1 vs Pass-2)

## Method
- Pass-1: Product benchmark and architecture framing
- Pass-2: Deep dive into operational edge cases, user pain points, and implementation feasibility
- Output: Confirmed, missing, over-scoped, and corrected items

## 1. Confirmed Strengths (Plan-Consistent)
1. Multi-tenant + WhatsApp bot core already exists
2. Basic CRM and workflow pages already shipped
3. Service pricing and reminder foundations are available
4. Business type concept already present in schema

## 2. Missing Critical Items (Now Addressed in Code Foundation)
1. Immutable event log standard was missing
- Status: Added (`tenant_event_logs` + mutation prevention trigger)

2. Revenue ledger foundation was missing
- Status: Added (`revenue_events` + summary endpoint)

3. Reactivation segmentation core was missing
- Status: Added (`retention_segments` + reactivation service/endpoints)

4. Blueprint override layer was missing
- Status: Added (`tenant_blueprint_overrides` + blueprint API)

5. Compliance profile centralization was missing
- Status: Added (`compliance_profiles`)

## 3. Still Open Gaps (Next Iterations)
1. Blueprint-aware UI rendering is partial
- Current: Command center integrated on dashboard
- Gap: Full module/field transformation by sector not complete

2. Capacity engine is not resource-constrained yet
- Current: Resource CRUD available
- Gap: Scheduling engine should consume resources in slot computation

3. Revenue ledger is not yet connected to payment providers
- Current: Manual/event-based ledger
- Gap: Live payment webhook ingestion and reconciliation

4. Reactivation queue does not yet close conversion loop automatically
- Current: Reminder queue + event logging
- Gap: Conversion attribution and ROI closure events

5. Role-based access is not enforced at endpoint level
- Current: Tenant layout gate exists in UI flow
- Gap: Strong API-level authorization matrix

## 4. Over-Scoping Corrections
1. Full multi-branch model in first wave
- Decision: Deferred. Keep schema global-ready, execution SMB single-branch first

2. Enterprise-level reporting stack in MVP
- Decision: Deferred. Command center first, deep BI later

3. Universal vertical launch in one shot
- Decision: Deferred. Pilot with Hair/Beauty + Dental/Esthetic

## 5. Data/Schema Risk Findings
1. Legacy environments may miss new columns/tables
- Mitigation: Existing fallback pattern reused (missing schema tolerant routes)

2. Upsert conflicts require correct unique indexes
- Mitigation: Added unique index for `automation_rules(tenant_id, rule_type)`

3. Revenue integrity risk if external payments are not reconciled
- Mitigation: Revenue events accept source/meta; reconciliation phase planned

## 6. Product Risk Findings
1. Too many modules can reduce adoption
- Mitigation: Action-first command center, minimum-click UX

2. Manual operation load for small business owners
- Mitigation: Automation-first defaults and one-click actions

3. KPI ambiguity can erode trust
- Mitigation: Explicit KPI contracts and formulas

## 7. Revised Priorities After Deep Audit
Priority 1:
- Command center reliability
- Reactivation and slot fill outcomes
- Revenue event consistency

Priority 2:
- Blueprint-aware UI deepening
- Resource-aware scheduling
- Reputation recovery automation

Priority 3:
- Finance connectors
- RBAC hardening
- Multi-branch enablement

## 8. Acceptance Gate for Next Sprint
1. Command center endpoint should remain resilient on missing optional tables
2. Reactivation endpoint should queue reminders for selected candidates
3. Revenue summary should return deterministic totals
4. Critical flow endpoints should write immutable events
5. Tenant bootstrap should provision blueprint/compliance/automation defaults when schema supports it

---

## Ek-3: Risk Register

# CRM Risk Register

| ID | Risk | Impact | Likelihood | Early Signal | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | KPI formulas interpreted differently across modules | High | Medium | Dashboard totals mismatch | Single KPI contract + shared service calculations | Product + Eng |
| R-02 | Revenue data incomplete due to missing payment integration | High | High | Ledger net totals diverge from cash | Add reconciliation workflow and payment adapters in phase-4 | Eng |
| R-03 | Reactivation messages create spam perception | Medium | Medium | Opt-out increase, response complaints | Frequency cap, segment-based eligibility, explicit consent policy | Product |
| R-04 | Sector customization remains shallow | High | Medium | Same UI behavior across business types | Blueprint-aware UI rollout with sector acceptance tests | Eng + Design |
| R-05 | API authorization gaps for tenant-level routes | High | Medium | Cross-tenant access attempts | Enforce endpoint-level tenant guards + RBAC in phase-5 | Security |
| R-06 | Legacy schema environments break new features | Medium | High | 500 errors on missing tables | Maintain schema-tolerant fallback logic and migration checklist | Eng |
| R-07 | Event log grows quickly and affects query costs | Medium | Medium | Slow analytics queries | Retention/partition strategy + async analytics pipelines | Eng |
| R-08 | No-show reduction actions fail to move metric | Medium | Medium | No-show rate unchanged after launch | A/B message timing and confirmation strategy | Product |
| R-09 | Compliance requirements change (KVKK/e-belge) | High | Medium | New official circulars | Compliance profile versioning + monthly policy review | Ops |
| R-10 | Over-complex onboarding reduces trial conversion | High | Medium | Drop-off in wizard steps | Reduce required fields, progressive setup defaults | Product |

## Monitoring Cadence
- Weekly: Operational metrics (no-show, fill rate, open alerts)
- Bi-weekly: Retention metrics (at-risk pool, reactivation conversion)
- Monthly: Revenue reconciliation and compliance review

## Escalation Rules
1. If no-show rate rises above 12% for 2 consecutive weeks, trigger incident review.
2. If ledger reconciliation mismatch exceeds 5%, block finance automation expansion.
3. If trial-to-paid drops by 20% month-over-month, freeze feature scope and optimize onboarding.
4. If any tenant isolation issue is detected, treat as Sev-1 and suspend rollout.
