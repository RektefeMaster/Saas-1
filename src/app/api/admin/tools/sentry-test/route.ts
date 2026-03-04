import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function POST() {
  try {
    Sentry.captureException(new Error("[Admin Tools] Test hatası - Sentry entegrasyonu kontrolü"));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sentry hatası" },
      { status: 500 }
    );
  }
}
