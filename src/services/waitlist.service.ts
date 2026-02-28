import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

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
    .eq("notified", false);

  if (!entries || entries.length === 0) return 0;

  let notified = 0;
  for (const entry of entries) {
    const slots = entry.desired_time
      ? availableSlots.filter((s) => s === entry.desired_time)
      : availableSlots;
    if (slots.length === 0) continue;

    await sendWhatsAppMessage({
      to: entry.customer_phone,
      text: `${tenantName} için ${date} tarihinde yer açıldı! Müsait saatler: ${slots.join(", ")}. Hemen yazmak ister misin?`,
    });

    await supabase.from("waitlist").update({ notified: true }).eq("id", entry.id);
    notified++;
  }
  return notified;
}
