import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { sendWhatsAppMessageDetailed } from "@/lib/whatsapp";
import {
  listLeadFollowUpCandidates,
  buildLeadFollowUpMessage,
  queueLeadFollowUpReminders,
  markLeadFollowedUp,
  isAutoSendEnabled,
} from "@/services/leadFollowUp.service";

export const dynamic = "force-dynamic";

const MAX_TENANTS = 100;
const MAX_SENDS_PER_TENANT = 20;

/**
 * Randevuya dönüşmeyen leadleri takip eder.
 *
 * Varsayılan: adayları panele hatırlatma olarak düşürür (insan karar verir).
 * `config_override.lead_followup_auto_send === true` olan tenant'larda WhatsApp
 * mesajını otomatik gönderir. Opt-out edenler her koşulda elenir.
 */
export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, config_override")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(MAX_TENANTS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let queued = 0;
  let sent = 0;
  let scanned = 0;
  const failures: string[] = [];

  for (const tenant of tenants || []) {
    let candidates;
    try {
      candidates = await listLeadFollowUpCandidates(tenant.id);
    } catch (err) {
      failures.push(`${tenant.id}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (candidates.length === 0) continue;
    scanned += candidates.length;

    const queuedNow = await queueLeadFollowUpReminders(tenant.id, candidates);
    queued += queuedNow;

    const configOverride = (tenant.config_override as Record<string, unknown> | null) || {};
    if (!isAutoSendEnabled(configOverride)) {
      // Otomatik gönderim kapalı olsa bile işaretle: aksi halde aynı lead için
      // panele HER GÜN yeni bir hatırlatma düşer ve liste çöpe döner.
      if (queuedNow > 0) {
        for (const candidate of candidates) {
          await markLeadFollowedUp(tenant.id, candidate.customer_phone);
        }
      }
      continue;
    }

    for (const candidate of candidates.slice(0, MAX_SENDS_PER_TENANT)) {
      const text = buildLeadFollowUpMessage(tenant.name || "İşletmemiz", candidate);
      const result = await sendWhatsAppMessageDetailed({
        to: candidate.customer_phone,
        text,
        tenantId: tenant.id,
      });
      // 24 saatlik pencere kapalıysa serbest metin gitmez; sessizce geç.
      if (result.ok) {
        sent += 1;
        await markLeadFollowedUp(tenant.id, candidate.customer_phone);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    tenants: (tenants || []).length,
    candidates: scanned,
    queued_reminders: queued,
    auto_sent: sent,
    ...(failures.length > 0 ? { failures } : {}),
  });
}
