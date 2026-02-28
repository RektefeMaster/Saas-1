import { supabase } from "@/lib/supabase";

const NO_SHOW_THRESHOLD = 3;

export async function isCustomerBlocked(
  tenantId: string,
  customerPhone: string
): Promise<boolean> {
  const { data } = await supabase
    .from("customer_blacklist")
    .select("is_blocked")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();
  return data?.is_blocked === true;
}

export async function incrementNoShow(
  tenantId: string,
  customerPhone: string
): Promise<{ blocked: boolean; count: number }> {
  const { data: existing } = await supabase
    .from("customer_blacklist")
    .select("id, no_show_count")
    .eq("tenant_id", tenantId)
    .eq("customer_phone", customerPhone)
    .maybeSingle();

  const newCount = (existing?.no_show_count ?? 0) + 1;
  const shouldBlock = newCount >= NO_SHOW_THRESHOLD;

  if (existing) {
    await supabase
      .from("customer_blacklist")
      .update({
        no_show_count: newCount,
        is_blocked: shouldBlock,
        blocked_at: shouldBlock ? new Date().toISOString() : null,
        reason: shouldBlock ? `${NO_SHOW_THRESHOLD}+ no-show` : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("customer_blacklist").insert({
      tenant_id: tenantId,
      customer_phone: customerPhone,
      no_show_count: newCount,
      is_blocked: shouldBlock,
      blocked_at: shouldBlock ? new Date().toISOString() : null,
      reason: shouldBlock ? `${NO_SHOW_THRESHOLD}+ no-show` : null,
    });
  }

  return { blocked: shouldBlock, count: newCount };
}
