/**
 * Değerlendirme hatırlatma cron
 * Randevu saati geçtikten ~30 dakika sonra müşteriye değerlendirme mesajı gönderir.
 * WhatsApp interaktif liste önceliklidir; başarısız olursa düz mesaj fallback uygulanır.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppInteractiveList } from "@/lib/whatsapp";
import { sendCustomerNotification } from "@/lib/notify";
import { hasReview } from "@/services/review.service";

const REVIEW_LIST_BODY =
  "Merhaba! Bugünkü randevunuz nasıldı? Puanlamak ister misiniz? (Cevaplamak zorunda değilsiniz.)";
const REVIEW_LIST_SECTIONS = [
  {
    rows: [
      { id: "1", title: "1 ⭐" },
      { id: "2", title: "2 ⭐" },
      { id: "3", title: "3 ⭐" },
      { id: "4", title: "4 ⭐" },
      { id: "5", title: "5 ⭐" },
      { id: "gec", title: "Geç" },
    ],
  },
];

const CRON_SECRET = process.env.CRON_SECRET?.trim() || "";

export async function GET(request: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}` && request.nextUrl.searchParams.get("key") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, tenant_id, customer_phone, slot_start, extra_data")
    .lt("slot_start", thirtyMinutesAgo.toISOString())
    .gte("slot_start", last24h.toISOString())
    .in("status", ["completed", "confirmed"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let alreadyReviewed = 0;
  for (const apt of appointments ?? []) {
    const extra =
      apt.extra_data && typeof apt.extra_data === "object"
        ? (apt.extra_data as Record<string, unknown>)
        : {};
    if (typeof extra.review_reminder_sent_at === "string") {
      skipped++;
      continue;
    }

    const hasR = await hasReview(apt.id);
    if (hasR) {
      alreadyReviewed++;
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
      const fallback = await sendCustomerNotification(
        apt.customer_phone,
        "Merhaba! Bugünkü randevunuz nasıldı? 1-5 arası puan verir misiniz? ⭐"
      );
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
    alreadyReviewed,
  });
}
