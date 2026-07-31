import { supabase } from "@/lib/supabase";
import type { TenantMembership } from "@/types/conversation.types";

/**
 * Ensure an active membership exists for the tenant owner (or staff user).
 * Creates owner row from tenants.user_id when missing.
 */
export async function ensureTenantMembership(
  tenantId: string,
  userId: string,
  role: TenantMembership["role"] = "owner"
): Promise<TenantMembership | null> {
  const { data: existing } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, user_id, role, status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    if (existing.status === "active") return existing as TenantMembership;
    const { data: reactivated } = await supabase
      .from("tenant_memberships")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("tenant_id", tenantId)
      .select("id, tenant_id, user_id, role, status")
      .single();
    if (reactivated?.id) return reactivated as TenantMembership;
  }

  const { data: inserted, error } = await supabase
    .from("tenant_memberships")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role,
      status: "active",
    })
    .select("id, tenant_id, user_id, role, status")
    .single();

  if (error) {
    // Race: another request inserted
    const { data: raced } = await supabase
      .from("tenant_memberships")
      .select("id, tenant_id, user_id, role, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    return (raced as TenantMembership) || null;
  }

  return inserted as TenantMembership;
}

export async function getActiveMembership(
  tenantId: string,
  userId: string
): Promise<TenantMembership | null> {
  const { data } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, user_id, role, status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (data?.id) return data as TenantMembership;

  // Lazy bootstrap for auth'd owners (user_id and/or owner_username path).
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tenant?.id) return null;
  return ensureTenantMembership(tenantId, userId, "owner");
}

export async function assertMembershipBelongsToTenant(
  membershipId: string,
  tenantId: string
): Promise<TenantMembership | null> {
  const { data } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, user_id, role, status")
    .eq("id", membershipId)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  return (data as TenantMembership) || null;
}
