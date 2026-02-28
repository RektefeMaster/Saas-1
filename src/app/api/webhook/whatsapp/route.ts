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

        for (const msg of messages) {
          if (msg.type !== "text") continue;
          const from = msg.from;
          const text = msg.text?.body || "";
          const customerPhone = `+${from}`;

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
            await sendWhatsAppMessage({
              to: customerPhone,
              text: `Merhaba! Hangi işletme için randevu almak istiyorsunuz?\n\nİşletme listesine buradan ulaşabilirsiniz: ${listUrl}\n\nVeya mesajınızda "Kod: XXXXXX" formatında işletme kodunu yazın (örn: Kod: AHMET01).`,
            });
            return NextResponse.json({ ok: true });
          }

          const { reply } = await processMessage(tenantId, customerPhone, text);
          await sendWhatsAppMessage({ to: customerPhone, text: reply });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
