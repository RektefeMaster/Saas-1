import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = await request.json();
    const { date, reason } = body as { date?: string; reason?: string };

    if (!date) {
      return NextResponse.json({ error: "date gerekli" }, { status: 400 });
    }

    const [{ data: tenant }, { data: appointments }] = await Promise.all([
      supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single(),
      supabase
        .from("appointments")
        .select("id, customer_phone, slot_start")
        .eq("tenant_id", tenantId)
        .gte("slot_start", `${date}T00:00:00`)
        .lt("slot_start", `${date}T23:59:59`)
        .in("status", ["confirmed", "pending"]),
    ]);

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ ok: true, cancelled: 0, message: "O gün randevu yok." });
    }

    const ids = appointments.map((a) => a.id);
    await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "tenant",
        cancellation_reason: reason || "İşletme tarafından iptal",
      })
      .in("id", ids);

    const tenantName = tenant?.name || "İşletme";
    const reasonText = reason ? ` Sebep: ${reason}` : "";

    const results = await Promise.all(
      appointments.map(async (apt) => {
        const d = new Date(apt.slot_start);
        const timeStr = d.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        });
        const delivery = await sendCustomerNotification(
          apt.customer_phone,
          `Merhaba, ${tenantName} ${date} tarihindeki saat ${timeStr} randevunuzu maalesef iptal etmek zorunda kaldı.${reasonText} En kısa sürede yeni randevu almak için bize yazabilirsiniz.`
        );
        return delivery.whatsapp || delivery.sms ? 1 : 0;
      })
    );
    const sent = results.reduce<number>((a, b) => a + b, 0);

    return NextResponse.json({ ok: true, cancelled: ids.length, notified: sent });
  } catch (err) {
    console.error("[bulk-cancel]", err);
    return NextResponse.json({ error: "İptal başarısız" }, { status: 500 });
  }
}
