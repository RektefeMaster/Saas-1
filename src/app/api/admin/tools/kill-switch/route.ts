import { NextRequest, NextResponse } from "next/server";
import { getGlobalKillSwitch, setGlobalKillSwitch } from "@/lib/redis";

function parseEnabled(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "on") return true;
    if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  }
  return null;
}

export async function GET() {
  try {
    const state = await getGlobalKillSwitch();
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kill switch durumu okunamadi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      enabled?: unknown;
      source?: unknown;
    };

    const enabled = parseEnabled(body.enabled);
    if (enabled === null) {
      return NextResponse.json(
        { error: "enabled alani zorunlu (true/false)" },
        { status: 400 }
      );
    }

    const source =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim().slice(0, 80)
        : "admin";

    const nextState = await setGlobalKillSwitch(enabled, source);
    return NextResponse.json(nextState);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kill switch guncellenemedi" },
      { status: 500 }
    );
  }
}
