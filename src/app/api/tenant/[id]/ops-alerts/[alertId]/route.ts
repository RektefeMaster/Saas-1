import { NextRequest, NextResponse } from "next/server";
import { resolveOpsAlert } from "@/services/opsAlert.service";

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
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Uyarı güncellenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
