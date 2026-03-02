import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params;
  const url = new URL(request.url);

  const from =
    url.searchParams.get("from") ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = url.searchParams.get("to") || new Date().toISOString();

  const { data, error } = await supabase
    .from("revenue_events")
    .select("source, gross_amount, discount_amount, tax_amount, net_amount, currency")
    .eq("tenant_id", tenantId)
    .gte("event_at", from)
    .lte("event_at", to);

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "revenue_events") {
      return NextResponse.json({
        from,
        to,
        totals: {
          gross_amount: 0,
          discount_amount: 0,
          tax_amount: 0,
          net_amount: 0,
        },
        by_source: {},
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];
  const totals = rows.reduce(
    (acc, row) => {
      acc.gross_amount += Number(row.gross_amount || 0);
      acc.discount_amount += Number(row.discount_amount || 0);
      acc.tax_amount += Number(row.tax_amount || 0);
      acc.net_amount += Number(row.net_amount || 0);
      return acc;
    },
    {
      gross_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      net_amount: 0,
    }
  );

  const bySource: Record<
    string,
    { count: number; net_amount: number; gross_amount: number }
  > = {};

  for (const row of rows) {
    const key = row.source || "unknown";
    if (!bySource[key]) {
      bySource[key] = { count: 0, net_amount: 0, gross_amount: 0 };
    }
    bySource[key].count += 1;
    bySource[key].net_amount += Number(row.net_amount || 0);
    bySource[key].gross_amount += Number(row.gross_amount || 0);
  }

  return NextResponse.json({
    from,
    to,
    currency: rows[0]?.currency || "TRY",
    totals: {
      gross_amount: round2(totals.gross_amount),
      discount_amount: round2(totals.discount_amount),
      tax_amount: round2(totals.tax_amount),
      net_amount: round2(totals.net_amount),
    },
    by_source: Object.fromEntries(
      Object.entries(bySource).map(([key, value]) => [
        key,
        {
          ...value,
          net_amount: round2(value.net_amount),
          gross_amount: round2(value.gross_amount),
        },
      ])
    ),
  });
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
