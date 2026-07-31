import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { supabase } from "@/lib/supabase";
import { APP_TIMEZONE } from "@/lib/dayjs-utils";
import { sendCustomerNotification } from "@/lib/notify";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import { getDailyAvailability } from "@/services/booking.service";
import { notifyWaitlist } from "@/services/waitlist.service";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { date, reason } = body as { date?: string; reason?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date gerekli (YYYY-MM-DD)" }, { status: 400 });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, timezone")
      .eq("id", tenantId)
      .single();

    const tz = (tenant?.timezone as string)?.trim() || APP_TIMEZONE;
    const dayStartIso = dayjs.tz(`${date}T00:00:00`, tz).toISOString();
    const dayEndIso = dayjs.tz(`${date}T00:00:00`, tz).add(1, "day").toISOString();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, customer_phone, slot_start")
      .eq("tenant_id", tenantId)
      .gte("slot_start", dayStartIso)
      .lt("slot_start", dayEndIso)
      .in("status", ["confirmed", "pending"]);

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ ok: true, cancelled: 0, message: "O gün randevu yok." });
    }

    const ids = appointments.map((a) => a.id);
    const { data: updatedRows, error: updateErr } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "tenant",
        cancellation_reason: reason || "İşletme tarafından iptal",
      })
      .in("id", ids)
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "pending"])
      .select("id");

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const cancelledIds = new Set((updatedRows || []).map((r) => r.id));
    const cancelledAppointments = appointments.filter((a) => cancelledIds.has(a.id));

    const tenantName = tenant?.name || "İşletme";
    const reasonText = reason ? ` Sebep: ${reason}` : "";

    const results = await Promise.all(
      cancelledAppointments.map(async (apt) => {
        const timeStr = dayjs(apt.slot_start).tz(tz).format("HH:mm");
        const delivery = await sendCustomerNotification(
          apt.customer_phone,
          `Merhaba, ${tenantName} ${date} tarihindeki saat ${timeStr} randevunuzu maalesef iptal etmek zorunda kaldı.${reasonText} En kısa sürede yeni randevu almak için bize yazabilirsiniz.`
        );
        return delivery.whatsapp || delivery.sms ? 1 : 0;
      })
    );
    const sent = results.reduce<number>((a, b) => a + b, 0);

    void getDailyAvailability(tenantId, date)
      .then((daily) =>
        notifyWaitlist(tenantId, date, daily.available, tenantName)
      )
      .catch((e) => console.error("[bulk-cancel] waitlist notify error:", e));

    return NextResponse.json({
      ok: true,
      cancelled: cancelledAppointments.length,
      notified: sent,
    });
  } catch (err) {
    console.error("[bulk-cancel]", err);
    return NextResponse.json({ error: "İptal başarısız" }, { status: 500 });
  }
}
