import OpenAI from "openai";
import { supabase } from "./supabase";
import {
  getSession,
  setSession,
  deleteSession,
} from "./redis";
import { checkBlockedDate } from "@/services/blockedDates.service";
import { getCustomerHistory, formatHistoryForPrompt } from "@/services/customerHistory.service";
import {
  getCustomerLastActiveAppointment,
  cancelAppointment,
} from "@/services/cancellation.service";
import { submitReview, hasReview } from "@/services/review.service";
import type {
  Tenant,
  BusinessType,
  ConversationState,
  FlowType,
} from "./database.types";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM_PROMPT = `Sen SaaSRandevu WhatsApp asistanısın. Randevu alıyorsun.
Kurallar:
- Türkçe, samimi, kısa cevap ver.
- Tarih ve saat sor. Müsait değilse alternatif saat öner.
- Onay alınca randevuyu kaydet (create_appointment fonksiyonunu çağır).
- Müşteri iptal isterse: get_last_appointment çağır, randevuyu göster, "İptal edilsin mi?" diye sor. "Evet/tamam" derse cancel_appointment çağır. Sonra "Başka bir saate almak ister misiniz?" diye sor.
- Hiçbir yerde hizmet süresi (dakika, saat) belirtme.`;

function buildCondensedContext(
  state: ConversationState | null,
  incoming: string,
  historySummary?: string
): string {
  let base: string;
  if (!state) {
    base = `Yeni konuşma. Beklenen: Tarih ve saat sor.\nGelen mesaj: "${incoming}"`;
  } else {
    const step = state.step || "başlangıç";
    const extracted = JSON.stringify(state.extracted || {});
    base = `Mevcut Durum: ${step}\nToplanan bilgiler: ${extracted}\nGelen mesaj: "${incoming}"`;
  }
  if (historySummary) {
    base = `${historySummary}\n\n${base}`;
  }
  return base;
}

export async function getTenantByCode(tenantCode: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, business_types(*)")
    .eq("tenant_code", tenantCode.toUpperCase())
    .is("deleted_at", null)
    .eq("status", "active")
    .single();
  if (error || !data) return null;
  return data as unknown as Tenant;
}

export async function getTenantWithBusinessType(
  tenantId: string
): Promise<(Tenant & { business_types: BusinessType }) | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, business_types(*)")
    .eq("id", tenantId)
    .single();
  if (error || !data) return null;
  return data as unknown as Tenant & { business_types: BusinessType };
}

