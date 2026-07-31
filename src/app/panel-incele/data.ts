export type DemoNavKey =
  | "overview"
  | "appointments"
  | "messages"
  | "workflow"
  | "crm"
  | "campaigns"
  | "pricing"
  | "packages"
  | "staff"
  | "settings";

export type AptStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface DemoAppointment {
  id: string;
  time: string;
  end: string;
  dateLabel: string;
  dayKey: "today" | "tomorrow" | "monday";
  customer: string;
  phone: string;
  service: string;
  staff: string;
  duration: number;
  price: number;
  status: AptStatus;
  note?: string;
}

export interface DemoMessage {
  id: string;
  customer: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  thread: { from: "customer" | "bot" | "staff"; text: string; time: string }[];
}

export interface DemoCustomer {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  visits: number;
  lastVisit: string;
  totalSpend: number;
  notes: string;
}

export interface DemoAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  resolved: boolean;
}

export const DEMO_BUSINESS = {
  name: "Salon Mira",
  code: "MIRA-204",
  sector: "Kuaför & Güzellik",
  city: "İstanbul",
  whatsapp: "+90 532 000 00 00",
} as const;

export const DEMO_GUIDES: Record<
  DemoNavKey,
  { title: string; summary: string; points: string[] }
> = {
  overview: {
    title: "Özet — Günlük kontrol merkezi",
    summary:
      "Panele girdiğinizde ilk gördüğünüz ekran budur. Bugünün nabzını, gelir durumunu ve hemen aksiyon gerektiren işleri tek bakışta verir.",
    points: [
      "Aylık ciro, doluluk, gelmeme oranı ve riskli müşteri sayıları canlı güncellenir.",
      "Önerilen aksiyonlar (hatırlatma, geri kazanım, onay bekleyenler) tek tıkla çalıştırılır.",
      "Açık bildirimler — gecikme, iptal, gelmeme — burada listelenir; çözdüğünüzde listeden düşer.",
      "Gerçek panelde bu veriler WhatsApp randevularınız ve işletme ayarlarınızdan üretilir.",
    ],
  },
  appointments: {
    title: "Randevular — Takvim ve durum yönetimi",
    summary:
      "Günün ve haftanın tüm randevularını görür, onaylar, iptal eder veya gelmedi işaretlersiniz. Yeni randevu da buradan eklenir.",
    points: [
      "Durumlar: Bekliyor → Onaylı → Tamamlandı / İptal / Gelmedi.",
      "Her kartta müşteri, hizmet, personel, süre ve fiyat görünür.",
      "Onay / iptal butonları gerçek panelde müşteriye WhatsApp bilgilendirmesi tetikleyebilir.",
      "Personel ve tarih filtreleriyle ekip temposunu ayırırsınız.",
    ],
  },
  messages: {
    title: "Mesajlar — WhatsApp sohbetleri",
    summary:
      "Müşterilerin yazdığı sohbetler burada toplanır. Asistan çoğu soruyu yanıtlar; siz özel durumlarda devralırsınız.",
    points: [
      "Okunmamış sohbetler üstte ve rozetle işaretlenir.",
      "Asistan cevapları ile personel cevapları aynı akışta görünür.",
      "Randevu talebi sohbetten randevu kartına bağlanır.",
      "Gerçek kullanımda Twilio / WhatsApp hattınız bu listeyi besler.",
    ],
  },
  workflow: {
    title: "İş Akışı — Kanban tahtası",
    summary:
      "Randevuları sütunlar arasında sürükleyerek (veya taşıyarak) ekibin ortak durum tahtasını yönetirsiniz.",
    points: [
      "Sütunlar: Bekleyen → Onaylı → Tamamlandı / İptal / Gelmedi.",
      "Yoğun günlerde ‘kim nerede?’ sorusuna hızlı cevap verir.",
      "Gelmedi ve iptal sütunları kampanya / hatırlatma fırsatına dönüşür.",
    ],
  },
  crm: {
    title: "Müşteri Defteri — Hafıza ve notlar",
    summary:
      "Kim geldi, ne yaptırdı, hangi not bırakıldı — hepsi telefon numarasına bağlı bir defterde kalır.",
    points: [
      "Etiketler (VIP, renk, paket) kampanya ve filtrelerde kullanılır.",
      "Notlar bir sonraki ziyarette personele hatırlatılır.",
      "Son ziyaret ve toplam harcama ile uzaklaşan müşteriyi görürsünüz.",
    ],
  },
  campaigns: {
    title: "Kampanyalar — Toplu mesaj ve geri kazanım",
    summary:
      "Seçtiğiniz kitleye WhatsApp veya SMS ile kampanya gönderirsiniz. Geçmiş gönderimler burada durur.",
    points: [
      "Etikete veya ‘30 gündür gelmeyen’ gibi filtrelere göre alıcı seçilir.",
      "Gönderim öncesi önizleme ve alıcı sayısı görünür.",
      "Başarı / başarısız sayıları kayıt altına alınır.",
    ],
  },
  pricing: {
    title: "Fiyat Listesi — Hizmet kataloğu",
    summary:
      "Asistanın ve panelin kullandığı resmi fiyat / süre listesi buradadır. Müşteri ‘ne kadar?’ diye sorunca buradan cevaplanır.",
    points: [
      "Hizmet adı, süre, fiyat ve aktif/pasif durumu.",
      "Güncelleme hem sohbete hem randevu formuna yansır.",
      "Paketli hizmetler paket ekranıyla birlikte çalışır.",
    ],
  },
  packages: {
    title: "Paket & Seans — Çoklu seans takibi",
    summary:
      "6 seanslık bakım gibi paketleri satar, kalan seansı ve bitiş tarihini buradan izlersiniz.",
    points: [
      "Müşteri paketten randevu aldıkça kalan hak düşer.",
      "Biten paketler yenileme kampanyasına aday olur.",
    ],
  },
  staff: {
    title: "Personel — Ekip ve takvim",
    summary:
      "Kim hangi hizmeti veriyor, çalışma günleri nedir, bugün doluluk nasıl — personel bazlı planlama buradadır.",
    points: [
      "Müşteri ‘Ayşe ablayla istiyorum’ derse tercih buradan okunur.",
      "İzin / kapalı günler takvime işlenir.",
    ],
  },
  settings: {
    title: "Ayarlar — İşletme kuralları",
    summary:
      "Çalışma saatleri, karşılama mesajı, WhatsApp bağlantısı, QR kod ve bildirim tercihleri burada tanımlanır.",
    points: [
      "Saatler boşsa asistan doğru randevu veremez — önce burası doldurulur.",
      "Karşılama metni ilk mesajda otomatik gider.",
      "QR ve kısa link vitrininize asılır; müşteri tek dokunuşla yazar.",
    ],
  },
};

function formatDayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function buildInitialAppointments(): DemoAppointment[] {
  const todayLabel = formatDayLabel(0);
  const tomorrowLabel = formatDayLabel(1);
  return [
    {
      id: "a1",
      time: "09:30",
      end: "10:15",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Ayşe Yılmaz",
      phone: "0532 111 22 33",
      service: "Kadın Saç Kesimi",
      staff: "Elif",
      duration: 45,
      price: 450,
      status: "completed",
      note: "Önceki kesim kısa kalsın istemişti",
    },
    {
      id: "a2",
      time: "10:30",
      end: "12:00",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Zeynep Aksoy",
      phone: "0533 444 55 66",
      service: "Dip Boya + Fön",
      staff: "Elif",
      duration: 90,
      price: 1200,
      status: "confirmed",
    },
    {
      id: "a3",
      time: "11:00",
      end: "11:45",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Mehmet Kara",
      phone: "0541 222 33 44",
      service: "Erkek Kesim + Sakal",
      staff: "Can",
      duration: 45,
      price: 350,
      status: "pending",
      note: "WhatsApp’tan az önce yazdı",
    },
    {
      id: "a4",
      time: "13:30",
      end: "14:30",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Deniz Öztürk",
      phone: "0505 777 88 99",
      service: "Keratin Bakım",
      staff: "Selin",
      duration: 60,
      price: 1800,
      status: "confirmed",
    },
    {
      id: "a5",
      time: "15:00",
      end: "16:00",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Burcu Şahin",
      phone: "0536 999 00 11",
      service: "Manikür + Pedikür",
      staff: "Selin",
      duration: 60,
      price: 700,
      status: "confirmed",
    },
    {
      id: "a6",
      time: "16:30",
      end: "17:15",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Emre Demir",
      phone: "0542 333 44 55",
      service: "Erkek Kesim",
      staff: "Can",
      duration: 30,
      price: 250,
      status: "pending",
    },
    {
      id: "a7",
      time: "10:00",
      end: "11:30",
      dateLabel: tomorrowLabel,
      dayKey: "tomorrow",
      customer: "Ceren Aydın",
      phone: "0530 121 34 56",
      service: "Gelin Prova",
      staff: "Elif",
      duration: 90,
      price: 2500,
      status: "confirmed",
    },
    {
      id: "a8",
      time: "14:00",
      end: "15:00",
      dateLabel: tomorrowLabel,
      dayKey: "tomorrow",
      customer: "Hande Kılıç",
      phone: "0535 676 89 01",
      service: "Saç Bakım Paketi",
      staff: "Selin",
      duration: 60,
      price: 950,
      status: "pending",
    },
  ];
}

