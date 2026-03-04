import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "@/lib/id";
import { getAppBaseUrl } from "@/lib/app-url";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { supabase } from "@/lib/supabase";
import { logTenantEvent } from "@/services/eventLog.service";

type DurationUnit = "m" | "h" | "d" | "w";

function parseDuration(input: string | undefined | null): number | null {
  const raw = (input || "").trim().toLowerCase();
  const value = raw || "24h";
  const match = value.match(/^(\d{1,3})\s*([mhdw])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2] as DurationUnit;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unitMs: Record<DurationUnit, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const totalMs = amount * unitMs[unit];
  const minMs = 5 * 60 * 1000; // 5 dakika
  const maxMs = 30 * 24 * 60 * 60 * 1000; // 30 gun
  if (totalMs < minMs || totalMs > maxMs) return null;
  return totalMs;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    expires_in?: string;
    purpose?: string;
  };

  const durationMs = parseDuration(body.expires_in);
  if (!durationMs) {
    return NextResponse.json(
      {
        error:
          "expires_in gecersiz. Ornek formatlar: 15m, 1h, 1d, 7d (min 5m, max 30d)",
      },
      { status: 400 }
    );
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (tenantError) {
    return NextResponse.json(
      { error: tenantError.message },
      { status: 500 }
    );
  }

  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant bulunamadi" },
      { status: 404 }
    );
  }

  const token = nanoid(42);
  const now = Date.now();
  const expiresAt = new Date(now + durationMs).toISOString();
  const purpose =
    typeof body.purpose === "string" && body.purpose.trim()
      ? body.purpose.trim().slice(0, 80)
      : "tenant_public_link";

  const { error: insertError } = await supabase.from("magic_links").insert({
    token,
    tenant_id: id,
    purpose,
    expires_at: expiresAt,
    created_by: "admin",
  });

  if (insertError) {
    const missingTable = extractMissingSchemaTable(insertError);
    if (missingTable === "magic_links") {
      return NextResponse.json(
        {
          error:
            "magic_links tablosu bulunamadi. Supabase migration 028 calistirilmali.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  const magicUrl = `${getAppBaseUrl()}/magic/${token}`;

  await logTenantEvent({
    tenantId: id,
    eventType: "magic_link_created",
    actor: "admin",
    entityType: "magic_link",
    entityId: token,
    payload: {
      purpose,
      expires_at: expiresAt,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    token,
    magic_url: magicUrl,
    tenant_id: id,
    tenant_name: tenant.name,
    purpose,
    expires_at: expiresAt,
  });
}
