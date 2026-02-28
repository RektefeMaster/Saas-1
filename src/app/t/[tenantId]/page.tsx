import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const WHATSAPP_NUMBER = process.env.WHATSAPP_PHONE_NUMBER || "905551234567";

export default async function TenantRedirectPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, tenant_code")
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

  const message = `Merhaba, [${tenant.name}] için randevu almak istiyorum. Kod: ${tenant.tenant_code}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  redirect(url);
}