export const DEMO_MESSAGES: DemoMessage[] = [
  {
    id: "m1",
    customer: "Mehmet Kara",
    phone: "0541 222 33 44",
    preview: "Bugün 11’e uygun musunuz?",
    time: "10:42",
    unread: true,
    thread: [
      { from: "customer", text: "Merhaba, bugün 11’e erkek kesim uygun mu?", time: "10:40" },
      {
        from: "bot",
        text: "Merhaba Mehmet Bey 👋 Can ile 11:00 uygun. Onaylarsanız randevuyu oluşturayım.",
        time: "10:40",
      },
      { from: "customer", text: "Evet onaylıyorum.", time: "10:42" },
      {
        from: "bot",
        text: "Randevunuz oluşturuldu: Bugün 11:00 · Erkek Kesim + Sakal · Can. Panelden onay bekliyor.",
        time: "10:42",
      },
    ],
  },
  {
    id: "m2",
    customer: "Ayşe Yılmaz",
    phone: "0532 111 22 33",
    preview: "Teşekkürler, çok beğendim!",
    time: "10:20",
    unread: false,
    thread: [
      {
        from: "bot",
        text: "Ayşe Hanım, randevunuz tamamlandı. Değerlendirme bırakmak ister misiniz?",
        time: "10:18",
      },
      { from: "customer", text: "Teşekkürler, çok beğendim!", time: "10:20" },
    ],
  },
  {
    id: "m3",
    customer: "Burcu Şahin",
    phone: "0536 999 00 11",
    preview: "15:00’ü 15:30 yapabilir miyiz?",
    time: "Dün",
    unread: true,
    thread: [
      { from: "customer", text: "Selam, yarın değil bugün 15:00 randevum var. 15:30 yapabilir miyiz?", time: "Dün 21:10" },
      {
        from: "bot",
        text: "Kontrol ediyorum… Selin’in 15:30’u şu an dolu. 15:00 veya 16:30 önerebilirim.",
        time: "Dün 21:10",
      },
      { from: "customer", text: "O zaman 15:00 kalsın.", time: "Dün 21:12" },
    ],
  },
  {
    id: "m4",
    customer: "Ceren Aydın",
    phone: "0530 121 34 56",
    preview: "Gelin prova için neler getirmeliyim?",
    time: "Dün",
    unread: false,
    thread: [
      { from: "customer", text: "Yarın gelin prova var, neler getirmeliyim?", time: "Dün 18:00" },
      {
        from: "staff",
        text: "Saç aksesuarınız ve tercih ettiğiniz fotoğraflar yeterli. 10:00’da sizi bekliyoruz.",
        time: "Dün 18:05",
      },
    ],
  },
];

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    id: "c1",
    name: "Ayşe Yılmaz",
    phone: "0532 111 22 33",
    tags: ["VIP", "Renk"],
    visits: 14,
    lastVisit: "Bugün",
    totalSpend: 12600,
    notes: "Kısa katlı kesim tercih ediyor. Kahve ikramı hatırlat.",
  },
  {
    id: "c2",
    name: "Zeynep Aksoy",
    phone: "0533 444 55 66",
    tags: ["Paket"],
    visits: 6,
    lastVisit: "12 gün önce",
    totalSpend: 8400,
    notes: "Ammonyak hassasiyeti var — ürün notu önemli.",
  },
  {
    id: "c3",
    name: "Mehmet Kara",
    phone: "0541 222 33 44",
    tags: ["Yeni"],
    visits: 1,
    lastVisit: "İlk randevu",
    totalSpend: 0,
    notes: "WhatsApp’tan geldi, Can tercih etti.",
  },
  {
    id: "c4",
    name: "Deniz Öztürk",
    phone: "0505 777 88 99",
    tags: ["VIP"],
    visits: 9,
    lastVisit: "3 hafta önce",
    totalSpend: 15200,
    notes: "Keratin sonrası 48 saat yıkama uyarısı verildi.",
  },
  {
    id: "c5",
    name: "Hande Kılıç",
    phone: "0535 676 89 01",
    tags: ["Riskli", "Paket"],
    visits: 4,
    lastVisit: "41 gün önce",
    totalSpend: 3800,
    notes: "Uzun süredir gelmedi — kampanya adayı.",
  },
];

