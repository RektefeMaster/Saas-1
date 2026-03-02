import { NextRequest, NextResponse } from "next/server";
import { processMessage } from "@/lib/ai";
import { downloadWhatsAppMedia, sendWhatsAppMessage } from "@/lib/whatsapp";
import { getTenantIdByPhone, setPhoneTenantMapping, setSession, getSession, deleteSession } from "@/lib/redis";
import { verifyWebhookSignatureBody, getWebhookSecret } from "@/middleware/webhookVerify.middleware";
import { enforceRateLimit } from "@/middleware/rateLimit.middleware";
import { supabase } from "@/lib/supabase";
import type { ConversationState } from "@/lib/database.types";
import { getAppBaseUrl } from "@/lib/app-url";
import { logTenantSwitch, resolveTenantRouting } from "@/lib/tenant-routing";
import { transcribeVoiceMessage } from "@/lib/stt";

// Vercel: OpenAI + Supabase + Redis zinciri 10s default timeout'u aşıyor.
// Hobby plan max 60s, Pro plan max 300s.
export const maxDuration = 60;

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "";

async function resolveDefaultTenant(): Promise<string | null> {
  if (DEFAULT_TENANT_ID) return DEFAULT_TENANT_ID;
  const { data } = await supabase
    .from("tenants")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(2);
  if (data && data.length === 1) return data[0].id;
  return null;
}

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";

