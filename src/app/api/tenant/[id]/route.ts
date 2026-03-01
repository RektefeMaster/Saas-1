import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const requestedColumns = [
    "id",
    "name",
    "tenant_code",
    "status",
    "config_override",
    "ui_preferences",
    "security_config",
    "owner_phone_e164",
    "contact_phone",
    "working_hours_text",
  ];
  const missingColumns = new Set<string>();
  let selectColumns = [...requestedColumns];
  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;
  for (let i = 0; i < requestedColumns.length; i++) {
    const result = await supabase
      .from("tenants")
      .select(selectColumns.join(", "))
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!result.error) {
      data = ((result.data as unknown) as Record<string, unknown>) ?? null;
      error = null;
      break;
    }
    error = { message: result.error.message };
    const missing = extractMissingSchemaColumn(result.error);
    if (!missing || missing.table !== "tenants" || !selectColumns.includes(missing.column)) {
      break;
    }
    selectColumns = selectColumns.filter((c) => c !== missing.column);
    missingColumns.add(missing.column);
  }

  if (error || !data) {
    return NextResponse.json({ error: "Tenant bulunamadı" }, { status: 404 });
  }
  for (const column of missingColumns) {
    if (column === "security_config" || column === "ui_preferences") {
      data[column] = {};
    } else {
      data[column] = null;
    }
  }
  return NextResponse.json(data);
}