export const DEMO_PRICING = [
  { id: "p1", name: "Kadın Saç Kesimi", duration: 45, price: 450, active: true },
  { id: "p2", name: "Erkek Kesim", duration: 30, price: 250, active: true },
  { id: "p3", name: "Erkek Kesim + Sakal", duration: 45, price: 350, active: true },
  { id: "p4", name: "Dip Boya + Fön", duration: 90, price: 1200, active: true },
  { id: "p5", name: "Keratin Bakım", duration: 60, price: 1800, active: true },
  { id: "p6", name: "Manikür + Pedikür", duration: 60, price: 700, active: true },
  { id: "p7", name: "Gelin Prova", duration: 90, price: 2500, active: true },
  { id: "p8", name: "Çocuk Kesim", duration: 25, price: 180, active: false },
];

export const DEMO_PACKAGES = [
  {
    id: "pk1",
    customer: "Zeynep Aksoy",
    name: "6 Seans Bakım",
    remaining: 3,
    total: 6,
    expires: "12 Eyl 2026",
  },
  {
    id: "pk2",
    customer: "Hande Kılıç",
    name: "4 Seans Renk",
    remaining: 1,
    total: 4,
    expires: "3 Ağu 2026",
  },
  {
    id: "pk3",
    customer: "Ayşe Yılmaz",
    name: "VIP Bakım Kartı",
    remaining: 5,
    total: 8,
    expires: "1 Ara 2026",
  },
];

export const DEMO_STAFF = [
  { id: "s1", name: "Elif Y.", role: "Usta · Kesim & Renk", today: 3, hours: "09:00–18:00", off: false },
  { id: "s2", name: "Can T.", role: "Erkek Kuaför", today: 2, hours: "10:00–19:00", off: false },
  { id: "s3", name: "Selin A.", role: "Bakım & Nail", today: 2, hours: "10:00–18:00", off: false },
  { id: "s4", name: "Merve K.", role: "Yardımcı", today: 0, hours: "—", off: true },
];

