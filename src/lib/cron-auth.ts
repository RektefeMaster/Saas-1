import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Bearer CRON_SECRET gate with constant-time compare.
 * Returns a NextResponse on failure, or null when authorized.
 */
export function assertCronAuthorized(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim() || "";
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Atomically claim an appointment extra_data flag via jsonb merge (no full-object clobber).
 * Prefers RPC from migration 032; falls back to filtered update.
 */
export async function claimAppointmentExtraFlag(
  appointmentId: string,
  _currentExtra: Record<string, unknown>,
  flagKey: string
): Promise<{ claimed: boolean; error?: string }> {
  const claimedAt = new Date().toISOString();

  const rpc = await supabase.rpc("claim_appointment_extra_flag", {
    p_appointment_id: appointmentId,
    p_flag: flagKey,
    p_value: claimedAt,
  });
  if (!rpc.error) {
    return { claimed: Boolean(rpc.data) };
  }

  // Fallback when migration 032 is not applied yet.
  const { data: row, error: readErr } = await supabase
    .from("appointments")
    .select("extra_data")
    .eq("id", appointmentId)
    .maybeSingle();
  if (readErr) return { claimed: false, error: readErr.message };
  const extra =
    row?.extra_data && typeof row.extra_data === "object"
      ? (row.extra_data as Record<string, unknown>)
      : {};
  if (typeof extra[flagKey] === "string") return { claimed: false };

  const { data, error } = await supabase
    .from("appointments")
    .update({
      extra_data: {
        ...extra,
        [flagKey]: claimedAt,
      },
    })
    .eq("id", appointmentId)
    .filter(`extra_data->>${flagKey}`, "is", null)
    .select("id")
    .maybeSingle();

  if (error) return { claimed: false, error: error.message };
  return { claimed: Boolean(data?.id) };
}

export async function clearAppointmentExtraFlag(
  appointmentId: string,
  _currentExtra: Record<string, unknown>,
  flagKey: string
): Promise<void> {
  const rpc = await supabase.rpc("clear_appointment_extra_flag", {
    p_appointment_id: appointmentId,
    p_flag: flagKey,
  });
  if (!rpc.error) return;

  const { data: row } = await supabase
    .from("appointments")
    .select("extra_data")
    .eq("id", appointmentId)
    .maybeSingle();
  const extra =
    row?.extra_data && typeof row.extra_data === "object"
      ? { ...(row.extra_data as Record<string, unknown>) }
      : {};
  delete extra[flagKey];
  await supabase.from("appointments").update({ extra_data: extra }).eq("id", appointmentId);
}
