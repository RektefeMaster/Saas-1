import type { Locale } from "@/lib/locale-context";

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

export function getDemoBusiness(locale: Locale) {
  return {
    name: "Salon Mira",
    code: "MIRA-204",
    sector: locale === "tr" ? "Kuaför ve Güzellik" : "Hair and Beauty",
    city: locale === "tr" ? "İstanbul" : "Istanbul",
    whatsapp: "+90 532 000 00 00",
  };
}

function formatDayLabel(offset: number, locale: Locale) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const SERVICE = {
  tr: {
    womenCut: "Kadın Saç Kesimi",
    menCut: "Erkek Kesim",
    menCutBeard: "Erkek Kesim + Sakal",
    rootColor: "Dip Boya + Fön",
    keratin: "Keratin Bakım",
    maniPedi: "Manikür + Pedikür",
    bridal: "Gelin Prova",
    kids: "Çocuk Kesim",
    carePack: "Saç Bakım Paketi",
  },
  en: {
    womenCut: "Women’s haircut",
    menCut: "Men’s haircut",
    menCutBeard: "Men’s cut + beard",
    rootColor: "Root color + blow dry",
    keratin: "Keratin treatment",
    maniPedi: "Manicure + pedicure",
    bridal: "Bridal trial",
    kids: "Kids cut",
    carePack: "Hair care package",
  },
} as const;

export function buildInitialAppointments(locale: Locale): DemoAppointment[] {
  const s = SERVICE[locale];
  const todayLabel = formatDayLabel(0, locale);
  const tomorrowLabel = formatDayLabel(1, locale);
  const tr = locale === "tr";
  return [
    {
      id: "a1",
      time: "09:30",
      end: "10:15",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Ayşe Yılmaz",
      phone: "0532 111 22 33",
      service: s.womenCut,
      staff: "Elif",
      duration: 45,
      price: 450,
      status: "completed",
      note: tr ? "Önceki kesim kısa kalsın istemişti" : "Asked to keep the cut a bit shorter last time",
    },
    {
      id: "a2",
      time: "10:30",
      end: "12:00",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Zeynep Aksoy",
      phone: "0533 444 55 66",
      service: s.rootColor,
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
      service: s.menCutBeard,
      staff: "Can",
      duration: 45,
      price: 350,
      status: "pending",
      note: tr ? "WhatsApp’tan az önce yazdı" : "Messaged on WhatsApp just now",
    },
    {
      id: "a4",
      time: "13:30",
      end: "14:30",
      dateLabel: todayLabel,
      dayKey: "today",
      customer: "Deniz Öztürk",
      phone: "0505 777 88 99",
      service: s.keratin,
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
      service: s.maniPedi,
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
      service: s.menCut,
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
      service: s.bridal,
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
      service: s.carePack,
      staff: "Selin",
      duration: 60,
      price: 950,
      status: "pending",
    },
  ];
}

