import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

function normalizeServiceSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  const { id: tenantId, staffId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    active?: boolean;
    service_slugs?: string[];
  };

  const payload: Record<string, unknown> = {};
  if (body.name !== undefined) payload.name = String(body.name || "").trim();
  if (body.active !== undefined) payload.active = Boolean(body.active);

  if (Object.keys(payload).length > 0) {
    const updateResult = await supabase
      .from("staff")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("id", staffId)
      .select("id, tenant_id, name, active, created_at")
      .maybeSingle();

    if (updateResult.error) {
      const missingTable = extractMissingSchemaTable(updateResult.error);
      if (missingTable === "staff") {
        return NextResponse.json(
          { error: "Staff modulu hazir degil. Migration uygulanmali." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    if (!updateResult.data) {
      return NextResponse.json({ error: "Personel bulunamadi" }, { status: 404 });
    }
  }

  let serviceSlugs: string[] | undefined;
  if (body.service_slugs !== undefined) {
    serviceSlugs = normalizeServiceSlugs(body.service_slugs);
    const deleteResult = await supabase
      .from("staff_services")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("staff_id", staffId);

    if (deleteResult.error) {
      const missingTable = extractMissingSchemaTable(deleteResult.error);
      if (missingTable !== "staff_services") {
        return NextResponse.json({ error: deleteResult.error.message }, { status: 500 });
      }
      serviceSlugs = [];
    } else if (serviceSlugs.length > 0) {
      const insertResult = await supabase.from("staff_services").insert(
        serviceSlugs.map((serviceSlug) => ({
          tenant_id: tenantId,
          staff_id: staffId,
          service_slug: serviceSlug,
        }))
      );
      if (insertResult.error) {
        const missingTable = extractMissingSchemaTable(insertResult.error);
        if (missingTable !== "staff_services") {
          return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
        }
      }
    }
  }

  const readResult = await supabase
    .from("staff")
    .select("id, tenant_id, name, active, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", staffId)
    .maybeSingle();

  if (readResult.error || !readResult.data) {
    return NextResponse.json({ error: "Personel bulunamadi" }, { status: 404 });
  }

  if (serviceSlugs === undefined) {
    const mappingResult = await supabase
      .from("staff_services")
      .select("service_slug")
      .eq("tenant_id", tenantId)
      .eq("staff_id", staffId);

    if (mappingResult.error) {
      const missingTable = extractMissingSchemaTable(mappingResult.error);
      if (missingTable !== "staff_services") {
        return NextResponse.json({ error: mappingResult.error.message }, { status: 500 });
      }
      serviceSlugs = [];
    } else {
      serviceSlugs = (mappingResult.data || []).map((row) => String(row.service_slug));
    }
  }

  return NextResponse.json({
    ...readResult.data,
    service_slugs: serviceSlugs || [],
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> }
) {
  const { id: tenantId, staffId } = await params;

  const result = await supabase
    .from("staff")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", staffId)
    .select("id")
    .maybeSingle();

  if (result.error) {
    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "staff") {
      return NextResponse.json(
        { error: "Staff modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "Personel bulunamadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: result.data.id });
}