export const DEMO_CAMPAIGNS = [
  {
    id: "cp1",
    title: "41+ gün gelmeyenler",
    message: "Merhaba {{ad}}, sizi özledik 🌿 Bu hafta bakımda %15. Randevu için yazmanız yeterli.",
    recipients: 28,
    sent: 26,
    failed: 2,
    channel: "WhatsApp",
    date: "24 Tem 2026",
  },
  {
    id: "cp2",
    title: "VIP renk müşterileri",
    message: "Yeni sezon renk kartelimizi özel sizin için ayırdık. Uygun saat için yazın.",
    recipients: 12,
    sent: 12,
    failed: 0,
    channel: "WhatsApp",
    date: "12 Tem 2026",
  },
];

export const INITIAL_ALERTS: DemoAlert[] = [
  {
    id: "al1",
    severity: "high",
    title: "Onay bekleyen randevu",
    message: "Mehmet Kara · 11:00 Erkek Kesim + Sakal — WhatsApp’tan geldi, onayınızı bekliyor.",
    resolved: false,
  },
  {
    id: "al2",
    severity: "medium",
    title: "Riskli müşteri",
    message: "Hande Kılıç 41 gündür gelmedi. Paketinden 1 seans kaldı — geri kazanım önerildi.",
    resolved: false,
  },
  {
    id: "al3",
    severity: "low",
    title: "Yarın yoğun",
    message: "Yarın 10:00 gelin prova + öğleden sonra bakım dolu. Ek personel planı düşünün.",
    resolved: false,
  },
];

export const DEMO_ACTIONS = [
  {
    id: "act1",
    title: "Bekleyen 2 randevuyu onayla",
    description: "WhatsApp’tan gelen talepler müşteriye dönüş için onayınızı bekliyor.",
    severity: "high" as const,
    cta: "Onayla",
    impact: 600,
  },
  {
    id: "act2",
    title: "Hande Kılıç’a geri kazanım gönder",
    description: "41 gündür gelmeyen paket müşterisine hazır mesaj şablonu var.",
    severity: "medium" as const,
    cta: "Mesajı hazırla",
    impact: 950,
  },
  {
    id: "act3",
    title: "Yarın için hatırlatma gönder",
    description: "Yarınki 2 randevuya otomatik hatırlatma kuyruğa alınabilir.",
    severity: "low" as const,
    cta: "Kuyruğa al",
    impact: 0,
  },
];

export const DEMO_KPIS = {
  monthlyRevenue: 186400,
  fillRate: 78.5,
  noShowRate: 4.2,
  atRisk: 11,
  todayCount: 6,
  monthCount: 214,
  avgRating: 4.8,
};

/** Landing hero preview — richer schedule snapshot */
export const LANDING_SCHEDULE = {
  business: "Salon Mira",
  dateLabel: () =>
    new Date().toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  summary: { confirmed: 4, pending: 2, capacity: "78%" },
  rows: [
    {
      time: "09:30",
      end: "10:15",
      name: "Ayşe Yılmaz",
      service: "Kadın Saç Kesimi",
      staff: "Elif",
      status: "completed" as const,
    },
    {
      time: "10:30",
      end: "12:00",
      name: "Zeynep Aksoy",
      service: "Dip Boya + Fön",
      staff: "Elif",
      status: "confirmed" as const,
      current: true,
    },
    {
      time: "11:00",
      end: "11:45",
      name: "Mehmet Kara",
      service: "Erkek Kesim + Sakal",
      staff: "Can",
      status: "pending" as const,
    },
    {
      time: "13:30",
      end: "14:30",
      name: "Deniz Öztürk",
      service: "Keratin Bakım",
      staff: "Selin",
      status: "confirmed" as const,
    },
    {
      time: "15:00",
      end: "16:00",
      name: "Burcu Şahin",
      service: "Manikür + Pedikür",
      staff: "Selin",
      status: "confirmed" as const,
    },
  ],
};
