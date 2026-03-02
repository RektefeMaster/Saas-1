import { NextResponse } from "next/server";
import { getCommandCenterSnapshot } from "@/services/commandCenter.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const snapshot = await getCommandCenterSnapshot(tenantId);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Command center verisi alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
