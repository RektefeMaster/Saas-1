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

const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";
const DEFAULT_DELAY_HOURS = 2;

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}` && request.nextUrl.searchParams.get("key") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - DEFAULT_DELAY_HOURS * 60 * 60 * 1000);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start, service_slug, extra_data")
    .lt("slot_start", twoHoursAgo.toISOString())
    .gte("slot_start", last24h.toISOString())
    .in("status", ["completed", "confirmed"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tenantIds = [...new Set((appointments || []).map((a) => a.tenant_id))];
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, config_override")
    .in("id", tenantIds);

  const tenantConfig = new Map(
    (tenants || []).map((t) => {
      const cfg = (t.config_override as Record<string, unknown>) || {};
      return [
        t.id,
        {
          review_request_enabled: cfg.review_request_enabled === true,
          review_request_delay_hours:
            typeof cfg.review_request_delay_hours === "number" && cfg.review_request_delay_hours >= 0
              ? cfg.review_request_delay_hours
              : DEFAULT_DELAY_HOURS,
        },
      ];
    })
  );

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
      await supabase
        .from("appointments")
        .update({
          status: "completed",
          extra_data: {
            ...extra,
            review_reminder_sent_at: new Date().toISOString(),
          },
        })
        .eq("id", apt.id);
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
  });
}
