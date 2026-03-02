import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabase as adminSupabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";
import { loginEmailToUsernameDisplay, normalizeUsername } from "@/lib/username-auth";

export default async function DashboardTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/dashboard/login");
  }

  const requestedColumns = ["user_id", "owner_username"];
  let selectColumns = [...requestedColumns];
  let tenant: Record<string, unknown> | null = null;

  for (let i = 0; i < requestedColumns.length; i++) {
    const result = await adminSupabase
      .from("tenants")
      .select(selectColumns.join(", "))
      .eq("id", tenantId)
      .single();
    if (!result.error) {
      tenant = (result.data ?? null) as Record<string, unknown> | null;
      break;
    }
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "tenants" || !selectColumns.includes(missing.column)) {
      break;
    }
    selectColumns = selectColumns.filter((column) => column !== missing.column);
  }

  if (!tenant) {
    redirect("/dashboard");
  }

  const tenantUserId = typeof tenant.user_id === "string" ? tenant.user_id : null;
  if (tenantUserId === user.id) {
    return <>{children}</>;
  }

  const tenantOwnerUsername =
    typeof tenant.owner_username === "string" ? normalizeUsername(tenant.owner_username) : null;
  const ownerUsernameRaw = user.email ? loginEmailToUsernameDisplay(user.email) : "";
  const ownerUsername =
    ownerUsernameRaw && ownerUsernameRaw !== user.email ? normalizeUsername(ownerUsernameRaw) : null;

  if (!tenantOwnerUsername || !ownerUsername || tenantOwnerUsername !== ownerUsername) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
