import { supabase } from "@/lib/supabase";
import { clearBookingSlotHold } from "@/lib/redis";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { reserveAppointment } from "@/services/booking.service";

export async function addToWaitlist(
  tenantId: string,
  customerPhone: string,
  desiredDate: string,
  desiredTime?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("waitlist").upsert(
      {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        desired_date: desiredDate,
        desired_time: desiredTime || null,
        notified: false,
      },
      { onConflict: "tenant_id,customer_phone,desired_date" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hata" };
  }
}

export async function notifyWaitlist(
  tenantId: string,
  date: string,
  availableSlots: string[],
  tenantName: string
): Promise<number> {
  if (availableSlots.length === 0) return 0;

  const { data: entries } = await supabase
    .from("waitlist")
    .select("id, customer_phone, desired_time")
    .eq("tenant_id", tenantId)
    .eq("desired_date", date)
    .eq("notified", false)
    .limit(20);

  if (!entries || entries.length === 0) return 0;

  let notified = 0;
  const remaining = [...availableSlots];
  for (const entry of entries) {
    const preferred = entry.desired_time
      ? remaining.filter((s) => s === entry.desired_time)
      : remaining;
    if (preferred.length === 0) continue;
    const slot = preferred[0];

    // Claim waitlist row first so concurrent workers cannot double-notify.
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
      holdOnly: true,
      holdTtlSeconds: 180,
    });
    if (!hold.ok) {
      await supabase.from("waitlist").update({ notified: false }).eq("id", entry.id);
      continue;
    }

    const sent = await sendWhatsAppMessage({
      to: entry.customer_phone,
      text: `${tenantName} için ${date} tarihinde yer açıldı! Önerilen saat: ${slot}. Hemen yazmak ister misin? (3 dk tutuluyor)`,
    });
    if (!sent) {
      await clearBookingSlotHold(tenantId, date, slot, hold.staff_id).catch(() => undefined);
      await supabase.from("waitlist").update({ notified: false }).eq("id", entry.id);
      continue;
    }

    remaining.splice(remaining.indexOf(slot), 1);
    notified++;
  }
  return notified;
}
