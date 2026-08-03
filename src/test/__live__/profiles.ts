/**
 * Sektör bazlı gerçek işletme profilleri.
 *
 * Amaç yalnızca "bir tenant var" demek değil; canlıdaki bir işletmenin veri
 * yoğunluğunu taklit etmek: personel kadrosu, hizmet paketleri, kısmen DOLU bir
 * takvim, tatil günü, geçmişi olan sadık müşteriler ve bilgi bankası.
 * Boş bir veritabanına karşı yapılan test botun kolay senaryolarını geçirir;
 * gerçek hatalar dolu takvimde ve tanıdık müşteride ortaya çıkar.
 */
import type { Store, Row } from "./fake-supabase";

export type SeedService = { slug: string; name: string; price: number; duration: number };
export type SeedStaff = { id: string; name: string };
export type SeedPackage = {
  id: string;
  name: string;
  serviceSlug: string;
  sessions: number;
  price: number;
};
/** Sadık müşteri: bot onu tanımalı ve geçmişini kullanmalı. */
export type SeedRegular = {
  phone: string;
  name: string;
  visits: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  /** Aktif paketi varsa: paket id'si ve kalan seans. */
  activePackage?: { packageId: string; remaining: number };
};

export type Profile = {
  key: string;
  label: string;
  tenantId: string;
  tenantName: string;
  btSlug: string;
  btName: string;
  tone: "sen" | "siz";
  contactPhone: string;
  workingHoursText: string;
  services: SeedService[];
  staff: SeedStaff[];
  packages: SeedPackage[];
  regulars: SeedRegular[];
  knowledge?: Array<{ category: string; title: string; body: string }>;
  /** 0=Pazar .. 6=Cumartesi */
  openDays: number[];
  hours: { start: string; end: string };
  slotMinutes: number;
  cancellationHours: number;
  /** Gerçek müşterinin kullanacağı doğal hizmet ifadesi. */
  ask: string;
  /** Randevu bağlamı için sektöre özgü ek bilgi (bot sorabiliyor). */
  extraInfo: string;
  /** Yarın dolu olan saatler (her personel için ayrı kayıt açılır). */
  busyTomorrow: string[];
  /** Kaç gün sonrası TAMAMEN dolu. */
  fullDayOffset: number;
  /** Kaç gün sonrası tatil (blocked_dates). */
  holidayOffset: number;
  /** Slot ızgarasına DÜŞEN geçerli bir randevu saati (senaryolar bunu kullanır). */
  bookTime: string;
};

