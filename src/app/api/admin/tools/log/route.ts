import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    logger.info("[Admin Tools] Test log - Pino entegrasyonu çalışıyor");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Log hatası" },
      { status: 500 }
    );
  }
}
