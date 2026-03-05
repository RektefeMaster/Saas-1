import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { generateDirectWhatsAppLink, generateQRCode } from "@/utils/generateTenantAssets";

// QR kodlar değişmediği için uzun cache süresi
export const revalidate = 3600;

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
  const format = request.nextUrl.searchParams.get("format") || "png";

  if (format === "svg") {
    const link = generateDirectWhatsAppLink(tenantData);
    const svg = await QRCode.toString(link, { type: "svg" });
    const response = new NextResponse(svg, {
      headers: { 
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
    return response;
  }

  const png = await generateQRCode(tenantData);
  const response = new NextResponse(new Uint8Array(png), {
    headers: { 
      "Content-Type": "image/png",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
  return response;
}
