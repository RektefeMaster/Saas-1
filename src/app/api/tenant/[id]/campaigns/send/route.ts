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
import { normalizePhoneE164 } from "@/lib/phone";
import { requireTenantApiAccess } from "@/middleware/tenantApiAuth.middleware";
import {
  filterOptedOutPhones,
  appendOptOutFooter,
} from "@/services/marketingConsent.service";

const CAMPAIGN_TEMPLATE = (process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME || "").trim();
const TEMPLATE_LANG = (process.env.WHATSAPP_TEMPLATE_LANG || "tr").trim();
const CAMPAIGN_MAX_RECIPIENTS = 200;
const CAMPAIGN_SEND_CONCURRENCY = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const auth = await requireTenantApiAccess(request, tenantId);
    if (!auth.ok) return auth.response;
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
      const normalized = recipientPhones.map((p) => normalizePhoneE164(p)).filter((phone): phone is string => phone != null);
      phones = [...new Set(normalized)];
    } else {
      const { data: crmList } = await supabase
        .from("crm_customers")
        .select("customer_phone, tags")
        .eq("tenant_id", tenantId)
        .limit(CAMPAIGN_MAX_RECIPIENTS);

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
        .neq("status", "cancelled")
        .order("slot_start", { ascending: false })
        .limit(CAMPAIGN_MAX_RECIPIENTS);

      const aptSet = new Set((aptPhones || []).map((row) => row.customer_phone));
      const merged = new Set([...fromCrm, ...aptSet]);
      phones = Array.from(merged)
        .map((phone) => normalizePhoneE164(String(phone || "")))
        .filter((phone): phone is string => phone != null);
    }

    // "DUR" yazmış müşterilere kampanya gönderilmez (KVKK + WhatsApp politikası).
    // Randevu hatırlatmaları bu filtreden etkilenmez, onlar işlemsel mesajdır.
    let optOutBlocked = 0;
    try {
      const consent = await filterOptedOutPhones(tenantId, phones);
      optOutBlocked = consent.blocked.length;
      phones = consent.allowed;
    } catch (err) {
      // Kolon var ama kontrol edilemiyorsa gönderme: yanlışlıkla opt-out edene
      // mesaj atmaktansa kampanyayı durdurmak doğru taraftır.
      return NextResponse.json(
        {
          error:
            "Pazarlama izni kontrolü yapılamadı, kampanya gönderilmedi. Lütfen tekrar deneyin.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 503 }
      );
    }

    if (phones.length === 0) {
      return NextResponse.json(
        {
          error:
            optOutBlocked > 0
              ? "Tüm alıcılar kampanya mesajlarından çıkmış görünüyor."
              : "Gönderilecek alıcı bulunamadı. CRM veya randevu kayıtlarını kontrol edin.",
          opt_out_blocked: optOutBlocked,
        },
        { status: 400 }
      );
    }

    if (phones.length > CAMPAIGN_MAX_RECIPIENTS) {
      phones = phones.slice(0, CAMPAIGN_MAX_RECIPIENTS);
    }

    // Her kampanya mesajında çıkış talimatı bulunmalı.
    const campaignText = appendOptOutFooter(messageText);

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

    for (let i = 0; i < phones.length; i += CAMPAIGN_SEND_CONCURRENCY) {
      const chunk = phones.slice(i, i + CAMPAIGN_SEND_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (to) => {
          try {
            if (channel === "sms") {
              const ok = await sendInfoSms(to, campaignText);
              return ok ? ({ ok: true } as const) : ({ ok: false, error: "SMS gönderilemedi" } as const);
            }
            if (channel === "whatsapp") {
              if (CAMPAIGN_TEMPLATE) {
                const ok = await sendWhatsAppTemplateMessage({
                  to,
                  templateName: CAMPAIGN_TEMPLATE,
                  languageCode: TEMPLATE_LANG,
                  bodyParams: [campaignText],
                  tenantId,
                });
                return ok
                  ? ({ ok: true } as const)
                  : ({ ok: false, error: "Şablon mesajı gönderilemedi" } as const);
              }
              const res = await sendWhatsAppMessageDetailed({
                to,
                text: campaignText,
                tenantId,
              });
              return res.ok
                ? ({ ok: true } as const)
                : ({
                    ok: false,
                    error: res.errorMessage || `HTTP ${res.status}`,
                  } as const);
            }
            const delivery = await sendCustomerNotification(to, campaignText, tenantId);
            return delivery.whatsapp || delivery.sms
              ? ({ ok: true } as const)
              : ({ ok: false, error: "Bildirim gönderilemedi" } as const);
          } catch (err) {
            return {
              ok: false as const,
              error: err instanceof Error ? err.message : "Gönderim hatası",
            };
          }
        })
      );
      for (const r of chunkResults) {
        if (r.ok) successCount++;
        else lastError = r.error;
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
