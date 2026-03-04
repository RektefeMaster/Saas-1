import { NextRequest, NextResponse } from "next/server";
import { isAdminTakeoverReason } from "@/lib/human-takeover";
import { listPausedSessions } from "@/lib/redis";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { normalizePhoneDigits } from "@/lib/phone";
import { supabase } from "@/lib/supabase";

type ConversationMessageRow = {
  tenant_id: string | null;
  customer_phone_digits: string;
  direction: "inbound" | "outbound" | "system";
  message_text: string | null;
  stage: string | null;
  created_at: string;
};

type RiskSummary = {
  tenant_id: string;
  customer_phone_digits: string;
  last_message_at: string;
  last_inbound_text: string | null;
  last_outbound_text: string | null;
  inbound_count: number;
  outbound_count: number;
  system_count: number;
  message_count: number;
  stage_counts: Record<string, number>;
  risk_reasons: string[];
  risk_score: number;
  paused_for_human: boolean;
  admin_takeover_active: boolean;
  pause_reason: string | null;
  current_step: string | null;
  risk_threshold: number;
  threshold_source: "default" | "tenant";
  effective_threshold: number;
};

type TenantRiskConfig = {
  min_score: number;
  high_stage_weight: number;
  high_stage_cap: number;
  medium_stage_weight: number;
  medium_stage_cap: number;
  paused_weight: number;
  admin_takeover_weight: number;
  inbound_without_outbound_weight: number;
  long_conversation_weight: number;
};

type TenantLookup = {
  id: string;
  name: string;
  tenant_code: string | null;
  risk_config: TenantRiskConfig;
  threshold_source: "default" | "tenant";
};

const HIGH_RISK_STAGES = new Set([
  "message_reply_failed",
  "template_recovery_failed",
  "tenant_not_found",
  "rate_limited",
  "global_kill_switch_blocked",
]);

const MEDIUM_RISK_STAGES = new Set([
  "audio_transcribe_failed",
  "audio_media_download_failed",
  "audio_missing_media_id",
  "unsupported_message_reply",
  "normalized_text_empty",
  "template_recovery_sent",
]);

const DEFAULT_RISK_CONFIG: Omit<TenantRiskConfig, "min_score"> = {
  high_stage_weight: 15,
  high_stage_cap: 60,
  medium_stage_weight: 8,
  medium_stage_cap: 24,
  paused_weight: 35,
  admin_takeover_weight: 100,
  inbound_without_outbound_weight: 20,
  long_conversation_weight: 10,
};

