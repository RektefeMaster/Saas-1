import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getCommandCenterSnapshot } from "@/services/commandCenter.service";

const COMMAND_CENTER_CACHE_SECONDS = 45;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const getCachedSnapshot = unstable_cache(
      async () => getCommandCenterSnapshot(tenantId),
      [`command-center-${tenantId}`],
      { revalidate: COMMAND_CENTER_CACHE_SECONDS, tags: [`command-center-${tenantId}`] }
    );
    const snapshot = await getCachedSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Command center verisi alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
