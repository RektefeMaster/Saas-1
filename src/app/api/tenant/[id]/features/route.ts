import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  extractMissingSchemaColumn,
  extractMissingSchemaTable,
} from "@/lib/postgrest-schema";
import {
  buildFeatureFlags,
  coerceFeatureFlags,
  inferFeatureFlagsByBusinessType,
} from "@/types/feature-flags";

interface TenantFeatureRow {
  id: string;
  name?: string | null;
  business_type_id?: string | null;
  config_override?: Record<string, unknown> | null;
}

interface BusinessTypeFeatureRow {
  id: string;
  slug?: string | null;
  name?: string | null;
  feature_flags?: Record<string, unknown> | null;
}

async function getTenantForFeatures(tenantId: string): Promise<TenantFeatureRow | null> {
  const requestedColumns = ["id", "name", "business_type_id", "config_override"];
  let selectColumns = [...requestedColumns];

  for (let i = 0; i < requestedColumns.length; i++) {
    const res = await supabase
      .from("tenants")
      .select(selectColumns.join(", "))
      .eq("id", tenantId)
      .is("deleted_at", null)
      .single();

    if (!res.error) {
      return (res.data ?? null) as unknown as TenantFeatureRow | null;
    }

    const missingColumn = extractMissingSchemaColumn(res.error);
    if (
      !missingColumn ||
      missingColumn.table !== "tenants" ||
      !selectColumns.includes(missingColumn.column)
    ) {
      throw new Error(res.error.message);
    }

    selectColumns = selectColumns.filter((column) => column !== missingColumn.column);
  }

  return null;
}

async function getBusinessTypeFeatures(
  businessTypeId: string
): Promise<BusinessTypeFeatureRow | null> {
  const requestedColumns = ["id", "name", "slug", "feature_flags"];
  let selectColumns = [...requestedColumns];

  for (let i = 0; i < requestedColumns.length; i++) {
    const res = await supabase
      .from("business_types")
      .select(selectColumns.join(", "))
      .eq("id", businessTypeId)
      .maybeSingle();

    if (!res.error) {
      const row = (res.data ?? null) as BusinessTypeFeatureRow | null;
      if (row && !selectColumns.includes("feature_flags")) {
        row.feature_flags = null;
      }
      return row;
    }

    const missingColumn = extractMissingSchemaColumn(res.error);
    if (
      missingColumn &&
      missingColumn.table === "business_types" &&
      selectColumns.includes(missingColumn.column)
    ) {
      selectColumns = selectColumns.filter((column) => column !== missingColumn.column);
      continue;
    }

    const missingTable = extractMissingSchemaTable(res.error);
    if (missingTable === "business_types") {
      return null;
    }

    throw new Error(res.error.message);
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

    const tenant = await getTenantForFeatures(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant bulunamadi" }, { status: 404 });
    }

    const businessTypeId =
      typeof tenant.business_type_id === "string" ? tenant.business_type_id : null;

    const bt = businessTypeId ? await getBusinessTypeFeatures(businessTypeId) : null;

    const inferredFlags = inferFeatureFlagsByBusinessType(bt?.slug, bt?.name);
    const businessTypeFlags = coerceFeatureFlags(bt?.feature_flags);
    const tenantOverrideFlags = coerceFeatureFlags(
      (tenant.config_override as Record<string, unknown> | null)?.feature_flags
    );

    const featureFlags = buildFeatureFlags(
      inferredFlags,
      businessTypeFlags,
      tenantOverrideFlags
    );

    return NextResponse.json({
      tenant_id: tenantId,
      tenant_name: tenant.name || null,
      business_type: bt
        ? {
            id: bt.id,
            name: bt.name || null,
            slug: bt.slug || null,
          }
        : null,
      feature_flags: featureFlags,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Feature bilgisi alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
