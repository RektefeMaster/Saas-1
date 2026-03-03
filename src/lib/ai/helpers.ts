import { supabase } from "../supabase";
import type { ConversationState } from "../database.types";
import { localDateStr } from "./context-builder";
import { APP_TIMEZONE, MAX_CHAT_HISTORY_TURNS } from "./constants";
import type { ChatMessage } from "../database.types";

export function formatDateTr(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    if (isNaN(d.getTime())) return dateStr;
    const weekday = d.toLocaleDateString("tr-TR", { weekday: "long" });
    const dayMonth = d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
    });
    return `${weekday} ${dayMonth}`;
  } catch {
    return dateStr;
  }
}

/**
 * Tarihi doğal bir formatta döndürür: "yarın 3 martta saat 17.30'a", "2 gün sonra 5 mart saat 17.30'a" gibi
 */
export function formatDateReadableTr(dateStr: string, timeStr?: string): string {
  try {
    // Bugünün tarihini timezone'a göre al
    const now = new Date();
    const todayStr = localDateStr(now);
    
    // Hedef tarihi parse et (dateStr formatı: YYYY-MM-DD)
    const targetDate = new Date(dateStr + "T12:00:00");
    if (isNaN(targetDate.getTime())) return dateStr;
    
    // Timezone'a göre tarih stringlerini karşılaştır
    const targetDateStr = localDateStr(targetDate);
    
    // Gün farkını hesapla
    const todayDate = new Date(todayStr + "T12:00:00");
    const targetDateOnly = new Date(targetDateStr + "T12:00:00");
    const diffTime = targetDateOnly.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    // Tarih bilgilerini timezone'a göre al
    const day = new Intl.DateTimeFormat("tr-TR", {
      timeZone: APP_TIMEZONE,
      day: "numeric",
    }).format(targetDate);
    const month = new Intl.DateTimeFormat("tr-TR", {
      timeZone: APP_TIMEZONE,
      month: "long",
    }).format(targetDate);
    
    if (timeStr) {
      // Saati "17:30" formatından "17.30" formatına çevir
      const timeFormatted = timeStr.replace(":", ".");
      
      if (diffDays === 0) {
        return `bugün saat ${timeFormatted}'a`;
      } else if (diffDays === 1) {
        return `yarın ${day} ${month}ta saat ${timeFormatted}'a`;
      } else if (diffDays === 2) {
        return `öbür gün ${day} ${month}ta saat ${timeFormatted}'a`;
      } else if (diffDays > 2 && diffDays <= 7) {
        return `${diffDays} gün sonra ${day} ${month}ta saat ${timeFormatted}'a`;
      } else {
        return `${day} ${month}ta saat ${timeFormatted}'a`;
      }
    }
    
    // Saat yoksa
    if (diffDays === 0) {
      return "bugün";
    } else if (diffDays === 1) {
      return `yarın ${day} ${month}ta`;
    } else if (diffDays === 2) {
      return `öbür gün ${day} ${month}ta`;
    } else if (diffDays > 2 && diffDays <= 7) {
      return `${diffDays} gün sonra ${day} ${month}ta`;
    } else {
      return `${day} ${month}`;
    }
  } catch {
    return dateStr;
  }
}

export async function getKnownCustomerName(
  tenantId: string,
  customerPhone: string,
  state: ConversationState | null
): Promise<string | null> {
  const fromState = (state?.extracted as { customer_name?: string } | undefined)?.customer_name;
  if (fromState && fromState.trim()) return fromState.trim();

  const { data } = await supabase
    .from("appointments")
    .select("extra_data")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .order("slot_start", { ascending: false })
    .limit(10);

  for (const row of data || []) {
    const maybeName = (row.extra_data as Record<string, unknown> | null)?.customer_name;
    if (typeof maybeName === "string" && maybeName.trim()) {
      return maybeName.trim();
    }
  }
  return null;
}

export function trimChatHistory(history: ChatMessage[]): ChatMessage[] {
  const maxMessages = MAX_CHAT_HISTORY_TURNS * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(-maxMessages);
}
