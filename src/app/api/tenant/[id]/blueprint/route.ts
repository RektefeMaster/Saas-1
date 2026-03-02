import { NextResponse } from "next/server";
import {
  getTenantBlueprint,
  listBlueprintCatalog,
  upsertTenantBlueprintOverride,
} from "@/services/blueprint.service";
import { logTenantEvent } from "@/services/eventLog.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const url = new URL(request.url);
    const includeCatalog = url.searchParams.get("include_catalog") === "1";

    const blueprint = await getTenantBlueprint(tenantId);
    if (!includeCatalog) {
      return NextResponse.json(blueprint);
    }

    return NextResponse.json({
      ...blueprint,
      catalog: listBlueprintCatalog(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blueprint alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      modules?: Record<string, unknown>;
      kpi_targets?: Record<string, unknown>;
      automation_defaults?: Record<string, unknown>;
      resource_templates?: Record<string, unknown>;
    };

    const updated = await upsertTenantBlueprintOverride(tenantId, body);

    await logTenantEvent({
      tenantId,
      eventType: "blueprint.updated",
      actor: "tenant",
      entityType: "blueprint",
      entityId: tenantId,
      payload: {
        keys: Object.keys(body || {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Blueprint guncellenemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
