import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { sendInfoSms } from "@/lib/sms";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { isInfoSmsEnabled } from "@/lib/sms";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      tenant_id?: string;
      message_text?: string;
      channel?: "whatsapp" | "sms" | "both";
      recipient_phones?: string[];
      filter_tags?: string[];
    };

    const tenantId = body.tenant_id?.trim();
    const messageText = (body.message_text || "").trim();
    const channel = body.channel || "whatsapp";
    const recipientPhones = Array.isArray(body.recipient_phones)
      ? body.recipient_phones.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];
    const filterTags = Array.isArray(body.filter_tags) ? body.filter_tags : [];

    if (!tenantId || !messageText) {
      return NextResponse.json(
        { error: "İşletme ID ve mesaj metni zorunludur" },
        { status: 400 }
      );
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
    }

    let phones: string[] = [];

    if (recipientPhones.length > 0) {
      phones = [...new Set(recipientPhones.map((p) => p.replace(/\D/g, "").replace(/^0/, "90")))].map(
        (d) => (d.startsWith("9") ? `+${d}` : `+9${d}`)
      );
    } else {
      // crm_customers + appointments'dan al
      const { data: crmList } = await supabase
        .from("crm_customers")
        .select("customer_phone, tags")
        .eq("tenant_id", tenantId);

      let fromCrm = (crmList || []).map((r) => r.customer_phone);
      if (filterTags.length > 0) {
        fromCrm = (crmList || []).filter((r) =>
          (r.tags || []).some((t: string) => filterTags.includes(t))
        ).map((r) => r.customer_phone);
      }

      const { data: aptPhones } = await supabase
        .from("appointments")
        .select("customer_phone")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled");

      const aptSet = new Set((aptPhones || []).map((a) => a.customer_phone));
      const combined = new Set([...fromCrm, ...aptSet]);
      phones = Array.from(combined).map((p) => {
        const d = p.replace(/\D/g, "");
        return d.startsWith("9") ? `+${d}` : `+9${d}`;
      });
    }

    if (phones.length === 0) {
      return NextResponse.json(
        { error: "Gönderilecek alıcı bulunamadı. CRM müşterileri veya randevu geçmişi kontrol edin." },
        { status: 400 }
      );
    }

    let successCount = 0;
    for (const to of phones) {
      try {
        if (channel === "sms" && isInfoSmsEnabled()) {
          const ok = await sendInfoSms(to, messageText);
          if (ok) successCount++;
        } else if (channel === "whatsapp") {
          const ok = await sendWhatsAppMessage({ to, text: messageText });
          if (ok) successCount++;
        } else {
          const res = await sendCustomerNotification(to, messageText);
          if (res.whatsapp || res.sms) successCount++;
        }
      } catch {
        // devam et
      }
    }

    await supabase.from("campaign_messages").insert({
      tenant_id: tenantId,
      message_text: messageText,
      channel,
      recipient_count: phones.length,
      success_count: successCount,
      filter_tags: filterTags.length > 0 ? filterTags : null,
    });

    return NextResponse.json({
      success: true,
      recipient_count: phones.length,
      success_count: successCount,
      message: `${successCount}/${phones.length} alıcıya gönderildi`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kampanya gönderilemedi";
    console.error("[campaigns/send]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
