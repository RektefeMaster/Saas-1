import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredTemporaryMedia } from "@/lib/redis";
import { logBotMessageAudit } from "@/services/botAudit.service";
import { assertCronAuthorized } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const result = await purgeExpiredTemporaryMedia(500);
    await logBotMessageAudit({
      traceId: `media-retention-${Date.now()}`,
      direction: "system",
      stage: "media_retention_cleanup",
      policyReason: "daily_cron",
      toolResult: {
        scanned: result.scanned,
        removed: result.removed,
      },
    });
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      removed: result.removed,
    });
  } catch (err) {
    await logBotMessageAudit({
      traceId: `media-retention-${Date.now()}`,
      direction: "system",
      stage: "media_retention_cleanup_failed",
      policyReason: "daily_cron",
      errorCode: "media_cleanup_failed",
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
