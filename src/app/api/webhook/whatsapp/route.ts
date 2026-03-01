import { NextRequest, NextResponse } from "next/server";
import { parseTenantCodeFromMessage } from "@/lib/tenant-code";
import { getTenantByCode, processMessage } from "@/lib/ai";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getTenantIdByPhone, setPhoneTenantMapping, setSession, getSession, deleteSession } from "@/lib/redis";
import { verifyWebhookSignatureBody, getWebhookSecret } from "@/middleware/webhookVerify.middleware";
import { enforceRateLimit } from "@/middleware/rateLimit.middleware";
import { supabase } from "@/lib/supabase";
import type { ConversationState } from "@/lib/database.types";

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

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "saasrandevu_verify";

export async function GET(request: NextRequest) {
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

  const rawBody = await request.text();
  if (!secret) {
    console.warn("[webhook] WHATSAPP_WEBHOOK_SECRET tanımlı değil, imza doğrulama atlandı");
  } else if (!verifyWebhookSignatureBody(Buffer.from(rawBody, "utf8"), signature, secret)) {
    console.warn("[webhook] Invalid signature, rejecting request");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: { object?: string; entry?: Array<{ changes?: Array<{ field?: string; value?: { messages?: Array<{ type?: string; from?: string; text?: { body?: string } }> } }> }> };
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
          if (msg.type !== "text") {
            console.log("[webhook] skip non-text type:", msg.type);
            continue;
          }
          const from = msg.from;
          const text = (msg.text?.body || "").trim();
          const customerPhone = `+${from}`;

          if (!text) {
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
            let tenantId: string | null = previousTenantId;
            let isNewTenant = false;
            let tenantName: string | null = null;

            const code = parseTenantCodeFromMessage(text);
            if (code) {
              const tenant = await getTenantByCode(code);
              if (tenant) {
                tenantId = tenant.id;
                tenantName = tenant.name;
                isNewTenant = previousTenantId !== tenant.id;
              }
            }

            if (!tenantId) {
              const defaultId = await resolveDefaultTenant();
              if (defaultId) {
                tenantId = defaultId;
                isNewTenant = true;
              }
            }

            if (!tenantId) {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://saasrandevu.com";
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

            // İşletme değişikliğinde eski session'ı temizle
            if (isNewTenant && previousTenantId && previousTenantId !== tenantId) {
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

            console.log("[webhook] processMessage for tenant", tenantId, "from", customerPhone);
            const { reply } = await processMessage(tenantId, customerPhone, text);
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
