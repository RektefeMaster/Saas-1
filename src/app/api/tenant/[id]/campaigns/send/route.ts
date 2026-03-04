import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractMissingSchemaColumn } from "@/lib/postgrest-schema";
import { sendCustomerNotification } from "@/lib/notify";
import { sendInfoSms, isInfoSmsEnabled } from "@/lib/sms";
import {
  sendWhatsAppMessageDetailed,
  sendWhatsAppTemplateMessage,
  resolveWhatsAppCredentials,
} from "@/lib/whatsapp";

const CAMPAIGN_TEMPLATE = (process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME || "").trim();
const TEMPLATE_LANG = (process.env.WHATSAPP_TEMPLATE_LANG || "tr").trim();

function normalizePhone(phone: string): string | null {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  else if (!digits.startsWith("90")) digits = `90${digits}`;
  if (digits.length !== 12) return null;
  return `+${digits}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      message_text?: string;
      channel?: "whatsapp" | "sms" | "both";
      recipient_phones?: string[];
      filter_tags?: string[];
    };

    const messageText = (body.message_text || "").trim();
    const channel = body.channel || "whatsapp";
    const recipientPhones = Array.isArray(body.recipient_phones)
      ? body.recipient_phones.filter((phone): phone is string => typeof phone === "string" && phone.trim().length > 0)
      : [];
    const filterTags = Array.isArray(body.filter_tags) ? body.filter_tags : [];

    if (!messageText) {
      return NextResponse.json({ error: "Mesaj metni zorunludur" }, { status: 400 });
    }

    let tenant: { id: string; campaign_enabled?: boolean } | null = null;
    const tenantRes = await supabase
      .from("tenants")
      .select("id, campaign_enabled")
      .eq("id", tenantId)
      .is("deleted_at", null)
      .single();

    if (tenantRes.error) {
      const missing = extractMissingSchemaColumn(tenantRes.error);
      if (missing?.table === "tenants" && missing.column === "campaign_enabled") {
        const fallback = await supabase
          .from("tenants")
          .select("id")
          .eq("id", tenantId)
          .is("deleted_at", null)
          .single();
        if (!fallback.error && fallback.data) tenant = fallback.data as { id: string };
      }
    } else {
      tenant = tenantRes.data as { id: string; campaign_enabled?: boolean };
    }

    if (!tenant) {
      return NextResponse.json({ error: "İşletme bulunamadı" }, { status: 404 });
    }

    if (tenant.campaign_enabled === false) {
      return NextResponse.json(
        { error: "Kampanya göndermek için bizimle iletişime geçin." },
        { status: 403 }
      );
    }

    if (channel === "sms" && !isInfoSmsEnabled()) {
      return NextResponse.json(
        { error: "SMS gönderimi kapalı. ENABLE_INFO_SMS=true ile açabilirsiniz." },
        { status: 400 }
      );
    }

    let phones: string[] = [];
    if (recipientPhones.length > 0) {
      const normalized = recipientPhones.map(normalizePhone).filter((phone): phone is string => phone != null);
      phones = [...new Set(normalized)];
    } else {
      const { data: crmList } = await supabase
        .from("crm_customers")
        .select("customer_phone, tags")
        .eq("tenant_id", tenantId);

      let fromCrm = (crmList || []).map((row) => row.customer_phone);
      if (filterTags.length > 0) {
        fromCrm = (crmList || [])
          .filter((row) => (row.tags || []).some((tag: string) => filterTags.includes(tag)))
          .map((row) => row.customer_phone);
      }

      const { data: aptPhones } = await supabase
        .from("appointments")
        .select("customer_phone")
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled");

      const aptSet = new Set((aptPhones || []).map((row) => row.customer_phone));
      const merged = new Set([...fromCrm, ...aptSet]);
      phones = Array.from(merged)
        .map((phone) => normalizePhone(String(phone || "")))
        .filter((phone): phone is string => phone != null);
    }

    if (phones.length === 0) {
      return NextResponse.json(
        { error: "Gönderilecek alıcı bulunamadı. CRM veya randevu kayıtlarını kontrol edin." },
        { status: 400 }
      );
    }

    if (channel === "whatsapp" || channel === "both") {
      const creds = await resolveWhatsAppCredentials();
      if (!creds.phoneId || !creds.token) {
        return NextResponse.json(
          {
            error:
              "WhatsApp kimlik bilgileri eksik. WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN ayarlanmalı.",
          },
          { status: 400 }
        );
      }
    }

    let successCount = 0;
    let lastError: string | null = null;

    for (const to of phones) {
      try {
        if (channel === "sms") {
          const ok = await sendInfoSms(to, messageText);
          if (ok) successCount++;
          else lastError = "SMS gönderilemedi";
          continue;
        }

        if (channel === "whatsapp") {
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
            else lastError = res.errorMessage || `HTTP ${res.status}`;
          }
          continue;
        }

        const delivery = await sendCustomerNotification(to, messageText);
        if (delivery.whatsapp || delivery.sms) successCount++;
        else lastError = "Bildirim gönderilemedi";
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Gönderim hatası";
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
    console.error("[tenant campaigns/send]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
