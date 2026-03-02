import { NextRequest, NextResponse } from "next/server";
import {
  clearRuntimeWhatsAppConfig,
  getRuntimeWhatsAppConfig,
  setRuntimeWhatsAppConfig,
} from "@/lib/redis";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";

function getDiagToken(): string {
  return (
    process.env.WHATSAPP_DIAG_TOKEN?.trim() ||
    process.env.WHATSAPP_VERIFY_TOKEN?.trim() ||
    ""
  );
}

function isAuthorized(request: NextRequest): boolean {
  const expected = getDiagToken();
  if (!expected) return false;
  const key = request.nextUrl.searchParams.get("key") || request.headers.get("x-diag-key") || "";
  return key === expected;
}

function maskTail(value: string, keep = 4): string {
  if (!value) return "";
  if (value.length <= keep) return value;
  return `${"*".repeat(Math.max(0, value.length - keep))}${value.slice(-keep)}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const runtime = await getRuntimeWhatsAppConfig();
  const envPhone = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const envToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();

  return NextResponse.json({
    ok: true,
    runtime: runtime
      ? {
          has_token: Boolean(runtime.token),
          phone_id_masked: maskTail(runtime.phone_id || "", 4),
          token_tail: maskTail(runtime.token || "", 6),
          updated_at: runtime.updated_at,
          source: runtime.source || null,
        }
      : null,
    env: {
      has_phone_id: Boolean(envPhone),
      has_token: Boolean(envToken),
      phone_id_masked: maskTail(envPhone, 4),
      token_tail: maskTail(envToken, 6),
      token_length: envToken.length || 0,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    action?: string;
    token?: string;
    phone_id?: string;
    to?: string;
    text?: string;
  };

  const action = (payload.action || "set").trim().toLowerCase();
  if (action === "send_test") {
    const to = (payload.to || "").trim();
    if (!to) {
      return NextResponse.json({ error: "to gerekli" }, { status: 400 });
    }
    const text = (payload.text || "Ahi AI server-side test mesajı").trim();
    const result = await sendWhatsAppMessageDetailed({ to, text });
    return NextResponse.json({ ok: true, action: "send_test", result });
  }

  if (action === "clear") {
    await clearRuntimeWhatsAppConfig();
    return NextResponse.json({ ok: true, action: "clear" });
  }

  const token = (payload.token || "").trim();
  const phoneId = (payload.phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneId) {
    return NextResponse.json(
      { error: "token ve phone_id gerekli" },
      { status: 400 }
    );
  }

  await setRuntimeWhatsAppConfig({
    token,
    phone_id: phoneId,
    updated_at: new Date().toISOString(),
    source: "diag-api",
  });

  return NextResponse.json({
    ok: true,
    action: "set",
    phone_id_masked: maskTail(phoneId, 4),
    token_tail: maskTail(token, 6),
  });
}
