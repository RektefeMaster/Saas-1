import { NextResponse } from "next/server";
import { requireDebugAccess } from "@/lib/debug-auth";

const WHATSAPP_API = "https://graph.facebook.com/v22.0";

export async function GET() {
  const blocked = await requireDebugAccess();
  if (blocked) return blocked;

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    return NextResponse.json(
      {
        ok: false,
        reason: "missing_credentials",
        checks: {
          WHATSAPP_PHONE_NUMBER_ID: !!phoneId,
          WHATSAPP_ACCESS_TOKEN: !!token,
        },
      },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API}/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating,status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const payload = (await res.json().catch(() => ({}))) as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      status?: string;
      error?: { code?: number; error_subcode?: number; message?: string };
    };

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "graph_error",
          status: res.status,
          error: payload.error ?? null,
        },
        { status: 502 }
      );
    }

    const warnings: string[] = [];
    if ((payload.verified_name || "").toLowerCase().includes("test number")) {
      warnings.push(
        "Bu numara Meta test numarası görünüyor; sadece allowed list içindeki numaralara yanıt verebilir."
      );
    }

    return NextResponse.json({
      ok: true,
      phone_id: payload.id ?? phoneId,
      display_phone_number: payload.display_phone_number ?? null,
      verified_name: payload.verified_name ?? null,
      quality_rating: payload.quality_rating ?? null,
      status: payload.status ?? null,
      warnings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason: "network_error",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }
}
