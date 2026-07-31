/**
 * Lead hafızası.
 *
 * İki sorunu çözer:
 * 1) Randevuya dönüşmeyen konuşmalar hiçbir yere düşmüyordu (CRM sadece randevu
 *    oluşunca yazılıyordu) — konuşan herkes artık `lead` olarak kaydediliyor.
 * 2) Oturum TTL'i 24 saat; sonrasında bot müşteriyi tamamen unutuyordu — kısa,
 *    yapılandırılmış bir hafıza `crm_customers.bot_memory` içinde kalıcı tutuluyor.
 *
 * Migration 034 uygulanmadıysa tüm fonksiyonlar sessizce devre dışı kalır;
 * bot akışı hiçbir durumda bu yüzden kırılmaz.
 */

import { supabase } from "@/lib/supabase";
import { normalizePhoneE164, normalizePhoneDigits } from "@/lib/phone";
import type { ChatMessage } from "@/lib/database.types";
import type OpenAI from "openai";

/** Botun bir sonraki konuşmada kullanacağı kısa hafıza. Abartma: sadece işe yarar alanlar. */
export interface LeadMemory {
  /** Tek cümlelik özet. */
  summary?: string;
  /** Müşterinin genelde aldığı hizmet. */
  preferred_service?: string;
  /** Tercih ettiği personel. */
  preferred_staff?: string;
  /** Tercih ettiği zaman aralığı (örn. "hafta içi akşam"). */
  preferred_time?: string;
  /** Randevuya engel olan durum (örn. "fiyat yüksek geldi"). */
  blocker?: string;
  updated_at?: string;
}

const MAX_FIELD_CHARS = 120;
const MAX_SUMMARY_CHARS = 220;
/** Hafıza güncelleme LLM çağrısı her mesajda değil, bu aralıkta çalışır. */
export const LEAD_MEMORY_REFRESH_EVERY_N_MESSAGES = 4;

function normalizePhone(customerPhone: string): string | null {
  return (
    normalizePhoneE164(customerPhone) ||
    (normalizePhoneDigits(customerPhone) ? `+${normalizePhoneDigits(customerPhone)}` : null)
  );
}

function isSchemaMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "42883" || // function does not exist
    error.code === "42703" || // column does not exist
    error.code === "PGRST202" || // rpc not found in schema cache
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

function clamp(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/** Serbest metni sabit şemaya indirger; LLM ne döndürürse döndürsün şişmez. */
export function sanitizeLeadMemory(input: unknown): LeadMemory | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const memory: LeadMemory = {
    summary: clamp(raw.summary, MAX_SUMMARY_CHARS),
    preferred_service: clamp(raw.preferred_service, MAX_FIELD_CHARS),
    preferred_staff: clamp(raw.preferred_staff, MAX_FIELD_CHARS),
    preferred_time: clamp(raw.preferred_time, MAX_FIELD_CHARS),
    blocker: clamp(raw.blocker, MAX_FIELD_CHARS),
  };
  const hasAny = Object.values(memory).some(Boolean);
  if (!hasAny) return null;
  return memory;
}

/**
 * Müşteri her mesaj attığında çağrılır: kaydı yoksa `lead` olarak açar,
 * varsa temas zamanını tazeler. Atomik (SQL fonksiyonu).
 */
