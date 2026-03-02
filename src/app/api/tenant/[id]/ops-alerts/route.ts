import { NextRequest, NextResponse } from "next/server";
import {
  createOpsAlert,
  listOpsAlerts,
  type OpsAlertStatus,
} from "@/services/opsAlert.service";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get("status") || "open").toLowerCase();
    const limitParam = Number(searchParams.get("limit") || "20");
    const status: OpsAlertStatus = statusParam === "resolved" ? "resolved" : "open";

    const alerts = await listOpsAlerts(tenantId, status, limitParam);
    return NextResponse.json(alerts);
  } catch (err) {
    const missingTable = extractMissingSchemaTable(
      err && typeof err === "object" ? (err as { message?: string }) : null
    );
    if (missingTable === "ops_alerts") {
      return NextResponse.json([]);
    }
    const msg = err instanceof Error ? err.message : "Uyarılar alınamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      type?: "delay" | "cancellation" | "no_show" | "system";
      severity?: "low" | "medium" | "high";
      customer_phone?: string;
      message?: string;
      meta?: Record<string, unknown>;
      dedupe_key?: string;
    };

    if (!body.type || !body.message) {
      return NextResponse.json(
        { error: "type ve message gerekli" },
        { status: 400 }
      );
    }

    await createOpsAlert({
      tenantId,
      type: body.type,
      severity: body.severity,
      customerPhone: body.customer_phone,
      message: body.message,
      meta: body.meta,
      dedupeKey: body.dedupe_key,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const missingTable = extractMissingSchemaTable(
      err && typeof err === "object" ? (err as { message?: string }) : null
    );
    if (missingTable === "ops_alerts") {
      return NextResponse.json(
        { error: "Operasyon uyarı modülü hazır değil. İlgili migration uygulanmalı." },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : "Uyarı oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
