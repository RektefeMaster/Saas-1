import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

const PREFIX = "admin-tools:";

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key")?.trim();
    if (!key) {
      return NextResponse.json({ error: "key parametresi gerekli" }, { status: 400 });
    }
    const value = await storage.getItem(`${PREFIX}${key}`);
    return NextResponse.json({ value });
  } catch (err) {
    console.error("[admin tools cache get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cache okuma hatası" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, key, value } = body;
    const k = String(key ?? "").trim();
    if (!k) {
      return NextResponse.json({ error: "key gerekli" }, { status: 400 });
    }
    if (action === "set") {
      await storage.setItem(`${PREFIX}${k}`, String(value ?? ""));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
  } catch (err) {
    console.error("[admin tools cache post]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cache yazma hatası" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const keys = await storage.getKeys(PREFIX);
    let deleted = 0;
    for (const key of keys) {
      await storage.removeItem(key);
      deleted++;
    }
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error("[admin tools cache delete]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cache temizleme hatası" },
      { status: 500 }
    );
  }
}
