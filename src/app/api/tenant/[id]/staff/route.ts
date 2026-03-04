import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

interface StaffRow {
  id: string;
  tenant_id: string;
  name: string;
  phone_e164: string | null;
  active: boolean;
  created_at: string;
}

interface StaffServiceRow {
  staff_id: string;
  service_slug: string;
}

function normalizeServiceSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  )];
}

function normalizePhoneE164(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("90")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+90${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+90${digits}`;
  }
  return `+${digits}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;

  const staffResult = await supabase
    .from("staff")
    .select("id, tenant_id, name, phone_e164, active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (staffResult.error) {
    const missingTable = extractMissingSchemaTable(staffResult.error);
    if (missingTable === "staff") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: staffResult.error.message }, { status: 500 });
  }

  const staffRows = (staffResult.data || []) as StaffRow[];
  const staffIds = staffRows.map((row) => row.id);

  if (staffIds.length === 0) {
    return NextResponse.json([]);
  }

  let servicesByStaff = new Map<string, string[]>();
  const mappingResult = await supabase
    .from("staff_services")
    .select("staff_id, service_slug")
    .eq("tenant_id", tenantId)
    .in("staff_id", staffIds);

  if (mappingResult.error) {
    const missingTable = extractMissingSchemaTable(mappingResult.error);
    if (missingTable !== "staff_services") {
      return NextResponse.json({ error: mappingResult.error.message }, { status: 500 });
    }
  } else {
    servicesByStaff = (mappingResult.data || []).reduce((map, row) => {
      const entry = row as StaffServiceRow;
      const current = map.get(entry.staff_id) || [];
      current.push(entry.service_slug);
      map.set(entry.staff_id, current);
      return map;
    }, new Map<string, string[]>());
  }

  return NextResponse.json(
    staffRows.map((row) => ({
      ...row,
      service_slugs: servicesByStaff.get(row.id) || [],
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone_e164?: string | null;
    active?: boolean;
    service_slugs?: string[];
  };

  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name gerekli" }, { status: 400 });
  }

  const insertResult = await supabase
    .from("staff")
    .insert({
      tenant_id: tenantId,
      name,
      phone_e164: normalizePhoneE164(body.phone_e164),
      active: body.active !== false,
    })
    .select("id, tenant_id, name, phone_e164, active, created_at")
    .single();

  if (insertResult.error || !insertResult.data) {
    const missingTable = extractMissingSchemaTable(insertResult.error);
    if (missingTable === "staff") {
      return NextResponse.json(
        { error: "Staff modulu hazir degil. Migration uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: insertResult.error?.message || "Staff kaydi olusturulamadi" },
      { status: 500 }
    );
  }

  const serviceSlugs = normalizeServiceSlugs(body.service_slugs);
  if (serviceSlugs.length > 0) {
    const mapInsert = await supabase.from("staff_services").insert(
      serviceSlugs.map((serviceSlug) => ({
        tenant_id: tenantId,
        staff_id: insertResult.data.id,
        service_slug: serviceSlug,
      }))
    );
    if (mapInsert.error) {
      const missingTable = extractMissingSchemaTable(mapInsert.error);
      if (missingTable !== "staff_services") {
        return NextResponse.json({ error: mapInsert.error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    ...insertResult.data,
    service_slugs: serviceSlugs,
  });
}
