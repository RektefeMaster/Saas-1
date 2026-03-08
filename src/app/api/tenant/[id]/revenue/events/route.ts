import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { logTenantEvent } from "@/services/eventLog.service";

const VALID_SOURCES = ["appointment", "manual", "package", "adjustment"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const url = new URL(request.url);
  const source = (url.searchParams.get("source") || "").trim();

  const from =
    url.searchParams.get("from") ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();

  let query = supabase
    .from("revenue_events")
    .select(
      "id, tenant_id, appointment_id, customer_phone, source, gross_amount, discount_amount, tax_amount, net_amount, currency, event_at, meta, created_at"
    )
    .eq("tenant_id", tenantId)
    .gte("event_at", from)
    .lte("event_at", to)
    .order("event_at", { ascending: false });

  if (VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  if (!error) {
    return NextResponse.json(data || []);
  }

  const missing = extractMissingSchemaTable(error);
  if (missing === "revenue_events") {
    return NextResponse.json([]);
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    appointment_id?: string | null;
    customer_phone?: string | null;
    source?: string;
    gross_amount?: number;
    discount_amount?: number;
    tax_amount?: number;
    net_amount?: number;
    currency?: string;
    event_at?: string;
    meta?: Record<string, unknown>;
  };

  if (!body.source || !VALID_SOURCES.includes(body.source as (typeof VALID_SOURCES)[number])) {
    return NextResponse.json({ error: "source gecersiz" }, { status: 400 });
  }

  const gross = Number(body.gross_amount || 0);
  const discount = Number(body.discount_amount || 0);
  const tax = Number(body.tax_amount || 0);
  const computedNet = round2(gross - discount + tax);
  const net = Number.isFinite(Number(body.net_amount))
    ? round2(Number(body.net_amount))
    : computedNet;

  const payload = {
    tenant_id: tenantId,
    appointment_id: body.appointment_id || null,
    customer_phone: body.customer_phone || null,
    source: body.source,
    gross_amount: round2(gross),
    discount_amount: round2(discount),
    tax_amount: round2(tax),
    net_amount: net,
    currency: (body.currency || "TRY").toUpperCase(),
    event_at: body.event_at || new Date().toISOString(),
    meta: body.meta || {},
  };

  const { data, error } = await supabase
    .from("revenue_events")
    .insert(payload)
    .select(
      "id, tenant_id, appointment_id, customer_phone, source, gross_amount, discount_amount, tax_amount, net_amount, currency, event_at, meta, created_at"
    )
    .single();

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "revenue_events") {
      return NextResponse.json(
        { error: "Revenue modulu hazir degil. Migration 016 uygulanmali." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logTenantEvent({
    tenantId,
    eventType: "revenue.event.created",
    actor: "tenant",
    entityType: "revenue_event",
    entityId: data.id,
    payload: {
      source: data.source,
      net_amount: data.net_amount,
      currency: data.currency,
    },
  });

  return NextResponse.json(data, { status: 201 });
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
