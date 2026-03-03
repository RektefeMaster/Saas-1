import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredTemporaryMedia } from "@/lib/redis";
import { logBotMessageAudit } from "@/services/botAudit.service";

const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}` && request.nextUrl.searchParams.get("key") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredTemporaryMedia(500);
    await logBotMessageAudit({
      traceId: `media-retention-${Date.now()}`,
      direction: "system",
      stage: "media_retention_cleanup",
      policyReason: "hourly_cron",
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
      policyReason: "hourly_cron",
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
