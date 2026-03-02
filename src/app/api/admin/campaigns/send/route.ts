import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCustomerNotification } from "@/lib/notify";
import { sendInfoSms } from "@/lib/sms";
import {
  sendWhatsAppMessageDetailed,
  sendWhatsAppTemplateMessage,
  resolveWhatsAppCredentials,
} from "@/lib/whatsapp";
import { isInfoSmsEnabled } from "@/lib/sms";

const CAMPAIGN_TEMPLATE = (process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME || "").trim();
const TEMPLATE_LANG = (process.env.WHATSAPP_TEMPLATE_LANG || "tr").trim();

/** Türkiye E.164: +90 + 10 hane. Baştaki 0'ı 9 yap (0532→90532), 9 ile başlamıyorsa 90 ekle (532→90532). */
function normalizePhone(p: string): string | null {
  let d = (p || "").replace(/\D/g, "");
  if (!d || d.length < 10) return null;
  if (d.startsWith("0")) d = "90" + d.slice(1); // 05321234567 → 905321234567
  else if (!d.startsWith("90")) d = "90" + d;   // 5321234567 → 905321234567
  if (d.length !== 12) return null;              // 90 + 10 hane
  return `+${d}`;
}

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
      const normalized = recipientPhones.map(normalizePhone).filter((x): x is string => x != null);
      phones = [...new Set(normalized)];
    } else {
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
      const normalized = Array.from(combined)
        .map((p) => normalizePhone(String(p || "")))
        .filter((x): x is string => x != null);
      phones = [...new Set(normalized)];
    }

    if (phones.length === 0) {
      return NextResponse.json(
        { error: "Gönderilecek alıcı bulunamadı. CRM müşterileri veya randevu geçmişi kontrol edin." },
        { status: 400 }
      );
    }

    if (channel === "whatsapp" || channel === "both") {
      const creds = await resolveWhatsAppCredentials();
      if (!creds.phoneId || !creds.token) {
        return NextResponse.json(
          {
            error:
              "WhatsApp kimlik bilgileri eksik. .env içinde WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN tanımlayın veya yönetici panelinden runtime ayarlarını girin.",
          },
          { status: 400 }
        );
      }
    }

    let successCount = 0;
    let lastError: string | null = null;
    for (const to of phones) {
      try {
        if (channel === "sms" && isInfoSmsEnabled()) {
          const ok = await sendInfoSms(to, messageText);
          if (ok) successCount++;
          else lastError = "SMS gönderilemedi";
        } else if (channel === "whatsapp") {
          if (CAMPAIGN_TEMPLATE) {
            const ok = await sendWhatsAppTemplateMessage({
              to,
              templateName: CAMPAIGN_TEMPLATE,
              languageCode: TEMPLATE_LANG,
              bodyParams: [messageText],
            });
            if (ok) successCount++;
            else lastError = "Şablon mesajı gönderilemedi";
          } else {
            const res = await sendWhatsAppMessageDetailed({ to, text: messageText });
            if (res.ok) successCount++;
            else {
              lastError = res.errorMessage || `HTTP ${res.status}`;
              console.warn("[campaigns/send] WhatsApp failed for", to, lastError);
            }
          }
        } else {
          const res = await sendCustomerNotification(to, messageText);
          if (res.whatsapp || res.sms) successCount++;
          else {
            lastError = "Bildirim gönderilemedi";
            console.warn("[campaigns/send] notify failed for", to);
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Gönderim hatası";
        console.warn("[campaigns/send] send error for", to, err);
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
      ...(lastError && successCount === 0 ? { last_error: lastError } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kampanya gönderilemedi";
    console.error("[campaigns/send]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
