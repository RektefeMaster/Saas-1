import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { processDueFollowUps } from "@/services/safeFollowUp.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const sent = await processDueFollowUps(50);
  return NextResponse.json({ ok: true, sent });
}
