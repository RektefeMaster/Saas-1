import { NextResponse } from "next/server";
import { getGlobalKillSwitch } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();

  let sentryCount = 0;
  let sentryOk = true;

  if (token && org && project) {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const url = `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(
        project
      )}/issues/?start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(now.toISOString())}&limit=20&query=is:unresolved`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const data = (await res.json().catch(() => [])) as unknown[];
        sentryCount = Array.isArray(data) ? data.length : 0;
      } else {
        sentryOk = false;
      }
    } catch {
      sentryOk = false;
    }
  }

  let killSwitchEnabled = false;
  try {
    const state = await getGlobalKillSwitch();
    killSwitchEnabled = state.enabled;
  } catch {
    // Redis yoksa kill switch kapalı say
  }

  const status = killSwitchEnabled
    ? "paused"
    : !sentryOk
      ? "unknown"
      : sentryCount > 5
        ? "degraded"
        : sentryCount > 0
          ? "warning"
          : "ok";

  return NextResponse.json({
    status,
    killSwitchEnabled,
    sentryCount,
    sentryConfigured: Boolean(token && org && project),
  });
}
