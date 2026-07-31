/**
 * Değerlendirme hatırlatma cron
 * Randevu saati geçtikten config'deki saat sonra (varsayılan 2) müşteriye değerlendirme mesajı gönderir.
 * Sadece review_request_enabled=true olan tenant'lar için çalışır (varsayılan kapalı).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppInteractiveList } from "@/lib/whatsapp";
import { sendCustomerNotification } from "@/lib/notify";
import { hasCustomerRatedService } from "@/services/review.service";
import {
  REVIEW_FALLBACK_TEXT,
  REVIEW_LIST_BODY,
  REVIEW_LIST_SECTIONS,
} from "@/lib/review-reminder";
import {
  assertCronAuthorized,
  claimAppointmentExtraFlag,
  clearAppointmentExtraFlag,
} from "@/lib/cron-auth";

const DEFAULT_DELAY_HOURS = 2;
const MAX_DELAY_HOURS = 48;
const LOOKBACK_BUFFER_HOURS = 6;
const SEND_CONCURRENCY = 5;

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const now = new Date();

  const { data: reviewTenants } = await supabase
    .from("tenants")
    .select("id, config_override")
    .is("deleted_at", null);

  let maxDelayHours = DEFAULT_DELAY_HOURS;
  const tenantConfig = new Map<
    string,
    { review_request_enabled: boolean; review_request_delay_hours: number }
  >();
  const enabledTenantIds: string[] = [];
  for (const t of reviewTenants || []) {
    const cfg = (t.config_override as Record<string, unknown>) || {};
    const enabled = cfg.review_request_enabled === true;
    const rawDelay =
      typeof cfg.review_request_delay_hours === "number" && cfg.review_request_delay_hours >= 0
        ? cfg.review_request_delay_hours
        : DEFAULT_DELAY_HOURS;
    const delayHours = Math.min(MAX_DELAY_HOURS, rawDelay);
    tenantConfig.set(t.id, {
      review_request_enabled: enabled,
      review_request_delay_hours: delayHours,
    });
    if (enabled) {
      enabledTenantIds.push(t.id);
      if (delayHours > maxDelayHours) maxDelayHours = delayHours;
    }
  }

  if (enabledTenantIds.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      sent: 0,
      skipped: 0,
      disabled: 0,
      alreadyReviewed: 0,
      alreadyRatedService: 0,
      lookbackHours: 0,
    });
  }

  const lookbackHours = Math.max(24, maxDelayHours + LOOKBACK_BUFFER_HOURS);
  const lookbackStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start, service_slug, extra_data")
    .in("tenant_id", enabledTenantIds)
    .lt("slot_start", now.toISOString())
    .gte("slot_start", lookbackStart.toISOString())
    .in("status", ["completed", "confirmed"])
    .order("slot_start", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligible = (appointments ?? []).filter((apt) => {
    const cfg = tenantConfig.get(apt.tenant_id);
    if (!cfg?.review_request_enabled) return false;
    const delayHours = cfg.review_request_delay_hours ?? DEFAULT_DELAY_HOURS;
    const cutoff = new Date(now.getTime() - delayHours * 60 * 60 * 1000);
    if (new Date(apt.slot_start) > cutoff) return false;
    const extra =
      apt.extra_data && typeof apt.extra_data === "object"
        ? (apt.extra_data as Record<string, unknown>)
        : {};
    if (
      typeof extra.review_reminder_sent_at === "string" ||
      typeof extra.review_closed_at === "string"
    ) {
      return false;
    }
    return true;
  });

  const aptIds = eligible.map((a) => a.id);
  const reviewedSet = new Set<string>();
  if (aptIds.length > 0) {
    const { data: existingReviews } = await supabase
      .from("reviews")
      .select("appointment_id")
      .in("appointment_id", aptIds);
    for (const row of existingReviews || []) {
      if (row.appointment_id) reviewedSet.add(String(row.appointment_id));
    }
  }

  let sent = 0;
  let skipped = (appointments?.length ?? 0) - eligible.length;
  let alreadyReviewed = 0;
  let alreadyRatedService = 0;
  let disabled = (appointments ?? []).filter(
    (a) => !tenantConfig.get(a.tenant_id)?.review_request_enabled
  ).length;

  const pending: typeof eligible = [];
  for (const apt of eligible) {
    if (reviewedSet.has(apt.id)) {
      alreadyReviewed++;
      continue;
    }
    pending.push(apt);
  }

  // Remaining rated-service checks are fewer after batch review filter.
  const toSend: typeof pending = [];
  for (const apt of pending) {
    if (
      typeof apt.service_slug === "string" &&
      apt.service_slug.trim() &&
      (await hasCustomerRatedService(
        apt.tenant_id,
        apt.customer_phone,
        apt.service_slug,
        apt.id
      ))
    ) {
      alreadyRatedService++;
      continue;
    }
    toSend.push(apt);
  }

  for (let i = 0; i < toSend.length; i += SEND_CONCURRENCY) {
    const chunk = toSend.slice(i, i + SEND_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (apt) => {
        const extra =
          apt.extra_data && typeof apt.extra_data === "object"
            ? (apt.extra_data as Record<string, unknown>)
            : {};
        const claim = await claimAppointmentExtraFlag(
          apt.id,
          extra,
          "review_reminder_sent_at"
        );
        if (!claim.claimed) {
          skipped++;
          return false;
        }

        const result = await sendWhatsAppInteractiveList({
          to: apt.customer_phone,
          bodyText: REVIEW_LIST_BODY,
          buttonLabel: "Puan ver",
          sections: REVIEW_LIST_SECTIONS,
        });
        let ok = result.ok;
        if (!ok) {
          const fallback = await sendCustomerNotification(
            apt.customer_phone,
            REVIEW_FALLBACK_TEXT
          );
          if (fallback.whatsapp || fallback.sms) ok = true;
        }
        if (ok) {
          await supabase
            .from("appointments")
            .update({ status: "completed" })
            .eq("id", apt.id)
            .eq("tenant_id", apt.tenant_id)
            .in("status", ["confirmed", "completed"]);
          return true;
        }
        await clearAppointmentExtraFlag(apt.id, extra, "review_reminder_sent_at");
        return false;
      })
    );
    sent += results.filter(Boolean).length;
  }

  return NextResponse.json({
    ok: true,
    total: appointments?.length ?? 0,
    sent,
    skipped,
    disabled,
    alreadyReviewed,
    alreadyRatedService,
    lookbackHours,
  });
}
