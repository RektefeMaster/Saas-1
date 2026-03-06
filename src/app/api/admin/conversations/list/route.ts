import { NextRequest, NextResponse } from "next/server";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { supabase } from "@/lib/supabase";
import { normalizePhoneDigits } from "@/lib/phone";
import { listPausedSessions } from "@/lib/redis";
import { isAdminTakeoverReason } from "@/lib/human-takeover";

type Row = {
  tenant_id: string | null;
  customer_phone_digits: string;
  direction: string;
  message_text: string | null;
  created_at: string;
};

type ConversationSummary = {
  tenant_id: string;
  customer_phone_digits: string;
  tenant_name: string | null;
  tenant_code: string | null;
  last_message_at: string;
  last_message_text: string | null;
  last_inbound_text: string | null;
  last_outbound_text: string | null;
  message_count: number;
  inbound_count: number;
  outbound_count: number;
  paused_for_human: boolean;
  admin_takeover_active: boolean;
  pause_reason: string | null;
};

function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const hours = parseIntParam(params.get("hours"), 24, 1, 168);
  const limit = parseIntParam(params.get("limit"), 100, 1, 300);
  const tenantId = (params.get("tenant_id") || "").trim();
  const phoneDigits = normalizePhoneDigits(params.get("phone") || "");

  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const maxRows = Math.min(limit * 2, 500);
  let query = supabase
    .from("conversation_messages")
    .select("tenant_id, customer_phone_digits, direction, message_text, created_at")
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false })
    .limit(maxRows);

  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (phoneDigits) query = query.eq("customer_phone_digits", phoneDigits);

  const [{ data, error }, paused] = await Promise.all([
    query,
    listPausedSessions({
      tenantId: tenantId || undefined,
      limit: 500,
    }),
  ]);

  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "conversation_messages") {
      return NextResponse.json({
        items: [],
        query: { hours, limit, tenant_id: tenantId || null, phone_digits: phoneDigits || null },
        migration_hint: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as Row[];
  const map = new Map<string, ConversationSummary>();

  for (const row of rows) {
    if (!row.tenant_id || !row.customer_phone_digits) continue;
    const key = `${row.tenant_id}:${row.customer_phone_digits}`;
    let s = map.get(key);
    if (!s) {
      s = {
        tenant_id: row.tenant_id,
        customer_phone_digits: row.customer_phone_digits,
        tenant_name: null,
        tenant_code: null,
        last_message_at: row.created_at,
        last_message_text: row.message_text,
        last_inbound_text: null,
        last_outbound_text: null,
        message_count: 0,
        inbound_count: 0,
        outbound_count: 0,
        paused_for_human: false,
        admin_takeover_active: false,
        pause_reason: null,
      };
      map.set(key, s);
    }
    s.message_count += 1;
    if (new Date(row.created_at) > new Date(s.last_message_at)) {
      s.last_message_at = row.created_at;
      s.last_message_text = row.message_text;
    }
    if (row.direction === "inbound") {
      s.inbound_count += 1;
      if (!s.last_inbound_text && row.message_text) s.last_inbound_text = row.message_text;
    } else if (row.direction === "outbound") {
      s.outbound_count += 1;
      if (!s.last_outbound_text && row.message_text) s.last_outbound_text = row.message_text;
    }
  }

  for (const item of paused) {
    const phone = normalizePhoneDigits(item.customerPhone);
    if (!phone) continue;
    if (phoneDigits && phone !== phoneDigits) continue;

    const key = `${item.tenantId}:${phone}`;
    let s = map.get(key);
    if (!s) {
      s = {
        tenant_id: item.tenantId,
        customer_phone_digits: phone,
        tenant_name: null,
        tenant_code: null,
        last_message_at: item.state.updated_at || now.toISOString(),
        last_message_text: null,
        last_inbound_text: null,
        last_outbound_text: null,
        message_count: 0,
        inbound_count: 0,
        outbound_count: 0,
        paused_for_human: true,
        admin_takeover_active: isAdminTakeoverReason(item.state.pause_reason),
        pause_reason: item.state.pause_reason || null,
      };
      map.set(key, s);
    } else {
      s.paused_for_human = true;
      s.admin_takeover_active = isAdminTakeoverReason(item.state.pause_reason);
      s.pause_reason = item.state.pause_reason || null;
    }
  }

  const list = Array.from(map.values()).sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  const tenantIds = [...new Set(list.map((i) => i.tenant_id))].filter(Boolean);
  const tenantMap = new Map<string, { name: string; tenant_code: string | null }>();

  if (tenantIds.length > 0) {
    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("id, name, tenant_code")
      .in("id", tenantIds);

    for (const r of (tenantRows || []) as Array<{ id: string; name: string; tenant_code: string | null }>) {
      tenantMap.set(r.id, { name: r.name, tenant_code: r.tenant_code || null });
    }
  }

  for (const item of list) {
    const t = tenantMap.get(item.tenant_id);
    if (t) {
      item.tenant_name = t.name;
      item.tenant_code = t.tenant_code;
    }
  }

  const items = list.slice(0, limit);

  return NextResponse.json({
    items,
    query: { hours, limit, tenant_id: tenantId || null, phone_digits: phoneDigits || null },
  });
}