export async function checkAvailability(
  tenantId: string,
  dateStr: string
): Promise<{ available: string[]; booked: string[]; blocked?: boolean }> {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { available: [], booked: [] };

  const blocked = await checkBlockedDate(tenantId, dateStr);
  if (blocked) {
    return { available: [], booked: [], blocked: true };
  }

  const { data: slots } = await supabase
    .from("availability_slots")
    .select("day_of_week, start_time, end_time")
    .eq("tenant_id", tenantId);

  if (!slots || slots.length === 0) {
    return { available: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"], booked: [] };
  }

  const dayOfWeek = date.getDay();
  const daySlot = slots.find((s) => s.day_of_week === dayOfWeek);
  if (!daySlot) return { available: [], booked: [] };

  const { data: appointments } = await supabase
    .from("appointments")
    .select("slot_start")
    .eq("tenant_id", tenantId)
    .gte("slot_start", `${dateStr}T00:00:00`)
    .lt("slot_start", `${dateStr}T23:59:59`)
    .not("status", "in", "('cancelled')");

  const booked = (appointments || []).map((a) => {
    const d = new Date(a.slot_start);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const [startH, startM] = daySlot.start_time.split(":").map(Number);
  const [endH, endM] = daySlot.end_time.split(":").map(Number);
  const available: string[] = [];
  for (let h = startH; h < endH || (h === endH && startM < endM); h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h < startH || (h === startH && m < startM)) continue;
      if (h > endH || (h === endH && m >= endM)) break;
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (!booked.includes(time)) available.push(time);
    }
  }
  return { available, booked };
}

export async function createAppointment(
  tenantId: string,
  customerPhone: string,
  dateStr: string,
  timeStr: string,
  extraData?: Record<string, unknown>
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const slotStart = `${dateStr}T${timeStr}:00`;
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      customer_phone: customerPhone,
      slot_start: slotStart,
      status: "confirmed",
      extra_data: extraData || {},
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

async function tryHandleReview(
  tenantId: string,
  customerPhone: string,
  msg: string
): Promise<{ handled: boolean; reply?: string }> {
  const trimmed = msg.trim();
  const ratingMatch = trimmed.match(/^([1-5])\s*$/);
  if (!ratingMatch) return { handled: false };

  const rating = parseInt(ratingMatch[1], 10);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { data: apt } = await supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .lt("slot_start", oneHourAgo.toISOString())
    .in("status", ["completed", "confirmed"])
    .order("slot_start", { ascending: false })
    .limit(1)
    .single();

  if (!apt) return { handled: false };
  if (await hasReview(apt.id)) return { handled: false };

  const result = await submitReview(tenantId, apt.id, customerPhone, rating);
  if (!result.ok) return { handled: false };

  await supabase.from("appointments").update({ status: "completed" }).eq("id", apt.id);

  return {
    handled: true,
    reply: "Teşekkürler! Eklemek istediğiniz bir yorum var mı? (İstemezseniz 'hayır' yazabilirsiniz.)",
  };
}

export async function processMessage(
  tenantId: string,
  customerPhone: string,
  incomingMessage: string
): Promise<{ reply: string; stateReset?: boolean }> {
  const tenant = await getTenantWithBusinessType(tenantId);
  if (!tenant) {
    return { reply: "Üzgünüm, işletme bulunamadı. Lütfen doğru kodu kullanın." };
  }

  const reviewResult = await tryHandleReview(tenantId, customerPhone, incomingMessage);
  if (reviewResult.handled && reviewResult.reply) {
    return { reply: reviewResult.reply };
  }

  const state = await getSession(tenantId, customerPhone);
  const history = await getCustomerHistory(tenantId, customerPhone);
  const historySummary = formatHistoryForPrompt(history);
  const condensed = buildCondensedContext(state, incomingMessage, historySummary);

  const bt = tenant.business_types as BusinessType;
  const promptTemplate =
    (bt?.config as { ai_prompt_template?: string })?.ai_prompt_template ||
    `Sen {tenant_name} işletmesinin WhatsApp asistanısın. Tarih ve saat sor. Türkçe cevap ver.`;
  const systemPrompt = SYSTEM_PROMPT + "\n\n" + promptTemplate.replace("{tenant_name}", tenant.name);

  if (!openai) {
    return {
      reply: "Şu an randevu alamıyorum. Lütfen daha sonra tekrar deneyin.",
    };
  }

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "check_availability",
        description: "O günün müsait saatlerini kontrol et. Tarih tatil/izin günüyse müsait slot dönmez.",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD formatında tarih" },
          },
          required: ["date"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_appointment",
        description: "Randevuyu kaydet",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
            time: { type: "string", description: "HH:MM" },
            extra_data: { type: "object", description: "Ek bilgiler (plaka, adres vb.)" },
          },
          required: ["date", "time"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_last_appointment",
        description: "Müşterinin bir sonraki (gelecekteki) aktif randevusunu getir. İptal akışında kullan.",
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "cancel_appointment",
        description: "Randevuyu iptal et. Müşteri onayladıktan sonra çağır.",
        parameters: {
          type: "object",
          properties: {
            appointment_id: { type: "string", description: "İptal edilecek randevunun ID'si" },
            reason: { type: "string", description: "İptal sebebi (opsiyonel)" },
          },
          required: ["appointment_id"],
        },
      },
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: condensed },
    ],
    tools,
    tool_choice: "auto",
  });

  const message = response.choices[0]?.message;
  if (!message) {
    return { reply: "Anlayamadım, tekrar yazar mısınız?" };
  }

  const toolCalls = message.tool_calls;
  let finalReply = message.content || "";

  if (toolCalls && toolCalls.length > 0) {
    for (const tc of toolCalls) {
      const fn = (tc as { function?: { name?: string; arguments?: string } }).function;
      const name = fn?.name;
      const args = JSON.parse(fn?.arguments || "{}");

      if (name === "check_availability") {
        const result = await checkAvailability(tenantId, args.date);
        if (result.blocked) {
          finalReply = "O tarihler kapalı (tatil/izin). Başka bir tarih seçer misiniz?";
        } else if (result.available.length > 0) {
          finalReply = `O gün şu saatler müsait: ${result.available.join(", ")}. Hangisini tercih edersiniz?`;
        } else {
          finalReply = "Maalesef o gün müsait saat yok. Başka bir tarih deneyebilir misiniz?";
        }
      }

      if (name === "get_last_appointment") {
        const last = await getCustomerLastActiveAppointment(tenantId, customerPhone);
        if (last) {
          const d = new Date(last.slot_start);
          const dateStr = d.toLocaleDateString("tr-TR");
          const timeStr = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
          finalReply = `${dateStr} ${timeStr} randevunuz var. İptal edilsin mi?`;
          const newExtracted = { ...state?.extracted, pending_cancel_appointment_id: last.id };
          await setSession(tenantId, customerPhone, {
            ...state!,
            tenant_id: tenantId,
            customer_phone: customerPhone,
            step: "iptal_onay_bekleniyor",
            extracted: newExtracted,
            flow_type: (bt?.config?.flow_type as FlowType) || "appointment",
            updated_at: new Date().toISOString(),
          });
        } else {
          finalReply = "İptal edilecek aktif randevunuz bulunamadı.";
        }
      }

      if (name === "cancel_appointment") {
        const aptId = args.appointment_id || (state?.extracted as { pending_cancel_appointment_id?: string })?.pending_cancel_appointment_id;
        if (!aptId) {
          finalReply = "Randevu bulunamadı.";
        } else {
          const cancelResult = await cancelAppointment({
            tenantId,
            appointmentId: aptId,
            cancelledBy: "customer",
            reason: args.reason,
          });
          if (cancelResult.ok) {
            finalReply = "Randevunuz iptal edildi. Başka bir saate almak ister misiniz?";
            await deleteSession(tenantId, customerPhone);
            return { reply: finalReply, stateReset: true };
          }
          finalReply = cancelResult.error || "İptal işlemi başarısız.";
        }
      }

      if (name === "create_appointment") {
        const result = await createAppointment(
          tenantId,
          customerPhone,
          args.date,
          args.time,
          args.extra_data
        );
        if (result.ok) {
          const messages = (bt?.config as { messages?: { confirmation?: string } })?.messages;
          const conf = messages?.confirmation || "Randevunuz kaydedildi. 24 saat önce hatırlatacağız.";
          finalReply = conf
            .replace("{date}", args.date)
            .replace("{time}", args.time);
          await deleteSession(tenantId, customerPhone);
          return { reply: finalReply, stateReset: true };
        }
        finalReply = result.error || "Randevu kaydedilemedi.";
      }
    }
  } else {
    const newState: ConversationState = {
      tenant_id: tenantId,
      customer_phone: customerPhone,
      flow_type: (bt?.config?.flow_type as FlowType) || "appointment",
      extracted: state?.extracted || {},
      step: "devam",
      updated_at: new Date().toISOString(),
    };
    await setSession(tenantId, customerPhone, newState);
  }

  return { reply: finalReply };
}
