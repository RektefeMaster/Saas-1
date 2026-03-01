/**
 * Herkese açık işletme listesi (webhook "hangi işletme" yanıtı için)
 * GET /api/public/tenants
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { generateWhatsAppLink } from "@/utils/generateTenantAssets";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json([]);
    }
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id, name, tenant_code, config_override")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("[public/tenants]", error);
      return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
    }

    const list = (tenants || []).map((t) => ({
      id: t.id,
      name: t.name,
      tenant_code: t.tenant_code,
      whatsapp_link: generateWhatsAppLink({
        id: t.id,
        name: t.name,
        tenant_code: t.tenant_code,
        config_override: t.config_override as { messages?: { whatsapp_greeting?: string } },
      }),
    }));

    return NextResponse.json(list);
  } catch (err) {
    console.error("[public/tenants]", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}
