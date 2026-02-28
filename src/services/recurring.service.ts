import { supabase } from "@/lib/supabase";

export async function createRecurringAppointment(
  tenantId: string,
  customerPhone: string,
  dayOfWeek: number,
  time: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("recurring_appointments").upsert(
      {
        tenant_id: tenantId,
        customer_phone: customerPhone,
        day_of_week: dayOfWeek,
        time,
        active: true,
      },
      { onConflict: "tenant_id,customer_phone,day_of_week,time" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hata" };
  }
}

export async function getRecurringAppointments(
  tenantId: string,
  customerPhone: string
): Promise<Array<{ id: string; day_of_week: number; time: string }>> {
  const { data } = await supabase
    .from("recurring_appointments")
    .select("id, day_of_week, time")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .eq("active", true);
  return data || [];
}

export async function cancelRecurringAppointment(
  tenantId: string,
  recurringId: string
): Promise<{ ok: boolean }> {
  await supabase
    .from("recurring_appointments")
    .update({ active: false })
    .eq("id", recurringId)
    .eq("tenant_id", tenantId);
  return { ok: true };
}

const DAY_NAMES_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function dayOfWeekToTurkish(dow: number): string {
  return DAY_NAMES_TR[dow] || String(dow);
}

export function turkishToDayOfWeek(text: string): number | null {
  const t = text.trim().toLowerCase();
  const map: Record<string, number> = {
    pazar: 0, pazartesi: 1, salı: 2, sali: 2,
    çarşamba: 3, carsamba: 3, perşembe: 4, persembe: 4,
    cuma: 5, cumartesi: 6,
  };
  return map[t] ?? null;
}
