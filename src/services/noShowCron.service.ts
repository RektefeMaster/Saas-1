/**
 * Shared no-show candidate selection for cron routes.
 * Bounded window prevents marking ancient confirmed rows on first run.
 */
import { supabase } from "@/lib/supabase";
import { markAppointmentNoShow, type NoShowSource } from "@/services/noShow.service";

const NO_SHOW_LOOKBACK_DAYS = 7;
const NO_SHOW_GRACE_HOURS = 2;
const NO_SHOW_BATCH_LIMIT = 200;

export async function processNoShowBatch(source: NoShowSource): Promise<{
  marked: number;
  error?: string;
}> {
  const now = Date.now();
  const twoHoursAgo = new Date(now - NO_SHOW_GRACE_HOURS * 60 * 60 * 1000).toISOString();
  const lookbackStart = new Date(
    now - NO_SHOW_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, staff_id")
    .eq("status", "confirmed")
    .lt("slot_start", twoHoursAgo)
    .gte("slot_start", lookbackStart)
    .order("slot_start", { ascending: true })
    .limit(NO_SHOW_BATCH_LIMIT);

  if (error) {
    return { marked: 0, error: error.message };
  }

  if (!appointments || appointments.length === 0) {
    return { marked: 0 };
  }

  const ids = appointments.map((a) => a.id);
  const { data: updatedRows, error: updateErr } = await supabase
    .from("appointments")
    .update({ status: "no_show" })
    .in("id", ids)
    .eq("status", "confirmed")
    .select("id");

  if (updateErr) {
    return { marked: 0, error: updateErr.message };
  }

  const updatedIdSet = new Set((updatedRows || []).map((r) => r.id));
  const markedAppointments = appointments.filter((a) => updatedIdSet.has(a.id));

  for (const apt of markedAppointments) {
    await markAppointmentNoShow({
      appointmentId: apt.id,
      tenantId: apt.tenant_id,
      customerPhone: apt.customer_phone,
      staffId: (apt.staff_id as string | null | undefined) || null,
      source,
    }).catch((e) => console.error(`[noShowCron] side effects error (${source}):`, e));
  }

  return { marked: markedAppointments.length };
}