export function getDemoMessages(locale: Locale): DemoMessage[] {
  const s = SERVICE[locale];
  if (locale === "en") {
    return [
      {
        id: "m1",
        customer: "Mehmet Kara",
        phone: "0541 222 33 44",
        preview: "Do you have a slot at 11 today?",
        time: "10:42",
        unread: true,
        thread: [
          { from: "customer", text: "Hi, is a men’s cut available at 11 today?", time: "10:40" },
          {
            from: "bot",
            text: "Hi Mehmet. 11:00 with Can works. Shall I create the booking?",
            time: "10:40",
          },
          { from: "customer", text: "Yes, please confirm.", time: "10:42" },
          {
            from: "bot",
            text: `Booking created: Today 11:00, ${s.menCutBeard}, Can. Waiting for panel confirmation.`,
            time: "10:42",
          },
        ],
      },
      {
        id: "m2",
        customer: "Ayşe Yılmaz",
        phone: "0532 111 22 33",
        preview: "Thanks, I loved it!",
        time: "10:20",
        unread: false,
        thread: [
          {
            from: "bot",
            text: "Ayşe, your appointment is complete. Would you like to leave a review?",
            time: "10:18",
          },
          { from: "customer", text: "Thanks, I loved it!", time: "10:20" },
        ],
      },
      {
        id: "m3",
        customer: "Burcu Şahin",
        phone: "0536 999 00 11",
        preview: "Can we move 15:00 to 15:30?",
        time: "Yesterday",
        unread: true,
        thread: [
          {
            from: "customer",
            text: "Hi, my booking is today at 15:00, not tomorrow. Can we move it to 15:30?",
            time: "Yesterday 21:10",
          },
          {
            from: "bot",
            text: "Checking… Selin is full at 15:30. I can offer 15:00 or 16:30.",
            time: "Yesterday 21:10",
          },
          { from: "customer", text: "Let’s keep 15:00 then.", time: "Yesterday 21:12" },
        ],
      },
      {
        id: "m4",
        customer: "Ceren Aydın",
        phone: "0530 121 34 56",
        preview: "What should I bring for the bridal trial?",
        time: "Yesterday",
        unread: false,
        thread: [
          { from: "customer", text: "Bridal trial tomorrow. What should I bring?", time: "Yesterday 18:00" },
          {
            from: "staff",
            text: "Hair accessories and reference photos are enough. See you at 10:00.",
            time: "Yesterday 18:05",
          },
        ],
      },
    ];
  }

  return [
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
          text: "Merhaba Mehmet Bey. Can ile 11:00 uygun. Onaylarsanız randevuyu oluşturayım.",
          time: "10:40",
        },
        { from: "customer", text: "Evet onaylıyorum.", time: "10:42" },
        {
          from: "bot",
          text: `Randevunuz oluşturuldu: Bugün 11:00, ${s.menCutBeard}, Can. Panelden onay bekliyor.`,
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
        {
          from: "customer",
          text: "Selam, yarın değil bugün 15:00 randevum var. 15:30 yapabilir miyiz?",
          time: "Dün 21:10",
        },
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
}

export function getDemoCustomers(locale: Locale): DemoCustomer[] {
  if (locale === "en") {
    return [
      {
        id: "c1",
        name: "Ayşe Yılmaz",
        phone: "0532 111 22 33",
        tags: ["VIP", "Color"],
        visits: 14,
        lastVisit: "Today",
        totalSpend: 12600,
        notes: "Prefers a short layered cut. Offer coffee.",
      },
      {
        id: "c2",
        name: "Zeynep Aksoy",
        phone: "0533 444 55 66",
        tags: ["Package"],
        visits: 6,
        lastVisit: "12 days ago",
        totalSpend: 8400,
        notes: "Ammonia sensitivity. Product note matters.",
      },
      {
        id: "c3",
        name: "Mehmet Kara",
        phone: "0541 222 33 44",
        tags: ["New"],
        visits: 1,
        lastVisit: "First booking",
        totalSpend: 0,
        notes: "Came from WhatsApp. Prefers Can.",
      },
      {
        id: "c4",
        name: "Deniz Öztürk",
        phone: "0505 777 88 99",
        tags: ["VIP"],
        visits: 9,
        lastVisit: "3 weeks ago",
        totalSpend: 15200,
        notes: "Told not to wash hair for 48 hours after keratin.",
      },
      {
        id: "c5",
        name: "Hande Kılıç",
        phone: "0535 676 89 01",
        tags: ["At risk", "Package"],
        visits: 4,
        lastVisit: "41 days ago",
        totalSpend: 3800,
        notes: "Has not visited in a while. Good campaign candidate.",
      },
    ];
  }

  return [
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
      notes: "Ammonyak hassasiyeti var. Ürün notu önemli.",
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
      notes: "Uzun süredir gelmedi. Kampanya adayı.",
    },
  ];
}

export function getDemoPricing(locale: Locale) {
  const s = SERVICE[locale];
  return [
    { id: "p1", name: s.womenCut, duration: 45, price: 450, active: true },
    { id: "p2", name: s.menCut, duration: 30, price: 250, active: true },
    { id: "p3", name: s.menCutBeard, duration: 45, price: 350, active: true },
    { id: "p4", name: s.rootColor, duration: 90, price: 1200, active: true },
    { id: "p5", name: s.keratin, duration: 60, price: 1800, active: true },
    { id: "p6", name: s.maniPedi, duration: 60, price: 700, active: true },
    { id: "p7", name: s.bridal, duration: 90, price: 2500, active: true },
    { id: "p8", name: s.kids, duration: 25, price: 180, active: false },
  ];
}

export function getDemoPackages(locale: Locale) {
  if (locale === "en") {
    return [
      { id: "pk1", customer: "Zeynep Aksoy", name: "6 session care", remaining: 3, total: 6, expires: "12 Sep 2026" },
      { id: "pk2", customer: "Hande Kılıç", name: "4 session color", remaining: 1, total: 4, expires: "3 Aug 2026" },
      { id: "pk3", customer: "Ayşe Yılmaz", name: "VIP care card", remaining: 5, total: 8, expires: "1 Dec 2026" },
    ];
  }
  return [
    { id: "pk1", customer: "Zeynep Aksoy", name: "6 Seans Bakım", remaining: 3, total: 6, expires: "12 Eyl 2026" },
    { id: "pk2", customer: "Hande Kılıç", name: "4 Seans Renk", remaining: 1, total: 4, expires: "3 Ağu 2026" },
    { id: "pk3", customer: "Ayşe Yılmaz", name: "VIP Bakım Kartı", remaining: 5, total: 8, expires: "1 Ara 2026" },
  ];
}