export async function GET(request: NextRequest) {
  if (!VERIFY_TOKEN) {
    return new NextResponse("WHATSAPP_VERIFY_TOKEN missing", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const secret = getWebhookSecret();

  if (!secret) {
    console.error("[webhook] WHATSAPP_WEBHOOK_SECRET tanımlı değil, istek reddedildi");
    return new NextResponse("Webhook secret missing", { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignatureBody(Buffer.from(rawBody, "utf8"), signature, secret)) {
    console.warn("[webhook] Invalid signature, rejecting request");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          messages?: Array<{
            type?: string;
            from?: string;
            text?: { body?: string };
            audio?: { id?: string };
          }>;
        };
      }>;
    }>;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn("[webhook] Invalid JSON body");
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    console.log("[webhook] POST received, object:", body?.object);

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const messages = value?.messages || [];
        console.log("[webhook] messages count:", messages.length);

        for (const msg of messages) {
          const from = msg.from;
          if (!from) {
            continue;
          }

          let rawText = "";
          if (msg.type === "text") {
            rawText = (msg.text?.body || "").trim();
          } else if (msg.type === "audio") {
            const mediaId = msg.audio?.id;
            if (!mediaId) {
              await sendWhatsAppMessage({
                to: `+${from}`,
                text: "Sesli mesajı çözemedim. Lütfen tekrar deneyin veya metin yazın.",
              });
              continue;
            }
            const media = await downloadWhatsAppMedia(mediaId);
            if (!media) {
              await sendWhatsAppMessage({
                to: `+${from}`,
                text: "Ses dosyası alınamadı. Lütfen tekrar deneyin veya metin yazın.",
              });
              continue;
            }
            const transcript = await transcribeVoiceMessage(
              media.buffer,
              media.mimeType
            );
            if (!transcript) {
              await sendWhatsAppMessage({
                to: `+${from}`,
                text: "Sesli mesajı anlayamadım. Kısa bir metinle yazabilir misiniz?",
              });
              continue;
            }
            rawText = transcript.trim();
            console.log("[webhook] audio transcript:", rawText.slice(0, 250));
          } else {
            console.log("[webhook] unsupported message type:", msg.type);
            await sendWhatsAppMessage({
              to: `+${from}`,
              text: "Şu an metin ve sesli mesajları destekliyorum. Lütfen metin veya sesli mesaj gönderin.",
            });
            continue;
          }

          const customerPhone = `+${from}`;

          if (!rawText) {
            console.log("[webhook] skip empty message from", customerPhone);
            continue;
          }

          const rateLimitResult = await enforceRateLimit(customerPhone);
          if (!rateLimitResult.allowed) {
            await sendWhatsAppMessage({ to: customerPhone, text: rateLimitResult.message });
            continue;
          }

          try {
            const previousTenantId: string | null = await getTenantIdByPhone(customerPhone);
            let tenantId: string | null = null;
            let routingReason: "marker" | "session" | "nlp" | "default" | "none" = "none";
            let tenantName: string | null = null;
            let tenantCode: string | null = null;
            let intentDomain: "haircare" | "carcare" | null = null;

            const routing = await resolveTenantRouting({
              customerPhone,
              rawMessage: rawText,
              previousTenantId,
            });
            tenantId = routing.tenantId;
            tenantName = routing.tenantName;
            routingReason = routing.reason;
            tenantCode = routing.tenantCode;
            intentDomain = routing.intentDomain;
            const normalizedText = routing.normalizedMessage || rawText;

            if (!tenantId) {
              const defaultId = await resolveDefaultTenant();
              if (defaultId) {
                tenantId = defaultId;
                routingReason = "default";
              }
            }

            if (!tenantId) {
              const appUrl = getAppBaseUrl();
              const listUrl = `${appUrl}/isletmeler`;
              console.log("[webhook] no tenant, sending list to", customerPhone);
              await sendWhatsAppMessage({
                to: customerPhone,
                text: `Merhaba! Hangi işletme için randevu almak istiyorsunuz?\n\nİşletme listesine buradan ulaşabilirsiniz: ${listUrl}\n\nVeya işletmenin WhatsApp linkine tıklayarak bize ulaşabilirsiniz.`,
              });
              continue;
            }

            // Tenant adını DB'den çek (getTenantByCode'dan gelmediyse)
            if (!tenantName) {
              const { data: t } = await supabase
                .from("tenants")
                .select("name")
                .eq("id", tenantId)
                .single();
              tenantName = t?.name || "İşletme";
            }

            const hasTenantSwitched = Boolean(previousTenantId && previousTenantId !== tenantId);
            const isFirstTenantBinding = Boolean(!previousTenantId && tenantId);
            const isNewTenant = Boolean(isFirstTenantBinding || hasTenantSwitched);
            // İşletme değişikliğinde eski session'ı temizle
            if (hasTenantSwitched && previousTenantId) {
              await deleteSession(previousTenantId, customerPhone);
              console.log("[webhook] tenant switch: cleared old session for", previousTenantId);
            }

            await setPhoneTenantMapping(customerPhone, tenantId);

            const existingSession = await getSession(tenantId, customerPhone);
            if (!existingSession || isNewTenant) {
              const newState: ConversationState = {
                tenant_id: tenantId,
                customer_phone: customerPhone,
                flow_type: "appointment",
                extracted: {},
                step: isNewTenant ? "tenant_bulundu" : "devam",
                updated_at: new Date().toISOString(),
              };
              await setSession(tenantId, customerPhone, newState);
            }

            if ((hasTenantSwitched || isFirstTenantBinding) && routingReason !== "none") {
              await logTenantSwitch({
                customerPhone,
                previousTenantId,
                nextTenantId: tenantId,
                switchReason: routingReason,
                intentDomain,
                tenantCode,
                messagePreview: normalizedText,
              });
            }

            if (hasTenantSwitched) {
              const header = (tenantName || "İşletme").toLocaleUpperCase("tr-TR");
              await sendWhatsAppMessage({
                to: customerPhone,
                text: `⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n🏪 ${header} 🏪\n⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛`,
              });
            }

            console.log("[webhook] processMessage for tenant", tenantId, "from", customerPhone);
            const { reply } = await processMessage(tenantId, customerPhone, normalizedText);
            const safeReply = (reply && String(reply).trim()) || "Anlamadım, tekrar yazar mısınız?";
            const prefixedReply = `*${tenantName}*\n${safeReply}`;
            console.log("[webhook] sending reply to", customerPhone);
            const sent = await sendWhatsAppMessage({ to: customerPhone, text: prefixedReply });
            console.log("[webhook] send result:", sent);
            if (!sent) console.error("[webhook] WhatsApp send failed for", customerPhone);
          } catch (err) {
            console.error("[webhook] Error processing message:", err);
            try {
              await sendWhatsAppMessage({
                to: customerPhone,
                text: "Üzgünüm, bir anlık sorun yaşandı. Lütfen tekrar deneyin.",
              });
            } catch (sendErr) {
              console.error("[webhook] Fallback send failed:", sendErr);
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Outer error:", err);
    return NextResponse.json({ ok: true });
  }
}
