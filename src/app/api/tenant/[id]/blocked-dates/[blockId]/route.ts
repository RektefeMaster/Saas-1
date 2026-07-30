/**
 * DELETE /api/tenant/:id/blocked-dates/:blockId
 */

import { NextRequest, NextResponse } from "next/server";
import { deleteBlockedDate } from "@/services/blockedDates.service";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    const { id, blockId } = await params;
    const auth = await requireTenantApiAccess(request, id);
    if (!auth.ok) return auth.response;
    const result = await deleteBlockedDate(id, blockId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[blocked-dates DELETE]", err);
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 });
  }
}
