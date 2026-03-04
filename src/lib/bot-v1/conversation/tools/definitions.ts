import OpenAI from "openai";

export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "O günün müsait saatlerini kontrol et.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          service_slug: {
            type: "string",
            description: "Opsiyonel hizmet slug; süreye göre müsaitlik hesaplanır.",
          },
          staff_id: {
            type: "string",
            description: "Opsiyonel personel ID; belirli personel için müsaitlik bakar.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_customer_package",
      description: "Müşterinin seçilen hizmet için aktif paketi olup olmadığını kontrol et.",
      parameters: {
        type: "object",
        properties: {
          service_slug: { type: "string", description: "Hizmet slug" },
        },
        required: ["service_slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "match_service",
      description:
        "Müşterinin söylediği hizmet ifadesini (sadece saç, sakal traşı, saç+fön vb.) fiyat listesindeki hizmete eşleştirir. Randevu almadan önce mutlaka çağır.",
      parameters: {
        type: "object",
        properties: {
          user_text: {
            type: "string",
            description: "Müşterinin hizmet hakkında söylediği metin (örn: sadece saç, sakal traşı)",
          },
        },
        required: ["user_text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description:
        "Randevu oluştur. Müşterinin adını ve hizmeti mutlaka sor. service_slug için önce match_service çağır.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
          customer_name: { type: "string", description: "Müşterinin adı soyadı" },
          service_slug: {
            type: "string",
            description: "Hizmet slug (match_service sonucundan veya get_services listesinden)",
          },
          staff_id: { type: "string", description: "Opsiyonel personel ID" },
          use_package: {
            type: "boolean",
            description: "Aktif paketten 1 seans düşülerek randevu alınacaksa true gönder.",
          },
          extra_data: { type: "object", description: "Opsiyonel ek veri" },
        },
        required: ["date", "time", "customer_name", "service_slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_last_appointment",
      description: "Müşterinin aktif randevusunu getir.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Randevuyu iptal et.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["appointment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_week_availability",
      description: "Bu haftanın tüm günlerinin müsaitliğini kontrol et.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Haftanın başlangıç YYYY-MM-DD" },
        },
        required: ["start_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Mevcut randevuyu iptal edip yeni saate al.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          new_date: { type: "string", description: "YYYY-MM-DD" },
          new_time: { type: "string", description: "HH:MM" },
        },
        required: ["appointment_id", "new_date", "new_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_recurring",
      description: "Her hafta aynı gün ve saate tekrar eden randevu oluştur.",
      parameters: {
        type: "object",
        properties: {
          day_of_week: { type: "number", description: "0=Pazar..6=Cumartesi" },
          time: { type: "string", description: "HH:MM" },
        },
        required: ["day_of_week", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_waitlist",
      description: "Dolu güne bekleme listesine ekle, yer açılınca haber ver.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          preferred_time: { type: "string", description: "HH:MM opsiyonel" },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_services",
      description: "İşletmenin hizmetlerini ve fiyatlarını listele.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tenant_info",
      description: "İşletmenin adres, telefon, çalışma saatleri bilgilerini getir.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "notify_late",
      description: "Müşterinin geç kalacağını esnafa bildir.",
      parameters: {
        type: "object",
        properties: {
          minutes: { type: "number", description: "Kaç dakika geç" },
          message: { type: "string", description: "Ek mesaj" },
        },
        required: ["minutes"],
      },
    },
  },
];
