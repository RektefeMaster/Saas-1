import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  extractMissingSchemaColumn,
  extractMissingSchemaTable,
} from "@/lib/postgrest-schema";

function normalizePhone(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

const CUSTOMER_COLUMNS = [
  "id",
  "tenant_id",
  "customer_phone",
  "customer_name",
  "tags",
  "notes_summary",
  "metadata",
  "last_visit_at",
  "total_visits",
  "created_at",
  "updated_at",
];

type CustomerRow = {
  id?: string;
  tenant_id: string;
  customer_phone: string;
  customer_name: string | null;
  tags: string[];
  notes_summary: string | null;
  metadata?: Record<string, unknown>;
  last_visit_at: string | null;
  total_visits: number;
};

async function getCustomerWithFallback(
  tenantId: string,
  customerPhone: string
): Promise<{ customer: CustomerRow | null; missingColumns: Set<string> }> {
  const missingColumns = new Set<string>();
  let selectColumns = [...CUSTOMER_COLUMNS];

  for (let i = 0; i < CUSTOMER_COLUMNS.length; i++) {
    const result = await supabase
      .from("crm_customers")
      .select(selectColumns.join(", "))
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (!result.error) {
      const customer = (result.data ?? null) as CustomerRow | null;
      if (customer && missingColumns.has("metadata") && customer.metadata === undefined) {
        customer.metadata = {};
      }
      return { customer, missingColumns };
    }

    const missingColumn = extractMissingSchemaColumn(result.error);
    if (
      missingColumn &&
      missingColumn.table === "crm_customers" &&
      selectColumns.includes(missingColumn.column)
    ) {
      selectColumns = selectColumns.filter((column) => column !== missingColumn.column);
      missingColumns.add(missingColumn.column);
      continue;
    }

    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "crm_customers") {
      return { customer: null, missingColumns };
    }

    throw new Error(result.error.message);
  }

  return { customer: null, missingColumns };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  try {
    const { id: tenantId, phone } = await params;
    const customerPhone = normalizePhone(phone);

    const { customer } = await getCustomerWithFallback(tenantId, customerPhone);

    const notesResult = await supabase
      .from("crm_notes")
      .select("id, tenant_id, customer_phone, note, created_by, created_at")
      .eq("tenant_id", tenantId)
      .eq("customer_phone", customerPhone)
      .order("created_at", { ascending: false })
      .limit(20);

    let notes = notesResult.data ?? [];
    if (notesResult.error) {
      const missingTable = extractMissingSchemaTable(notesResult.error);
      if (missingTable !== "crm_notes") {
        return NextResponse.json({ error: notesResult.error.message }, { status: 500 });
      }
      notes = [];
    }

    return NextResponse.json({
      customer:
        customer ??
        ({
          tenant_id: tenantId,
          customer_phone: customerPhone,
          customer_name: null,
          tags: [],
          notes_summary: null,
          metadata: {},
          last_visit_at: null,
          total_visits: 0,
        } as Record<string, unknown>),
      notes: notes ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Musteri detayi alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phone: string }> }
) {
  const { id: tenantId, phone } = await params;
  const customerPhone = normalizePhone(phone);
  const body = (await request.json().catch(() => ({}))) as {
    customer_name?: string | null;
    tags?: string[];
    notes_summary?: string | null;
    metadata?: Record<string, unknown> | null;
    last_visit_at?: string | null;
    total_visits?: number;
  };

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_phone: customerPhone,
    updated_at: new Date().toISOString(),
  };

  if (body.customer_name !== undefined) payload.customer_name = body.customer_name;
  if (Array.isArray(body.tags)) payload.tags = body.tags;
  if (body.notes_summary !== undefined) payload.notes_summary = body.notes_summary;
  if (body.metadata !== undefined) {
    payload.metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  }
  if (body.last_visit_at !== undefined) payload.last_visit_at = body.last_visit_at;
  if (typeof body.total_visits === "number") payload.total_visits = body.total_visits;

  let selectColumns = [...CUSTOMER_COLUMNS];
  const patchPayload = { ...payload };

  for (let i = 0; i < CUSTOMER_COLUMNS.length; i++) {
    const result = await supabase
      .from("crm_customers")
      .upsert(patchPayload, { onConflict: "tenant_id,customer_phone" })
      .select(selectColumns.join(", "))
      .single();

    if (!result.error) {
      const data = (result.data ?? {}) as unknown as Record<string, unknown>;
      if (!selectColumns.includes("metadata")) {
        data.metadata = {};
      }
      return NextResponse.json(data);
    }

    const missingColumn = extractMissingSchemaColumn(result.error);
    if (
      missingColumn &&
      missingColumn.table === "crm_customers" &&
      (selectColumns.includes(missingColumn.column) ||
        Object.prototype.hasOwnProperty.call(patchPayload, missingColumn.column))
    ) {
      selectColumns = selectColumns.filter((column) => column !== missingColumn.column);
      delete patchPayload[missingColumn.column];
      continue;
    }

    const missingTable = extractMissingSchemaTable(result.error);
    if (missingTable === "crm_customers") {
      return NextResponse.json(
        { error: "CRM modulu hazir degil. Ilgili migration uygulanmali." },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "CRM guncellenemedi" }, { status: 500 });
}
