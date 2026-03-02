import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateWhatsAppLink } from "@/utils/generateTenantAssets";

export default async function TenantRedirectPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, tenant_code, config_override")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .single();

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-600">
        İşletme bulunamadı.
      </div>
    );
  }

  redirect(
    generateWhatsAppLink({
      id: tenant.id,
      name: tenant.name,
      tenant_code: tenant.tenant_code,
      config_override: tenant.config_override,
    })
  );
}
