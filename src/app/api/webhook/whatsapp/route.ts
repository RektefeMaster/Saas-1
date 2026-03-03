import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import type { IncomingWebhookValue, WhatsAppInboundEventData } from "@/lib/bot-v1/types";
import { getWebhookSecret, verifyWebhookSignatureBody } from "@/middleware/webhookVerify.middleware";
import {
  getWebhookDebugRecord,
  setRuntimeWhatsAppConfig,
  setWebhookDebugRecord,
} from "@/lib/redis";
import { createMessageProcessingJob } from "@/services/messageProcessingJob.service";

export const runtime = "nodejs";
export const maxDuration = 60;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
const STRICT_WEBHOOK_SIGNATURE =
  (process.env.WHATSAPP_STRICT_SIGNATURE || "").trim().toLowerCase() === "true";

export async function GET(request: NextRequest) {
  if (!VERIFY_TOKEN) {
    return new NextResponse("WHATSAPP_VERIFY_TOKEN missing", { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const diag = searchParams.get("diag");
  if (diag === "1") {
    const key = searchParams.get("key") || "";
    const diagToken = (process.env.WHATSAPP_DIAG_TOKEN || VERIFY_TOKEN).trim();
    if (!diagToken || key !== diagToken) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const data = await getWebhookDebugRecord();
    return NextResponse.json({ ok: true, data });
  }

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

type IncomingWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: IncomingWebhookValue;
    }>;
  }>;
};

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const secret = getWebhookSecret();
  const rawBody = await request.text();
  const userAgent = request.headers.get("user-agent") || "";

  const runtimeTokenFromUrl = (request.nextUrl.searchParams.get("wa_token") || "").trim();
  const runtimePhoneIdFromUrl = (
    request.nextUrl.searchParams.get("wa_phone_id") ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    ""
  ).trim();

  if (runtimeTokenFromUrl && runtimePhoneIdFromUrl) {
    await setRuntimeWhatsAppConfig(
      {
        token: runtimeTokenFromUrl,
        phone_id: runtimePhoneIdFromUrl,
        updated_at: new Date().toISOString(),
        source: "webhook-query",
      },
      60 * 30
    );
  }

  await setWebhookDebugRecord({
    stage: "post_received",
    at: new Date().toISOString(),
    has_signature: Boolean(signature),
    strict_signature: STRICT_WEBHOOK_SIGNATURE,
    has_secret: Boolean(secret),
    user_agent: userAgent.slice(0, 120),
    body_size: rawBody.length,
    runtime_token_from_url: Boolean(runtimeTokenFromUrl),
  });

  if (!secret) {
    if (STRICT_WEBHOOK_SIGNATURE) {
      await setWebhookDebugRecord({
        stage: "rejected_missing_secret",
        at: new Date().toISOString(),
      });
      return new NextResponse("Webhook secret missing", { status: 503 });
    }
    console.warn(
      "[webhook] WHATSAPP_WEBHOOK_SECRET tanımlı değil, strict=false olduğu için imza doğrulama atlandı"
    );
  } else if (!verifyWebhookSignatureBody(Buffer.from(rawBody, "utf8"), signature, secret)) {
    const likelyMeta = /facebook|meta|whatsapp/i.test(userAgent);
    if (STRICT_WEBHOOK_SIGNATURE) {
      await setWebhookDebugRecord({
        stage: "rejected_invalid_signature",
        at: new Date().toISOString(),
        likely_meta: likelyMeta,
      });
      return new NextResponse("Unauthorized", { status: 401 });
    }
    await setWebhookDebugRecord({
      stage: "invalid_signature_but_allowed",
      at: new Date().toISOString(),
      likely_meta: likelyMeta,
      has_signature: Boolean(signature),
    });
  }

  let body: IncomingWebhookBody;
  try {
    body = JSON.parse(rawBody) as IncomingWebhookBody;
  } catch {
    await setWebhookDebugRecord({
      stage: "invalid_json",
      at: new Date().toISOString(),
    });
    return new NextResponse("Bad Request", { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true });
  }

  let queuedCount = 0;
  const entries = body.entry || [];
  for (let entryIdx = 0; entryIdx < entries.length; entryIdx += 1) {
    const entry = entries[entryIdx];
    const changes = entry.changes || [];
    for (let changeIdx = 0; changeIdx < changes.length; changeIdx += 1) {
      const change = changes[changeIdx];
      if (change.field !== "messages") continue;

      const value = change.value;
      const statuses = value?.statuses || [];
      const messages = value?.messages || [];
      if (messages.length === 0 && statuses.length > 0) {
        await setWebhookDebugRecord({
          stage: "status_only_event",
          at: new Date().toISOString(),
          status_count: statuses.length,
        });
      }

      for (let msgIdx = 0; msgIdx < messages.length; msgIdx += 1) {
        const msg = messages[msgIdx];
        const from = msg.from ? `+${msg.from}` : "";
        if (!from) continue;

        const messageId = (msg.id || "").trim() || `gen_${randomUUID()}`;
        const receivedAtIso = msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString();
        const traceId = randomUUID();
        const eventData: WhatsAppInboundEventData = {
          trace_id: traceId,
          provider: "whatsapp",
          message_id: messageId,
          tenant_hint: null,
          phone: from,
          received_at: receivedAtIso,
          message_type: (msg.type || "unknown").toLowerCase(),
          raw_ref: `entry:${entryIdx}:change:${changeIdx}:msg:${msgIdx}`,
          value: value || {},
          message: msg,
        };

        await inngest.send({
          name: "bot/whatsapp.message.received",
          data: eventData,
        });
        await createMessageProcessingJob({
          traceId,
          provider: "whatsapp",
          messageId,
          tenantId: null,
          customerPhone: from,
          payload: {
            message_type: eventData.message_type,
            raw_ref: eventData.raw_ref,
          },
        });
        queuedCount += 1;
      }
    }
  }

  await setWebhookDebugRecord({
    stage: "events_queued",
    at: new Date().toISOString(),
    queued_count: queuedCount,
  });

  return NextResponse.json({ ok: true, queued: queuedCount });
}
