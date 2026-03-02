import { NextRequest, NextResponse } from "next/server";
import { resolveOpsAlert } from "@/services/opsAlert.service";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  try {
    const { id: tenantId, alertId } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    if ((body.status || "").toLowerCase() !== "resolved") {
      return NextResponse.json(
        { error: "Sadece status=resolved desteklenir" },
        { status: 400 }
      );
    }

    const result = await resolveOpsAlert(tenantId, alertId);
    if (!result.ok) {
      const missingTable = extractMissingSchemaTable({ message: result.error });
      if (missingTable === "ops_alerts") {
        return NextResponse.json(
          { error: "Operasyon uyarı modülü hazır değil. İlgili migration uygulanmalı." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Uyarı bulunamadı" ? 404 : 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Uyarı güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
