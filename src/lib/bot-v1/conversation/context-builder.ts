import type { ConversationState } from "../../database.types";
import type { CrmCustomerProfile } from "@/services/crmCustomer.service";
import { APP_TIMEZONE, TR_DAY_NAMES_FULL, EN_DAY_TO_INDEX } from "./constants";
import { parseNaturalDateTime } from "@/lib/chrono-parse";

export function getSelectedServiceFromExtracted(
  extracted: Record<string, unknown>
): { slug?: string; name?: string } {
  const slug =
    (extracted.selected_service_slug as string | undefined)?.trim() ||
    (extracted.service_slug as string | undefined)?.trim() ||
    undefined;
  const name = (extracted.selected_service_name as string | undefined)?.trim() || undefined;
  return { slug, name };
}

export function localDateStr(d: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function localTimeStr(d: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function localDayIndex(d: Date, timeZone = APP_TIMEZONE): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    .format(d)
    .toLowerCase();
  return EN_DAY_TO_INDEX[short] ?? d.getDay();
}

export function formatSlotDateTimeTr(slotStart: string): { date: string; time: string } {
  const parsed = new Date(slotStart);
  if (isNaN(parsed.getTime())) {
    return { date: "", time: "" };
  }
  return {
    date: parsed.toLocaleDateString("tr-TR", { timeZone: APP_TIMEZONE }),
    time: parsed.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIMEZONE,
    }),
  };
}

/** Kayan hafıza: mevcut durum özeti (niyet, adım, toplanan bilgiler). API'ye uzun geçmiş yerine bu özet + son birkaç mesaj gider. */
export function buildStateSummary(state: ConversationState | null): string {
  if (!state) return "";
  const ext = (state.extracted || {}) as Record<string, unknown>;
  const parts: string[] = [];
  const step = state.step;
  if (step === "saat_secimi_bekleniyor") {
    parts.push("Niyet: Randevu. Müşteri tarih/saat seçiyor.");
  } else if (step === "iptal_onay_bekleniyor") {
    parts.push("Niyet: İptal. Müşteri iptal onayı bekleniyor.");
  } else if (step === "tarih_saat_bekleniyor" || step === "devam") {
    parts.push("Niyet: Randevu veya genel.");
  }
  const customerName = ext.customer_name as string | undefined;
  if (customerName) parts.push(`Müşteri adı: ${customerName}.`);
  const selectedService = getSelectedServiceFromExtracted(ext);
  if (selectedService.slug || selectedService.name) {
    parts.push(
      `Seçilen hizmet: ${selectedService.name || selectedService.slug}. Tekrar "hangi hizmet" diye sorma.`
    );
  }
  const lastDate = ext.last_availability_date as string | undefined;
  const lastSlots = ext.last_available_slots as string[] | undefined;
  if (lastDate && Array.isArray(lastSlots) && lastSlots.length > 0) {
    parts.push(`Son müsait tarih: ${lastDate}, saatler: ${(lastSlots as string[]).join(", ")}.`);
  }
  if (parts.length === 0) return "";
  return `[Durum: ${parts.join(" ")}]`;
}

export function buildSystemContext(
  state: ConversationState | null,
  historySummary?: string,
  lastUserMessage?: string,
  customerProfile?: CrmCustomerProfile | null
): string {
  const today = new Date();
  const todayStr = localDateStr(today);
  const currentTime = localTimeStr(today);
  const todayDow = localDayIndex(today);

  const nextDays: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = localDateStr(d);
    const dayName = TR_DAY_NAMES_FULL[localDayIndex(d)];
    nextDays.push(`${dayName}=${ds}`);
  }

  const stateSummary = buildStateSummary(state);

  let ctx = stateSummary ? `${stateSummary}\n\n` : "";
  ctx += `Bugün: ${todayStr} (${TR_DAY_NAMES_FULL[todayDow]}).`;
  ctx += ` Şu an saat: ${currentTime}.`;
  ctx += ` Saat dilimi: ${APP_TIMEZONE}.`;
  ctx += ` Önümüzdeki günler: ${nextDays.join(", ")}.`;
  ctx += ` ÖNEMLİ: Müşteri "pazartesi" derse EN YAKIN pazartesiyi kullan (yukarıdaki listeden bak). "Bu hafta" veya "gelecek hafta" derse start_date olarak bugünün tarihini ver.`;

  // chrono-node: Doğal dil tarih ayrıştırma (İngilizce ifadeler desteklenir)
  if (lastUserMessage && lastUserMessage.trim().length > 3) {
    const parsed = parseNaturalDateTime(lastUserMessage.trim());
    if (parsed) {
      ctx += ` [Müşteri son mesajda tarih/saat belirtti → chrono çözümü: date=${parsed.date}, time=${parsed.time}]`;
    }
  }

  const ext = (state?.extracted || {}) as Record<string, unknown>;

  const customerName =
    (ext.customer_name as string | undefined) || customerProfile?.customer_name || undefined;
  if (customerName) {
    let profileNote = "";
    if (customerProfile && (customerProfile.total_visits > 0 || customerProfile.last_visit_at)) {
      const lastVisit = customerProfile.last_visit_at
        ? new Date(customerProfile.last_visit_at).toLocaleDateString("tr-TR", {
            timeZone: APP_TIMEZONE,
          })
        : null;
      profileNote = ` ${customerProfile.total_visits} kez gelmiş${lastVisit ? `, son ziyaret: ${lastVisit}` : ""}.`;
    }
    ctx += ` Konuşan kişinin (müşterinin) adı: ${customerName}.${profileNote} Tekrar sorma. Başka biri için randevu alırken (arkadaş, eş) o kişinin adını ayrıca sor ve create_appointment'ta customer_name olarak sadece o randevu için geç.`;
  }
  const selectedService = getSelectedServiceFromExtracted(ext);
  if (selectedService.slug || selectedService.name) {
    ctx += ` Seçili hizmet: ${selectedService.name || selectedService.slug}. Hizmet tekrar sorulmaz; müsaitlik/fiyat/randevu adımlarında bu hizmeti kullan.`;
  }

  const lastDate = ext.last_availability_date as string | undefined;
  const lastSlots = ext.last_available_slots as string[] | undefined;
  if (
    lastDate &&
    lastSlots &&
    Array.isArray(lastSlots) &&
    lastSlots.length > 0
  ) {
    ctx += ` Son müsait saatler (${lastDate}): ${lastSlots.join(", ")}.`;
  }

  if (historySummary) {
    ctx += ` ${historySummary}`;
  }
  return ctx;
}
