/**
 * Değerlendirme hatırlatma cron
 * Randevu saati geçtikten config'deki saat sonra (varsayılan 2) müşteriye değerlendirme mesajı gönderir.
 * Sadece review_request_enabled=true olan tenant'lar için çalışır (varsayılan kapalı).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppInteractiveList } from "@/lib/whatsapp";
import { sendCustomerNotification } from "@/lib/notify";
import { hasCustomerRatedService, hasReview } from "@/services/review.service";
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

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const now = new Date();

  // Expand lookback from enabled tenant delays so delay>24h is not silently skipped.
  const { data: reviewTenants } = await supabase
    .from("tenants")
    .select("id, config_override")
    .is("deleted_at", null);

  let maxDelayHours = DEFAULT_DELAY_HOURS;
  const tenantConfig = new Map<
    string,
    { review_request_enabled: boolean; review_request_delay_hours: number }
  >();
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
    if (enabled && delayHours > maxDelayHours) maxDelayHours = delayHours;
  }

  const lookbackHours = Math.max(24, maxDelayHours + LOOKBACK_BUFFER_HOURS);
  const lookbackStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start, service_slug, extra_data")
    .lt("slot_start", now.toISOString())
    .gte("slot_start", lookbackStart.toISOString())
    .in("status", ["completed", "confirmed"])
    .order("slot_start", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let alreadyReviewed = 0;
  let alreadyRatedService = 0;
  let disabled = 0;
  for (const apt of appointments ?? []) {
    const cfg = tenantConfig.get(apt.tenant_id);
    if (!cfg?.review_request_enabled) {
      disabled++;
      continue;
    }

    const delayHours = cfg.review_request_delay_hours ?? DEFAULT_DELAY_HOURS;
    const cutoff = new Date(now.getTime() - delayHours * 60 * 60 * 1000);
    if (new Date(apt.slot_start) > cutoff) continue;
    const extra =
      apt.extra_data && typeof apt.extra_data === "object"
        ? (apt.extra_data as Record<string, unknown>)
        : {};
    if (
      typeof extra.review_reminder_sent_at === "string" ||
      typeof extra.review_closed_at === "string"
    ) {
      skipped++;
      continue;
    }

    const hasR = await hasReview(apt.id);
    if (hasR) {
      alreadyReviewed++;
      continue;
    }
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

    const claim = await claimAppointmentExtraFlag(apt.id, extra, "review_reminder_sent_at");
    if (!claim.claimed) {
      skipped++;
      continue;
    }

    const result = await sendWhatsAppInteractiveList({
      to: apt.customer_phone,
      bodyText: REVIEW_LIST_BODY,
      buttonLabel: "Puan ver",
      sections: REVIEW_LIST_SECTIONS,
    });
    let ok = result.ok;
    if (!ok) {
      const fallback = await sendCustomerNotification(apt.customer_phone, REVIEW_FALLBACK_TEXT);
      if (fallback.whatsapp || fallback.sms) ok = true;
    }
    if (ok) {
      sent++;
      // Flag already claimed; still mark visit completed so no-show cron won't reclaim it.
      await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", apt.id)
        .eq("tenant_id", apt.tenant_id)
        .in("status", ["confirmed", "completed"]);
    } else {
      await clearAppointmentExtraFlag(apt.id, extra, "review_reminder_sent_at");
    }
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
