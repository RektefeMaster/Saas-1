/**
 * Esnaf paylaşım paketi API: link, QR (base64 PNG), Instagram bio, Google Maps metni
 * GET /api/tenant/:id/assets
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateSharePackage } from "@/utils/generateTenantAssets";
import type { Tenant } from "@/types/tenant.types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id, name, tenant_code")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
    }

    const tenantData: Tenant = {
      id: tenant.id,
      name: tenant.name,
      tenant_code: tenant.tenant_code,
    };

    const sharePackage = await generateSharePackage(tenantData);

    return NextResponse.json({
      ...sharePackage,
      tenant_name: tenantData.name,
      tenant_code: tenantData.tenant_code,
    });
  } catch (err) {
    console.error("[tenant/assets]", err);
    return NextResponse.json(
      { error: "Paylaşım paketi oluşturulamadı" },
      { status: 500 }
    );
  }
}
