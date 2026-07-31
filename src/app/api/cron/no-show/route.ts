import { NextRequest, NextResponse } from "next/server";
import { processNoShowBatch } from "@/services/noShowCron.service";
import { assertCronAuthorized } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const result = await processNoShowBatch("cron/no-show");
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, marked: result.marked });
}