function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "09:00" + 30dk → "09:30" */
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Yerel gün+saati UTC ISO'ya çevirir (Europe/Istanbul = UTC+3). */
function localToUtcIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+03:00`).toISOString();
}

function botConfig(p: {
  persona: string;
  opening: string;
  confirmation: string;
  formal: boolean;
}): Row {
  return {
    bot_persona: p.persona,
    opening_message: p.opening,
    returning_customer_message: "Tekrar hoş geldiniz!",
    required_fields: [
      {
        key: "customer_name",
        label: "Ad",
        type: "text",
        question: "Randevuyu kimin adına alayım?",
      },
    ],
    optional_fields: [],
    messages: {
      confirmation: p.confirmation,
      reminder_24h: "{date} saat {time} randevunuzu hatırlatırız.",
      reminder_1h: "1 saat sonra randevunuz var.",
      cancellation_by_customer: "Randevunuzu iptal ettim.",
      cancellation_by_tenant: "Randevunuz işletme tarafından iptal edildi.",
      no_show: "Randevunuza gelemediniz.",
      review_request: "Deneyiminizi puanlar mısınız?",
      human_escalation:
        "Bu konuda size ekibimiz yardımcı olsun. Telefon: {contact_phone} · Saatler: {working_hours}",
      no_availability: "O gün için uygun saat kalmamış.",
      date_blocked: "O tarihte kapalıyız.",
      welcome_back: "Tekrar hoş geldiniz.",
      waitlist_added: "Bekleme listesine eklendiniz.",
      waitlist_available: "Yer açıldı!",
      rescheduled: "Randevunuzu {date} saat {time} olarak güncelledim.",
      daily_summary: "Günlük özet.",
      system_error: "Bir sorun oldu, biraz sonra tekrar dener misiniz?",
    },
    tone: {
      style: p.formal ? "profesyonel" : "samimi",
      emoji_set: [],
      use_formal: p.formal,
      response_length: "kisa",
      use_customer_name: true,
    },
    examples: [],
    custom_questions: [],
    summary_template: "{customer_name} · {date} {time}",
    has_services: true,
    has_slot_count: false,
    has_address: false,
    has_pickup_delivery: false,
    has_item_info: false,
  };
}

export const PROFILES: Profile[] = [
  {
    key: "berber",
    bookTime: "13:00",
    label: "Berber / Kuaför",
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantName: "Ahi Berber",
    btSlug: "kuafor-guzellik",
    btName: "Kuaför / Güzellik Salonu",
    tone: "sen",
    contactPhone: "+905321112233",
    workingHoursText: "Pazartesi-Cumartesi 09:00-19:00",
    openDays: [1, 2, 3, 4, 5, 6],
    hours: { start: "09:00", end: "19:00" },
    slotMinutes: 30,
    cancellationHours: 2,
    ask: "saç kesimi",
    extraInfo: "sadece kesim olsun",
    busyTomorrow: ["10:00", "10:30", "11:00", "15:00"],
    fullDayOffset: 3,
    holidayOffset: 6,
    services: [
      { slug: "sac-kesimi", name: "Saç Kesimi", price: 450, duration: 30 },
      { slug: "sakal", name: "Sakal Tıraşı", price: 250, duration: 20 },
      { slug: "sac-sakal", name: "Saç + Sakal", price: 650, duration: 45 },
      { slug: "boya", name: "Saç Boyama", price: 1200, duration: 90 },
      { slug: "cocuk-kesim", name: "Çocuk Saç Kesimi", price: 300, duration: 30 },
    ],
    staff: [
      { id: "staff_berber_1", name: "Ahmet Usta" },
      { id: "staff_berber_2", name: "Mehmet Usta" },
    ],
    packages: [
      { id: "pkg_berber_1", name: "5'li Saç Kesimi Paketi", serviceSlug: "sac-kesimi", sessions: 5, price: 2000 },
    ],
    regulars: [
      {
        phone: "+905551110001",
        name: "Hasan Kara",
        visits: 12,
        notes: "Her zaman Ahmet Usta'yı tercih eder, makine 2 numara.",
        activePackage: { packageId: "pkg_berber_1", remaining: 3 },
      },
    ],
    knowledge: [
      {
        category: "policy",
        title: "Otopark",
        body: "Dükkânın karşısındaki otoparkta müşterilerimize 1 saat ücretsiz park imkânı var.",
      },
      {
        category: "campaign",
        title: "Öğrenci indirimi",
        body: "Hafta içi 09:00-12:00 arası öğrencilere saç kesiminde %20 indirim uygulanır.",
      },
      {
        category: "policy",
        title: "Ödeme",
        body: "Nakit ve kredi kartı geçerlidir. Kapıda temassız ödeme mevcut.",
      },
    ],
  },
  {
    key: "dis",
    bookTime: "13:00",
    label: "Diş Kliniği",
    tenantId: "22222222-2222-4222-8222-222222222222",
    tenantName: "Ahi Diş Kliniği",
    btSlug: "dis-klinigi",
    btName: "Diş Kliniği / Gülüş Estetiği",
    tone: "siz",
    contactPhone: "+905322223344",
    workingHoursText: "Pazartesi-Cuma 09:00-18:00",
    openDays: [1, 2, 3, 4, 5],
    hours: { start: "09:00", end: "18:00" },
    slotMinutes: 30,
    cancellationHours: 24,
    ask: "diş taşı temizliği",
    extraInfo: "sigortam yok, kendim ödeyeceğim",
    busyTomorrow: ["09:00", "11:00", "14:00", "14:30"],
    fullDayOffset: 4,
    holidayOffset: 7,
    services: [
      { slug: "muayene", name: "Muayene", price: 500, duration: 30 },
      { slug: "dis-temizligi", name: "Diş Taşı Temizliği", price: 1500, duration: 45 },
      { slug: "dolgu", name: "Dolgu", price: 2000, duration: 45 },
      { slug: "kanal", name: "Kanal Tedavisi", price: 4500, duration: 60 },
      { slug: "beyazlatma", name: "Diş Beyazlatma", price: 6000, duration: 60 },
    ],
    staff: [
      { id: "staff_dis_1", name: "Dr. Selin Aydın" },
      { id: "staff_dis_2", name: "Dr. Kaan Yılmaz" },
    ],
    packages: [],
    regulars: [
      {
        phone: "+905552220001",
        name: "Fatma Şen",
        visits: 4,
        notes: "Dr. Selin'in hastası. Kanal tedavisi devam ediyor.",
        metadata: { preferred_doctor: "Dr. Selin Aydın" },
      },
    ],
    knowledge: [
      {
        category: "policy",
        title: "Anlaşmalı sigortalar",
        body: "Allianz ve Anadolu Sigorta ile anlaşmamız var. Poliçe bilgisi muayene sırasında alınır.",
      },
      {
        category: "policy",
        title: "Taksit",
        body: "3000 TL üzeri tedavilerde kredi kartına 6 taksit imkânı sunulmaktadır.",
      },
    ],
  },
  {
    key: "lazer",
    bookTime: "13:00",
    label: "Lazer Epilasyon / Estetik",
    tenantId: "33333333-3333-4333-8333-333333333333",
    tenantName: "Ahi Estetik",
    btSlug: "lazer-epilasyon",
    btName: "Lazer Epilasyon / Medikal Estetik",
    tone: "siz",
    contactPhone: "+905323334455",
    workingHoursText: "Pazartesi-Cumartesi 10:00-20:00",
    openDays: [1, 2, 3, 4, 5, 6],
    hours: { start: "10:00", end: "20:00" },
    slotMinutes: 30,
    cancellationHours: 12,
    ask: "koltuk altı lazer epilasyon",
    extraInfo: "daha önce hiç yaptırmadım",
    busyTomorrow: ["11:00", "12:00", "16:00"],
    fullDayOffset: 3,
    holidayOffset: 5,
    services: [
      { slug: "lazer-bacak", name: "Lazer Epilasyon - Bacak", price: 1800, duration: 45 },
      { slug: "lazer-koltukalti", name: "Lazer Epilasyon - Koltuk Altı", price: 600, duration: 20 },
      { slug: "lazer-tumvucut", name: "Lazer Epilasyon - Tüm Vücut", price: 4500, duration: 90 },
      { slug: "cilt-bakimi", name: "Cilt Bakımı", price: 1500, duration: 60 },
      { slug: "leke-bakimi", name: "Leke Bakımı", price: 2200, duration: 60 },
    ],
    staff: [
      { id: "staff_lazer_1", name: "Uzman Ayşe" },
      { id: "staff_lazer_2", name: "Uzman Elif" },
    ],
    packages: [
      { id: "pkg_lazer_1", name: "8 Seans Koltuk Altı", serviceSlug: "lazer-koltukalti", sessions: 8, price: 4000 },
      { id: "pkg_lazer_2", name: "8 Seans Bacak", serviceSlug: "lazer-bacak", sessions: 8, price: 12000 },
    ],
    regulars: [
      {
        phone: "+905553330001",
        name: "Merve Tunç",
        visits: 6,
        notes: "Koltuk altı paketinde 5. seansta. Son seans 4 hafta önce.",
        activePackage: { packageId: "pkg_lazer_1", remaining: 3 },
      },
    ],
    knowledge: [
      {
        category: "policy",
        title: "Seans öncesi hazırlık",
        body: "Seanstan önce bölge jiletle tıraş edilmeli; ağda ve tüy dökücü krem kullanılmamalıdır.",
      },
    ],
  },
  {
    key: "oto",
    bookTime: "13:30",
    label: "Oto Servis",
    tenantId: "44444444-4444-4444-8444-444444444444",
    tenantName: "Ahi Oto Servis",
    btSlug: "oto-servis",
    btName: "Oto Servis",
    tone: "sen",
    contactPhone: "+905324445566",
    workingHoursText: "Pazartesi-Cumartesi 08:30-18:30",
    openDays: [1, 2, 3, 4, 5, 6],
    hours: { start: "08:30", end: "18:30" },
    slotMinutes: 60,
    cancellationHours: 2,
    ask: "yağ değişimi",
    extraInfo: "aracım Ford Focus 2019",
    busyTomorrow: ["09:30", "11:30"],
    fullDayOffset: 2,
    holidayOffset: 6,
    services: [
      { slug: "periyodik-bakim", name: "Periyodik Bakım", price: 3500, duration: 120 },
      { slug: "yag-degisimi", name: "Yağ Değişimi", price: 1800, duration: 60 },
      { slug: "fren-bakim", name: "Fren Bakımı", price: 2500, duration: 90 },
      { slug: "lastik", name: "Lastik Değişimi", price: 800, duration: 45 },
      { slug: "aku", name: "Akü Değişimi", price: 2800, duration: 30 },
    ],
    staff: [{ id: "staff_oto_1", name: "Usta İbrahim" }],
    packages: [],
    regulars: [
      {
        phone: "+905554440001",
        name: "Kemal Doğan",
        visits: 8,
        notes: "Renault Megane 2017. Her 10.000 km'de periyodik bakım yaptırır.",
        metadata: { vehicle: "Renault Megane 2017" },
      },
    ],
    knowledge: [
      {
        category: "policy",
        title: "Yedek araç",
        body: "Periyodik bakım süresince talep eden müşterilerimize ücretsiz servis aracı sağlanır.",
      },
    ],
  },
  {
    key: "veteriner",
    bookTime: "13:00",
    label: "Veteriner Kliniği",
    tenantId: "55555555-5555-4555-8555-555555555555",
    tenantName: "Ahi Veteriner",
    btSlug: "veteriner",
    btName: "Veteriner Kliniği",
    tone: "siz",
    contactPhone: "+905325556677",
    workingHoursText: "Her gün 09:00-19:00",
    openDays: [0, 1, 2, 3, 4, 5, 6],
    hours: { start: "09:00", end: "19:00" },
    slotMinutes: 30,
    cancellationHours: 4,
    ask: "aşı",
    extraInfo: "kedim var, adı Pamuk",
    busyTomorrow: ["10:00", "13:00", "17:00"],
    fullDayOffset: 4,
    holidayOffset: 8,
    services: [
      { slug: "muayene", name: "Genel Muayene", price: 700, duration: 30 },
      { slug: "asi", name: "Aşı", price: 900, duration: 20 },
      { slug: "tiras", name: "Tıraş / Bakım", price: 1200, duration: 60 },
      { slug: "kontrol", name: "Ameliyat Sonrası Kontrol", price: 500, duration: 20 },
    ],
    staff: [{ id: "staff_vet_1", name: "Vet. Hekim Deniz" }],
    packages: [],
    regulars: [
      {
        phone: "+905555550001",
        name: "Elif Yıldız",
        visits: 5,
        notes: "Golden Retriever 'Zeyna'. Kuduz aşısı geçen yıl yapıldı.",
        metadata: { pet_name: "Zeyna", pet_species: "Köpek" },
      },
    ],
    knowledge: [
      {
        category: "policy",
        title: "Acil durumlar",
        body: "Mesai dışı acil durumlarda klinik nöbetçi hattı 7/24 aktiftir.",
      },
    ],
  },
];

export function buildStore(p: Profile): Store {
  const businessType: Row = {
    id: `bt_${p.key}`,
    slug: p.btSlug,
    name: p.btName,
    config: { flow_type: "appointment" },
    bot_config: botConfig({
      persona: `${p.tenantName} asistanı`,
      opening: `Merhaba! Ben ${p.tenantName} asistanıyım, nasıl yardımcı olabilirim?`,
      confirmation:
        p.tone === "siz"
          ? "Randevunuzu oluşturdum: {date} saat {time}. Görüşmek üzere!"
          : "Tamam, {date} saat {time} için yazdım seni.",
      formal: p.tone === "siz",
    }),
  };

  const tenant: Row = {
    id: p.tenantId,
    name: p.tenantName,
    tenant_code: p.key.toUpperCase(),
    status: "active",
    deleted_at: null,
    timezone: "Europe/Istanbul",
    contact_phone: p.contactPhone,
    working_hours_text: p.workingHoursText,
    business_type_id: businessType.id,
    business_types: businessType,
    config_override: {
      messages: { tone: p.tone },
      slot_duration_minutes: p.slotMinutes,
      cancellation_hours: p.cancellationHours,
      advance_booking_days: 30,
      default_working_hours: p.hours,
      default_working_days: p.openDays,
    },
  };

  const availability_slots: Row[] = p.openDays.map((d) => ({
    id: `slot_${p.key}_${d}`,
    tenant_id: p.tenantId,
    day_of_week: d,
    start_time: p.hours.start,
    end_time: p.hours.end,
    staff_id: null,
  }));

  const services: Row[] = p.services.map((s, i) => ({
    id: `svc_${p.key}_${i}`,
    tenant_id: p.tenantId,
    slug: s.slug,
    name: s.name,
    price: s.price,
    duration_minutes: s.duration,
    is_active: true,
    active: true,
    deleted_at: null,
    sort_order: i,
  }));

  const staff: Row[] = p.staff.map((s) => ({
    id: s.id,
    tenant_id: p.tenantId,
    name: s.name,
    phone_e164: null,
    active: true,
  }));

  // Her personel her hizmeti verebilir. Eşleme YOKSA booking.service personeli
  // "uygun değil" sayıp tek kaynağa düşüyor — kapasite sessizce yanlış olurdu.
  const staff_services: Row[] = p.staff.flatMap((s) =>
    p.services.map((svc) => ({
      id: `ss_${s.id}_${svc.slug}`,
      tenant_id: p.tenantId,
      staff_id: s.id,
      service_slug: svc.slug,
    }))
  );

  const packages: Row[] = p.packages.map((pk) => ({
    id: pk.id,
    tenant_id: p.tenantId,
    name: pk.name,
    service_slug: pk.serviceSlug,
    total_sessions: pk.sessions,
    price: pk.price,
    validity_days: 365,
    is_active: true,
  }));

  // ── Dolu takvim ───────────────────────────────────────────────────────────
  const appointments: Row[] = [];
  const staffIds = p.staff.length ? p.staff.map((s) => s.id) : [null];
  let aptSeq = 0;
  const addAppointment = (
    date: string,
    time: string,
    staffId: string | null,
    name: string
  ) => {
    appointments.push({
      id: `apt_seed_${p.key}_${++aptSeq}`,
      tenant_id: p.tenantId,
      staff_id: staffId,
      customer_phone: `+9053100${String(aptSeq).padStart(5, "0")}`,
      slot_start: localToUtcIso(date, time),
      status: "confirmed",
      service_slug: p.services[0].slug,
      extra_data: { customer_name: name, duration_minutes: p.slotMinutes },
      created_at: new Date().toISOString(),
    });
  };

  // Yarın kısmen dolu
  for (const time of p.busyTomorrow) {
    for (const sid of staffIds) addAppointment(isoDay(1), time, sid, "Dolu Slot");
  }

  // Belirli bir gün TAMAMEN dolu → "o gün dolu, başka gün önereyim mi?" testi
  const fullDate = isoDay(p.fullDayOffset);
  for (let t = p.hours.start; t < p.hours.end; t = addMinutes(t, p.slotMinutes)) {
    for (const sid of staffIds) addAppointment(fullDate, t, sid, "Dolu Gün");
  }

  const blocked_dates: Row[] = [
    {
      id: `blk_${p.key}`,
      tenant_id: p.tenantId,
      start_date: isoDay(p.holidayOffset),
      end_date: isoDay(p.holidayOffset),
      reason: "Resmî tatil",
    },
  ];

  // ── Sadık müşteriler ──────────────────────────────────────────────────────
  const crm_customers: Row[] = p.regulars.map((r, i) => ({
    id: `crm_${p.key}_${i}`,
    tenant_id: p.tenantId,
    customer_phone: r.phone,
    customer_name: r.name,
    total_visits: r.visits,
    last_visit_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    notes_summary: r.notes ?? null,
    metadata: r.metadata ?? {},
    pipeline_stage: "customer",
  }));

  const customer_packages: Row[] = p.regulars
    .filter((r) => r.activePackage)
    .map((r, i) => {
      const pk = p.packages.find((x) => x.id === r.activePackage!.packageId)!;
      return {
        id: `cpkg_${p.key}_${i}`,
        tenant_id: p.tenantId,
        customer_phone: r.phone,
        package_id: pk.id,
        remaining_sessions: r.activePackage!.remaining,
        total_sessions: pk.sessions,
        status: "active",
        expires_at: null,
        purchased_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(),
        // Fake join hedefi: `packages!inner(...)` embed'i böyle çözülüyor.
        packages: {
          id: pk.id,
          name: pk.name,
          service_slug: pk.serviceSlug,
          is_active: true,
        },
      };
    });

  // Sadık müşterinin geçmiş randevuları (bot "geçen sefer" diyebilmeli)
  for (const r of p.regulars) {
    for (let k = 1; k <= Math.min(3, r.visits); k++) {
      appointments.push({
        id: `apt_hist_${p.key}_${r.phone}_${k}`,
        tenant_id: p.tenantId,
        staff_id: staffIds[0],
        customer_phone: r.phone,
        slot_start: localToUtcIso(isoDay(-30 * k), "14:00"),
        status: "completed",
        service_slug: p.services[0].slug,
        extra_data: { customer_name: r.name },
        created_at: new Date().toISOString(),
      });
    }
  }

  const tenant_knowledge_entries: Row[] = (p.knowledge || []).map((k, i) => ({
    id: `kn_${p.key}_${i}`,
    tenant_id: p.tenantId,
    title: k.title,
    body: k.body,
    category: k.category,
    status: "approved",
    version: 1,
    effective_from: null,
    effective_until: null,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const reviews: Row[] = [
    {
      id: `rev_${p.key}_1`,
      tenant_id: p.tenantId,
      rating: 5,
      comment: "Çok memnun kaldım.",
      created_at: new Date().toISOString(),
      skipped: false,
    },
  ];

  return {
    tenants: [tenant],
    business_types: [businessType],
    services,
    staff,
    staff_services,
    availability_slots,
    packages,
    customer_packages,
    crm_customers,
    tenant_knowledge_entries,
    appointments,
    blocked_dates,
    reviews,
    conversations: [],
    customer_blacklist: [],
    waitlist: [],
    ops_alerts: [],
    domain_events: [],
  };
}

export { isoDay };
