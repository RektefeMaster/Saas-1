import { NextResponse } from "next/server";
import {
  listReactivationCandidates,
  queueReactivationCampaign,
} from "@/services/reactivation.service";
import { logTenantEvent } from "@/services/eventLog.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") || 45);
    const limit = Number(url.searchParams.get("limit") || 20);

    const candidates = await listReactivationCandidates(
      tenantId,
      Number.isFinite(days) ? Math.max(7, Math.min(180, days)) : 45,
      Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 20
    );

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      candidates,
      recommendation: {
        suggested_discount_pct: 10,
        suggested_window_hours: 48,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reactivation adaylari alinamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      mode?: "preview" | "queue";
      days?: number;
      limit?: number;
      phones?: string[];
      title?: string;
      note?: string;
      remind_at?: string;
      channel?: "panel" | "whatsapp" | "both";
    };

    const mode = body.mode || "queue";
    const days = Number.isFinite(Number(body.days)) ? Number(body.days) : 45;
    const limit = Number.isFinite(Number(body.limit)) ? Number(body.limit) : 20;

    const candidates = await listReactivationCandidates(tenantId, days, limit);
    const phones = (body.phones || []).filter(Boolean);
    const targetPhones =
      phones.length > 0 ? phones : candidates.map((candidate) => candidate.customer_phone);

    if (mode === "preview") {
      return NextResponse.json({
        mode,
        target_count: targetPhones.length,
        candidates,
      });
    }

    const queued = await queueReactivationCampaign({
      tenantId,
      phones: targetPhones,
      title: body.title,
      note: body.note,
      remindAt: body.remind_at,
      channel: body.channel,
    });

    await logTenantEvent({
      tenantId,
      eventType: "automation.reactivation.queued",
      actor: "tenant",
      entityType: "automation_rule",
      entityId: "reactivation",
      payload: {
        queued: queued.queued,
        channel: queued.channel,
        remind_at: queued.remind_at,
      },
    });

    return NextResponse.json({
      mode,
      target_count: targetPhones.length,
      queued,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reactivation kuyruklama basarisiz";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
