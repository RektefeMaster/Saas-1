import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabase as adminSupabase } from "@/lib/supabase";

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

  const { data: tenant } = await adminSupabase
    .from("tenants")
    .select("user_id")
    .eq("id", tenantId)
    .single();

  if (!tenant) {
    redirect("/dashboard");
  }

  if (!tenant.user_id || tenant.user_id !== user.id) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
