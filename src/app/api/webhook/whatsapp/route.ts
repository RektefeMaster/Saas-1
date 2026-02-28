import { NextRequest, NextResponse } from "next/server";
import { parseTenantCodeFromMessage } from "@/lib/tenant-code";
import { getTenantByCode, processMessage } from "@/lib/ai";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getTenantIdByPhone, setPhoneTenantMapping, setSession } from "@/lib/redis";
import type { ConversationState } from "@/lib/database.types";

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
  try {
    const body = await request.json();
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
          const text = msg.text?.body || "";
          const customerPhone = `+${from}`;

          try {
            let tenantId: string | null = await getTenantIdByPhone(customerPhone);

            if (!tenantId) {
              const code = parseTenantCodeFromMessage(text);
              if (code) {
                const tenant = await getTenantByCode(code);
                if (tenant) {
                  tenantId = tenant.id;
                  await setPhoneTenantMapping(customerPhone, tenant.id);
                  const newState: ConversationState = {
                    tenant_id: tenant.id,
                    customer_phone: customerPhone,
                    flow_type: "appointment",
                    extracted: {},
                    step: "tenant_bulundu",
                    updated_at: new Date().toISOString(),
                  };
                  await setSession(tenant.id, customerPhone, newState);
                }
              }
            }

            if (!tenantId) {
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://saasrandevu.com";
              const listUrl = `${appUrl}/isletmeler`;
              console.log("[webhook] no tenant, sending list to", customerPhone);
              const sent = await sendWhatsAppMessage({
                to: customerPhone,
                text: `Merhaba! Hangi işletme için randevu almak istiyorsunuz?\n\nİşletme listesine buradan ulaşabilirsiniz: ${listUrl}\n\nVeya mesajınızda "Kod: XXXXXX" formatında işletme kodunu yazın (örn: Kod: AHMET01).`,
              });
              console.log("[webhook] send result (no tenant):", sent);
              continue;
            }

            console.log("[webhook] processMessage for tenant", tenantId, "from", customerPhone);
            const { reply } = await processMessage(tenantId, customerPhone, text);
            console.log("[webhook] sending reply to", customerPhone);
            const sent = await sendWhatsAppMessage({ to: customerPhone, text: reply });
            console.log("[webhook] send result:", sent);
            if (!sent) console.error("[webhook] WhatsApp send failed for", customerPhone);
          } catch (err) {
            console.error("[webhook] Error processing message:", err);
            try {
              await sendWhatsAppMessage({
                to: customerPhone,
                text: "Üzgünüm, bir hata oluştu. Lütfen biraz sonra tekrar deneyin.",
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
