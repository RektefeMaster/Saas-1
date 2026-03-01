import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateWhatsAppLink } from "@/utils/generateTenantAssets";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://saasrandevu.com";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, tenant_code, config_override")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
  }

  const tenantData = {
    id: tenant.id,
    name: tenant.name,
    tenant_code: tenant.tenant_code,
    config_override: tenant.config_override,
  };
  const whatsappUrl = generateWhatsAppLink(tenantData);

  return NextResponse.json({
    whatsapp_url: whatsappUrl,
    tenant_name: tenant.name,
    tenant_code: tenant.tenant_code,
    qr_api: `${BASE_URL}/api/tenant/${id}/qr`,
  });
}