function parseIntParam(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function toMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseClampedNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function resolveTenantRiskConfig(
  configOverride: unknown,
  defaultMinScore: number
): { config: TenantRiskConfig; thresholdSource: "default" | "tenant" } {
  const base = toRecord(configOverride);
  const raw = base ? toRecord(base.ops_risk_config) : null;
  if (!raw) {
    return {
      config: {
        min_score: defaultMinScore,
        ...DEFAULT_RISK_CONFIG,
      },
      thresholdSource: "default",
    };
  }

  return {
    config: {
      min_score: parseClampedNumber(raw.min_score, defaultMinScore, 0, 500),
      high_stage_weight: parseClampedNumber(raw.high_stage_weight, DEFAULT_RISK_CONFIG.high_stage_weight, 1, 80),
      high_stage_cap: parseClampedNumber(raw.high_stage_cap, DEFAULT_RISK_CONFIG.high_stage_cap, 1, 200),
      medium_stage_weight: parseClampedNumber(
        raw.medium_stage_weight,
        DEFAULT_RISK_CONFIG.medium_stage_weight,
        1,
        60
      ),
      medium_stage_cap: parseClampedNumber(raw.medium_stage_cap, DEFAULT_RISK_CONFIG.medium_stage_cap, 1, 120),
      paused_weight: parseClampedNumber(raw.paused_weight, DEFAULT_RISK_CONFIG.paused_weight, 0, 120),
      admin_takeover_weight: parseClampedNumber(
        raw.admin_takeover_weight,
        DEFAULT_RISK_CONFIG.admin_takeover_weight,
        0,
        200
      ),
      inbound_without_outbound_weight: parseClampedNumber(
        raw.inbound_without_outbound_weight,
        DEFAULT_RISK_CONFIG.inbound_without_outbound_weight,
        0,
        120
      ),
      long_conversation_weight: parseClampedNumber(
        raw.long_conversation_weight,
        DEFAULT_RISK_CONFIG.long_conversation_weight,
        0,
        120
      ),
    },
    thresholdSource: "tenant",
  };
}

function ensureSummary(
  map: Map<string, RiskSummary>,
  tenantId: string,
  phoneDigits: string,
  fallbackTime: string
): RiskSummary {
  const key = `${tenantId}:${phoneDigits}`;
  const existing = map.get(key);
  if (existing) return existing;

  const created: RiskSummary = {
    tenant_id: tenantId,
    customer_phone_digits: phoneDigits,
    last_message_at: fallbackTime,
    last_inbound_text: null,
    last_outbound_text: null,
    inbound_count: 0,
    outbound_count: 0,
    system_count: 0,
    message_count: 0,
    stage_counts: {},
    risk_reasons: [],
    risk_score: 0,
    paused_for_human: false,
    admin_takeover_active: false,
    pause_reason: null,
    current_step: null,
    risk_threshold: 0,
    threshold_source: "default",
    effective_threshold: 0,
  };
  map.set(key, created);
  return created;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const hours = parseIntParam(params.get("hours"), 48, 1, 24 * 14);
  const limit = parseIntParam(params.get("limit"), 60, 1, 200);
  const minScore = parseIntParam(params.get("min_score"), 20, 0, 500);
  const tenantId = (params.get("tenant_id") || "").trim();
  const phoneDigits = normalizePhoneDigits(params.get("phone"));
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const maxRows = Math.min(Math.max(limit * 40, 600), 6000);
  let query = supabase
    .from("conversation_messages")
    .select("tenant_id, customer_phone_digits, direction, message_text, stage, created_at")
    .gte("created_at", from.toISOString())
    .order("created_at", { ascending: false })
    .limit(maxRows);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  if (phoneDigits) {
    query = query.eq("customer_phone_digits", phoneDigits);
  }

  const { data, error } = await query;
  if (error) {
    const missing = extractMissingSchemaTable(error);
    if (missing === "conversation_messages") {
      return NextResponse.json({
        query: {
          hours,
          min_score_filter: minScore,
          limit,
          tenant_id: tenantId || null,
          phone_digits: phoneDigits,
          from: from.toISOString(),
          to: now.toISOString(),
        },
        total: 0,
        items: [],
        migration_hint: true,
        migration_message:
          "conversation_messages tablosu bulunamadı. Supabase migration 029 çalıştırılmalı: supabase db push veya supabase migration up",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as ConversationMessageRow[];
  const summaries = new Map<string, RiskSummary>();

  for (const row of rows) {
    if (!row.tenant_id) continue;
    if (!row.customer_phone_digits) continue;

    const summary = ensureSummary(
      summaries,
      row.tenant_id,
      row.customer_phone_digits,
      row.created_at
    );

    summary.message_count += 1;
    if (toMs(row.created_at) > toMs(summary.last_message_at)) {
      summary.last_message_at = row.created_at;
    }

    if (row.direction === "inbound") {
      summary.inbound_count += 1;
      if (!summary.last_inbound_text && row.message_text) {
        summary.last_inbound_text = row.message_text;
      }
    } else if (row.direction === "outbound") {
      summary.outbound_count += 1;
      if (!summary.last_outbound_text && row.message_text) {
        summary.last_outbound_text = row.message_text;
      }
    } else {
      summary.system_count += 1;
    }

    const stage = (row.stage || "").trim();
    if (stage) {
      summary.stage_counts[stage] = (summary.stage_counts[stage] || 0) + 1;
    }
  }

  const paused = await listPausedSessions({
    tenantId: tenantId || undefined,
    limit: Math.min(Math.max(limit * 3, 80), 500),
  });

  for (const item of paused) {
    const phone = normalizePhoneDigits(item.customerPhone);
    if (!phone) continue;
    if (phoneDigits && phone !== phoneDigits) continue;

    const summary = ensureSummary(
      summaries,
      item.tenantId,
      phone,
      item.state.updated_at || now.toISOString()
    );
    summary.paused_for_human = true;
    summary.pause_reason = item.state.pause_reason || null;
    summary.current_step = item.state.step || null;
    if (isAdminTakeoverReason(item.state.pause_reason)) {
      summary.admin_takeover_active = true;
    }
  }

  const list = Array.from(summaries.values());
  const allTenantIds = Array.from(new Set(list.map((item) => item.tenant_id))).filter(Boolean);
  const tenantMap = new Map<string, TenantLookup>();

  if (allTenantIds.length > 0) {
    const { data: tenantRows } = await supabase
      .from("tenants")
      .select("id, name, tenant_code, config_override")
      .in("id", allTenantIds);

    for (const row of (tenantRows || []) as Array<{
      id: string;
      name: string;
      tenant_code: string | null;
      config_override?: unknown;
    }>) {
      const resolved = resolveTenantRiskConfig(row.config_override, minScore);
      tenantMap.set(row.id, {
        id: row.id,
        name: row.name,
        tenant_code: row.tenant_code || null,
        risk_config: resolved.config,
        threshold_source: resolved.thresholdSource,
      });
    }
  }

  for (const item of list) {
    const tenantRisk =
      tenantMap.get(item.tenant_id)?.risk_config ||
      ({ min_score: minScore, ...DEFAULT_RISK_CONFIG } as TenantRiskConfig);
    let score = 0;
    const reasons: string[] = [];

    if (item.admin_takeover_active) {
      score += tenantRisk.admin_takeover_weight;
      reasons.push("admin_takeover_active");
    } else if (item.paused_for_human) {
      score += tenantRisk.paused_weight;
      reasons.push("paused_for_human");
    }

    let highHits = 0;
    let mediumHits = 0;
    for (const [stage, count] of Object.entries(item.stage_counts)) {
      if (HIGH_RISK_STAGES.has(stage)) highHits += count;
      if (MEDIUM_RISK_STAGES.has(stage)) mediumHits += count;
    }

    if (highHits > 0) {
      score += Math.min(tenantRisk.high_stage_cap, highHits * tenantRisk.high_stage_weight);
      reasons.push("high_risk_stage");
    }
    if (mediumHits > 0) {
      score += Math.min(tenantRisk.medium_stage_cap, mediumHits * tenantRisk.medium_stage_weight);
      reasons.push("medium_risk_stage");
    }
    if (item.inbound_count >= 3 && item.outbound_count === 0) {
      score += tenantRisk.inbound_without_outbound_weight;
      reasons.push("inbound_without_outbound");
    }
    if (item.message_count >= 12) {
      score += tenantRisk.long_conversation_weight;
      reasons.push("long_conversation");
    }

    item.risk_score = score;
    item.risk_reasons = reasons;
    item.risk_threshold = tenantRisk.min_score;
    item.threshold_source = tenantMap.get(item.tenant_id)?.threshold_source || "default";
    item.effective_threshold = Math.max(minScore, item.risk_threshold);
  }

  const risky = list
    .filter((item) => item.risk_score >= item.effective_threshold)
    .sort((a, b) => {
      if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
      return toMs(b.last_message_at) - toMs(a.last_message_at);
    })
    .slice(0, limit);

  return NextResponse.json({
    query: {
      from: from.toISOString(),
      to: now.toISOString(),
      hours,
      tenant_id: tenantId || null,
      phone_digits: phoneDigits || null,
      min_score_filter: minScore,
      limit,
    },
    total: risky.length,
    items: risky.map((item) => ({
      ...item,
      tenant_name: tenantMap.get(item.tenant_id)?.name || null,
      tenant_code: tenantMap.get(item.tenant_id)?.tenant_code || null,
      tenant_risk_config: tenantMap.get(item.tenant_id)?.risk_config || null,
      recommended_action: item.admin_takeover_active ? "send_or_resume" : "takeover",
    })),
  });
}