export async function touchLeadContact(
  tenantId: string,
  customerPhone: string,
  options?: { customerName?: string | null; newConversation?: boolean }
): Promise<void> {
  const normalized = normalizePhone(customerPhone);
  if (!normalized) return;

  try {
    const { error } = await supabase.rpc("crm_touch_customer", {
      p_tenant_id: tenantId,
      p_customer_phone: normalized,
      p_customer_name: options?.customerName?.trim() || null,
      p_contact_at: new Date().toISOString(),
      p_new_conversation: options?.newConversation ?? false,
    });
    if (!error) return;
    if (!isSchemaMissing(error)) {
      console.warn("[leadMemory] touch rpc failed:", error.message);
      return;
    }
  } catch (err) {
    console.warn("[leadMemory] touch rpc threw:", err);
    return;
  }

  // Migration 034 henüz uygulanmadıysa: en azından kaydın var olmasını sağla.
  try {
    await supabase.from("crm_customers").upsert(
      {
        tenant_id: tenantId,
        customer_phone: normalized,
        ...(options?.customerName?.trim()
          ? { customer_name: options.customerName.trim() }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,customer_phone" }
    );
  } catch {
    // CRM yazımı randevu/sohbet akışını asla engellemez.
  }
}

/** Randevu alındığında lead → customer. */
export async function markLeadConverted(
  tenantId: string,
  customerPhone: string
): Promise<void> {
  const normalized = normalizePhone(customerPhone);
  if (!normalized) return;
  try {
    const { error } = await supabase
      .from("crm_customers")
      .update({ lifecycle_stage: "customer", updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("customer_phone", normalized);
    if (error && !isSchemaMissing(error)) {
      console.warn("[leadMemory] convert failed:", error.message);
    }
  } catch {
    // yut
  }
}

export async function getLeadMemory(
  tenantId: string,
  customerPhone: string
): Promise<LeadMemory | null> {
  const normalized = normalizePhone(customerPhone);
  if (!normalized) return null;
  try {
    const { data, error } = await supabase
      .from("crm_customers")
      .select("bot_memory")
      .eq("tenant_id", tenantId)
      .eq("customer_phone", normalized)
      .maybeSingle();
    if (error || !data) return null;
    return sanitizeLeadMemory(data.bot_memory);
  } catch {
    return null;
  }
}

export async function saveLeadMemory(
  tenantId: string,
  customerPhone: string,
  memory: LeadMemory
): Promise<void> {
  const normalized = normalizePhone(customerPhone);
  if (!normalized) return;
  const clean = sanitizeLeadMemory(memory);
  if (!clean) return;
  try {
    const { error } = await supabase
      .from("crm_customers")
      .update({
        bot_memory: { ...clean, updated_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("customer_phone", normalized);
    if (error && !isSchemaMissing(error)) {
      console.warn("[leadMemory] save failed:", error.message);
    }
  } catch {
    // yut
  }
}

/** Prompt'a girecek kısa metin. Boşsa hiç blok eklenmez. */
export function formatLeadMemoryForPrompt(memory: LeadMemory | null): string {
  if (!memory) return "";
  const lines: string[] = [];
  if (memory.summary) lines.push(memory.summary);
  if (memory.preferred_service) lines.push(`Genelde aldığı hizmet: ${memory.preferred_service}`);
  if (memory.preferred_staff) lines.push(`Tercih ettiği kişi: ${memory.preferred_staff}`);
  if (memory.preferred_time) lines.push(`Tercih ettiği zaman: ${memory.preferred_time}`);
  if (memory.blocker) lines.push(`Daha önce çekincesi: ${memory.blocker}`);
  if (lines.length === 0) return "";
  return lines.join("\n");
}

/** Hafıza yenileme zamanı geldi mi? */
export function shouldRefreshLeadMemory(
  messageCount: number,
  appointmentJustCreated: boolean
): boolean {
  if (appointmentJustCreated) return true;
  if (messageCount <= 0) return false;
  return messageCount % LEAD_MEMORY_REFRESH_EVERY_N_MESSAGES === 0;
}

/** LLM'e verilecek konuşma metni (son turlar yeterli). */
export function buildConversationDigest(history: ChatMessage[], maxTurns = 12): string {
  return history
    .slice(-maxTurns)
    .map((m) => `${m.role === "user" ? "Müşteri" : "Bot"}: ${m.content}`)
    .join("\n")
    .slice(0, 4000);
}

export const LEAD_MEMORY_SYSTEM_PROMPT = `Bir randevu asistanının hafıza defterini güncelliyorsun.
Konuşmadan SADECE bir sonraki konuşmada işe yarayacak kalıcı bilgileri çıkar.

Kurallar:
- Abartma. Emin olmadığın alanı boş bırak, uydurma.
- Tek seferlik detayları (bu randevunun saati, bugünkü hava vb.) YAZMA.
- Kalıcı tercihleri yaz: hep aldığı hizmet, tercih ettiği kişi, uygun olduğu zaman aralığı.
- "blocker" alanına yalnızca randevuyu engelleyen net bir çekince varsa yaz.
- summary en fazla bir cümle olsun.
- Hassas bilgi (sağlık detayı, kimlik, ödeme) YAZMA.

Sadece şu JSON'u döndür:
{"summary":"","preferred_service":"","preferred_staff":"","preferred_time":"","blocker":""}`;

/**
 * Konuşmadan kalıcı hafızayı çıkarır ve kaydeder.
 * Cevap gönderildikten SONRA çağrılır; müşteri gecikmesi yaratmaz.
 * Herhangi bir hata durumunda sessizce vazgeçer — sohbet akışını etkilemez.
 */
export async function refreshLeadMemoryFromConversation(input: {
  tenantId: string;
  customerPhone: string;
  history: ChatMessage[];
  existing?: LeadMemory | null;
  client: OpenAI | null;
  model: string;
}): Promise<LeadMemory | null> {
  const { tenantId, customerPhone, history, existing, client, model } = input;
  if (!client || history.length < 2) return null;

  const digest = buildConversationDigest(history);
  if (!digest.trim()) return null;

  try {
    const response = await client.chat.completions.create({
      model,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: LEAD_MEMORY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Mevcut hafıza:\n${JSON.stringify(existing ?? {})}\n\nKonuşma:\n${digest}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    const next = sanitizeLeadMemory(parsed);
    if (!next) return null;

    // Model bir alanı boş bıraktıysa eskisini koru (hafıza silinmesin).
    const merged: LeadMemory = {
      summary: next.summary ?? existing?.summary,
      preferred_service: next.preferred_service ?? existing?.preferred_service,
      preferred_staff: next.preferred_staff ?? existing?.preferred_staff,
      preferred_time: next.preferred_time ?? existing?.preferred_time,
      blocker: next.blocker ?? existing?.blocker,
    };

    await saveLeadMemory(tenantId, customerPhone, merged);
    return merged;
  } catch (err) {
    console.warn("[leadMemory] refresh failed:", err);
    return null;
  }
}
