import { NextRequest, NextResponse } from "next/server";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { requireValidTenantId } from "@/middleware/tenantScope.middleware";
import { getQualitySummary } from "@/services/qualityFeedback.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    requireValidTenantId(rawId);
    const tenantId = rawId;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;

    const days = Math.min(
      90,
      Math.max(1, Number(request.nextUrl.searchParams.get("days") || 30))
    );
    const byCategory = await getQualitySummary(tenantId, days);
    const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
    return NextResponse.json({ days, total, by_category: byCategory });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