export function getDemoStaff(locale: Locale) {
  if (locale === "en") {
    return [
      { id: "s1", name: "Elif Y.", role: "Senior stylist, cut and color", today: 3, hours: "09:00 / 18:00", off: false },
      { id: "s2", name: "Can T.", role: "Men’s stylist", today: 2, hours: "10:00 / 19:00", off: false },
      { id: "s3", name: "Selin A.", role: "Care and nails", today: 2, hours: "10:00 / 18:00", off: false },
      { id: "s4", name: "Merve K.", role: "Assistant", today: 0, hours: "Off", off: true },
    ];
  }
  return [
    { id: "s1", name: "Elif Y.", role: "Usta, kesim ve renk", today: 3, hours: "09:00 / 18:00", off: false },
    { id: "s2", name: "Can T.", role: "Erkek kuaför", today: 2, hours: "10:00 / 19:00", off: false },
    { id: "s3", name: "Selin A.", role: "Bakım ve nail", today: 2, hours: "10:00 / 18:00", off: false },
    { id: "s4", name: "Merve K.", role: "Yardımcı", today: 0, hours: "Kapalı", off: true },
  ];
}

export function getDemoCampaigns(locale: Locale) {
  if (locale === "en") {
    return [
      {
        id: "cp1",
        title: "Inactive 41+ days",
        message: "Hi {{name}}, we miss you. Enjoy 15% off care this week. Message us to book.",
        recipients: 28,
        sent: 26,
        failed: 2,
        channel: "WhatsApp",
        date: "24 Jul 2026",
      },
      {
        id: "cp2",
        title: "VIP color clients",
        message: "We set aside the new season color chart for you. Message us for a slot.",
        recipients: 12,
        sent: 12,
        failed: 0,
        channel: "WhatsApp",
        date: "12 Jul 2026",
      },
    ];
  }
  return [
    {
      id: "cp1",
      title: "41 günden fazla gelmeyenler",
      message: "Merhaba {{ad}}, sizi özledik. Bu hafta bakımda %15. Randevu için yazmanız yeterli.",
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
}

export function getInitialAlerts(locale: Locale): DemoAlert[] {
  const s = SERVICE[locale];
  if (locale === "en") {
    return [
      {
        id: "al1",
        severity: "high",
        title: "Appointment waiting for confirmation",
        message: `Mehmet Kara, 11:00 ${s.menCutBeard}. Came from WhatsApp and is waiting for your approval.`,
        resolved: false,
      },
      {
        id: "al2",
        severity: "medium",
        title: "At risk customer",
        message: "Hande Kılıç has not visited in 41 days. One package session left. Win back suggested.",
        resolved: false,
      },
      {
        id: "al3",
        severity: "low",
        title: "Busy tomorrow",
        message: "Bridal trial at 10:00 tomorrow plus afternoon care is full. Consider extra staff cover.",
        resolved: false,
      },
    ];
  }
  return [
    {
      id: "al1",
      severity: "high",
      title: "Onay bekleyen randevu",
      message: `Mehmet Kara, 11:00 ${s.menCutBeard}. WhatsApp’tan geldi, onayınızı bekliyor.`,
      resolved: false,
    },
    {
      id: "al2",
      severity: "medium",
      title: "Riskli müşteri",
      message: "Hande Kılıç 41 gündür gelmedi. Paketinden 1 seans kaldı. Geri kazanım önerildi.",
      resolved: false,
    },
    {
      id: "al3",
      severity: "low",
      title: "Yarın yoğun",
      message: "Yarın 10:00 gelin prova ve öğleden sonra bakım dolu. Ek personel planı düşünün.",
      resolved: false,
    },
  ];
}

export const DEMO_KPIS = {
  monthlyRevenue: 186400,
  fillRate: 78.5,
  noShowRate: 4.2,
  atRisk: 11,
  todayCount: 6,
  monthCount: 214,
  avgRating: 4.8,
};

/** Landing hero schedule preview */
export const LANDING_SCHEDULE = {
  business: "Salon Mira",
  dateLabel: (locale: Locale = "tr") =>
    new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  summary: { confirmed: 4, pending: 2, capacity: "78%" },
  rows: (locale: Locale = "tr") => {
    const s = SERVICE[locale];
    return [
      {
        time: "09:30",
        end: "10:15",
        name: "Ayşe Yılmaz",
        service: s.womenCut,
        staff: "Elif",
        status: "completed" as const,
      },
      {
        time: "10:30",
        end: "12:00",
        name: "Zeynep Aksoy",
        service: s.rootColor,
        staff: "Elif",
        status: "confirmed" as const,
        current: true,
      },
      {
        time: "11:00",
        end: "11:45",
        name: "Mehmet Kara",
        service: s.menCutBeard,
        staff: "Can",
        status: "pending" as const,
      },
      {
        time: "13:30",
        end: "14:30",
        name: "Deniz Öztürk",
        service: s.keratin,
        staff: "Selin",
        status: "confirmed" as const,
      },
      {
        time: "15:00",
        end: "16:00",
        name: "Burcu Şahin",
        service: s.maniPedi,
        staff: "Selin",
        status: "confirmed" as const,
      },
    ];
  },
};
