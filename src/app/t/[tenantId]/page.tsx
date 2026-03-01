import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

const WHATSAPP_NUMBER = (
  process.env.WHATSAPP_API_PHONE || process.env.WHATSAPP_PHONE_NUMBER || "905551234567"
).replace(/\D/g, "");

export default async function TenantRedirectPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, tenant_code, config_override")
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

  const configOverride = tenant.config_override as { messages?: { whatsapp_greeting?: string } } | null;
  const customGreeting = configOverride?.messages?.whatsapp_greeting;
  const greeting = customGreeting
    ? customGreeting.replace(/\{tenant_name\}/g, tenant.name)
    : `Merhaba, ${tenant.name} için randevu almak istiyorum`;
  const message = `${greeting} #${tenant.tenant_code}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  redirect(url);
}
