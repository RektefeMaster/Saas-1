import { supabase } from "@/lib/supabase";
import { clearBookingSlotHold } from "@/lib/redis";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getDailyAvailability, reserveAppointment } from "@/services/booking.service";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";
import {
  loadTenantMessageContexts,
  resolveTenantMessage,
} from "@/services/tenantMessages.service";

const NOTIFY_BATCH_LIMIT = 20;
const HOLD_TTL_SECONDS = 180;

interface WaitlistEntry {
  id: string;
  customer_phone: string;
  desired_time: string | null;
  service_slug: string | null;
}

export async function addToWaitlist(
  tenantId: string,
  customerPhone: string,
  desiredDate: string,
  desiredTime?: string,
  serviceSlug?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_phone: customerPhone,
    desired_date: desiredDate,
    desired_time: desiredTime || null,
    service_slug: serviceSlug || null,
    notified: false,
  };

  try {
    const { error } = await supabase
      .from("waitlist")
      .upsert(row, { onConflict: "tenant_id,customer_phone,desired_date" });
    if (!error) return { ok: true };

    // Migration 037 uygulanmadıysa hizmetsiz kaydet; bekleme listesi çalışmaya devam etsin.
    const missing = extractMissingSchemaColumn(error);
    if (missing?.table === "waitlist" && missing.column === "service_slug") {
      delete row.service_slug;
      const retry = await supabase
        .from("waitlist")
        .upsert(row, { onConflict: "tenant_id,customer_phone,desired_date" });
      if (retry.error) return { ok: false, error: retry.error.message };
      return { ok: true };
    }
    return { ok: false, error: error.message };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hata" };
  }
}

async function fetchPendingEntries(
  tenantId: string,
  date: string
): Promise<WaitlistEntry[]> {
  const withService = await supabase
    .from("waitlist")
    .select("id, customer_phone, desired_time, service_slug")
    .eq("tenant_id", tenantId)
    .eq("desired_date", date)
    .eq("notified", false)
    .order("created_at", { ascending: true })
    .limit(NOTIFY_BATCH_LIMIT);

  if (!withService.error) return (withService.data || []) as WaitlistEntry[];

  const missing = extractMissingSchemaColumn(withService.error);
  if (missing?.table !== "waitlist" || missing.column !== "service_slug") return [];

  const legacy = await supabase
    .from("waitlist")
    .select("id, customer_phone, desired_time")
    .eq("tenant_id", tenantId)
    .eq("desired_date", date)
    .eq("notified", false)
    .order("created_at", { ascending: true })
    .limit(NOTIFY_BATCH_LIMIT);
  if (legacy.error) return [];
  return ((legacy.data || []) as Array<Omit<WaitlistEntry, "service_slug">>).map((row) => ({
    ...row,
    service_slug: null,
  }));
}

/**
 * Yer açıldığında bekleme listesini bilgilendirir.
 *
 * Müsaitlik HER MÜŞTERİNİN KENDİ HİZMETİ için ayrı hesaplanır: 30 dk'lık bir
 * boşluk manikür bekleyene uygundur, 2,5 saatlik balyaj bekleyene değildir.
 * Aynı hizmeti bekleyenler tek sorguyu paylaşır.
 */
export async function notifyWaitlist(
  tenantId: string,
  date: string,
  tenantName: string
): Promise<number> {
  const entries = await fetchPendingEntries(tenantId, date);
  if (entries.length === 0) return 0;

  const messageContexts = await loadTenantMessageContexts([tenantId]);
  const messageContext = messageContexts.get(tenantId);

  // Hizmet başına tek müsaitlik sorgusu.
  const slugs = [...new Set(entries.map((e) => e.service_slug || ""))];
  const slotsByService = new Map<string, string[]>();
  for (const slug of slugs) {
    const daily = await getDailyAvailability(tenantId, date, {
      serviceSlug: slug || null,
    });
    slotsByService.set(
      slug,
      daily.checkFailed || daily.blocked || daily.closed ? [] : daily.available
    );
  }

  // Aynı saat iki kişiye önerilmesin: tutulan saat havuzdan düşer.
  const taken = new Set<string>();
  let notified = 0;

  for (const entry of entries) {
    const key = entry.service_slug || "";
    const candidates = (slotsByService.get(key) || []).filter((s) => !taken.has(s));
    if (candidates.length === 0) continue;

    const desired = entry.desired_time ? entry.desired_time.slice(0, 5) : null;
    const slot = (desired && candidates.find((s) => s === desired)) || candidates[0];
    if (!slot) continue;

    // Önce satırı sahiplen: eşzamanlı worker aynı kişiye iki kez yazmasın.
    const { data: claimed } = await supabase
      .from("waitlist")
      .update({ notified: true })
      .eq("id", entry.id)
      .eq("notified", false)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const hold = await reserveAppointment({
      tenantId,
      customerPhone: entry.customer_phone,
      date,
      time: slot,
      serviceSlug: entry.service_slug,
      holdOnly: true,
      holdTtlSeconds: HOLD_TTL_SECONDS,
    });
    if (!hold.ok) {
      await supabase.from("waitlist").update({ notified: false }).eq("id", entry.id);
      continue;
    }

    const text = resolveTenantMessage(
      messageContext,
      "waitlist_available",
      { date, time: slot, tenant_name: tenantName },
      "{tenant_name} için {date} tarihinde yer açıldı! Önerilen saat: {time}. Randevuyu oluşturmak isterseniz yazmanız yeterli (3 dakika tutuluyor)."
    );
    const sent = await sendWhatsAppMessage({
      to: entry.customer_phone,
      text,
    });
    if (!sent) {
      await clearBookingSlotHold(tenantId, date, slot, hold.staff_id).catch(() => undefined);
      await supabase.from("waitlist").update({ notified: false }).eq("id", entry.id);
      continue;
    }

    taken.add(slot);
    notified++;
  }

  return notified;
}
