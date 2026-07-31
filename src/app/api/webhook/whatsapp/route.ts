import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "@/lib/id";
import { logger } from "@/lib/logger";
import { inngest } from "@/lib/inngest/client";
import type { IncomingWebhookValue, WhatsAppInboundEventData } from "@/lib/bot-v1/types";
import { getWebhookSecret, verifyWebhookSignatureBody } from "@/middleware/webhookVerify.middleware";
import { getWebhookDebugRecord, setWebhookDebugRecord } from "@/lib/redis";
import { createMessageProcessingJob } from "@/services/messageProcessingJob.service";
import { normalizePhoneE164 } from "@/lib/phone";
import { createHash } from "crypto";
import { isMetaSampleWhatsAppInbound } from "@/lib/bot-v1/meta-sample-webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
// Production defaults to strict; set WHATSAPP_STRICT_SIGNATURE=false only for local diagnostics.
const STRICT_WEBHOOK_SIGNATURE = (() => {
  const raw = (process.env.WHATSAPP_STRICT_SIGNATURE || "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return process.env.NODE_ENV === "production";
})();

/** Happy-path debug writes are sampled to keep ingress RTT low. Errors always write. */
async function maybeSetWebhookDebug(
  record: Parameters<typeof setWebhookDebugRecord>[0],
  force = false
): Promise<void> {
  // Örnekleme kaldırıldı: "Meta bize hiç ulaştı mı?" sorusunun cevabı teşhis için
  // kritik ve %2 örnekleme bu kaydı güvenilmez kılıyordu (mesaj gelse bile
  // çoğu zaman yazılmıyordu). Mesaj başına tek Redis yazımı ihmal edilebilir.
  void force;
  await setWebhookDebugRecord(record);
}

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

  // Never accept WA credentials from query string (token injection risk).
  if (
    request.nextUrl.searchParams.has("wa_token") ||
    request.nextUrl.searchParams.has("wa_phone_id")
  ) {
    console.warn("[webhook] rejected wa_token/wa_phone_id query credential injection attempt");
  }

  // Always persist ingress breadcrumbs in production — sampled happy-path
  // writes hid "no real inbound" vs "401 signature reject" for hours.
  await maybeSetWebhookDebug(
    {
      stage: "post_received",
      at: new Date().toISOString(),
      has_signature: Boolean(signature),
      strict_signature: STRICT_WEBHOOK_SIGNATURE,
      has_secret: Boolean(secret),
      user_agent: userAgent.slice(0, 120),
      body_size: rawBody.length,
      runtime_token_from_url: false,
    },
    true
  );

  if (!secret) {
    if (STRICT_WEBHOOK_SIGNATURE) {
      await maybeSetWebhookDebug(
        {
          stage: "rejected_missing_secret",
          at: new Date().toISOString(),
        },
        true
      );
      return new NextResponse("Webhook secret missing", { status: 503 });
    }
    logger.warn(
      "[webhook] WHATSAPP_WEBHOOK_SECRET tanımlı değil, strict=false olduğu için imza doğrulama atlandı"
    );
  } else if (!verifyWebhookSignatureBody(Buffer.from(rawBody, "utf8"), signature, secret)) {
    const likelyMeta = /facebook|meta|whatsapp/i.test(userAgent);
    if (STRICT_WEBHOOK_SIGNATURE) {
      await maybeSetWebhookDebug(
        {
          stage: "rejected_invalid_signature",
          at: new Date().toISOString(),
          likely_meta: likelyMeta,
        },
        true
      );
      return new NextResponse("Unauthorized", { status: 401 });
    }
    void maybeSetWebhookDebug({
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
    await maybeSetWebhookDebug(
      {
        stage: "invalid_json",
        at: new Date().toISOString(),
      },
      true
    );
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
        void maybeSetWebhookDebug({
          stage: "status_only_event",
          at: new Date().toISOString(),
          status_count: statuses.length,
        });
      }

      for (let msgIdx = 0; msgIdx < messages.length; msgIdx += 1) {
        const msg = messages[msgIdx];
        const from =
          normalizePhoneE164(msg.from) ?? (msg.from ? `+${msg.from}` : "");
        if (!from) continue;

        // Dedupe is owned by the worker via claimWebhookMessageId (single claim site).
        // Claiming here AND in the worker would drop every inbound message.
        // Missing Meta id: deterministic fallback so retries don't mint a new claim key.
        const rawMetaId = (msg.id || "").trim();
        const messageId =
          rawMetaId ||
          `gen_${createHash("sha256")
            .update(
              [
                from,
                String(msg.timestamp || ""),
                String(msg.type || ""),
                String(msg.text?.body || msg.button?.payload || msg.interactive?.button_reply?.id || ""),
              ].join("|")
            )
            .digest("hex")
            .slice(0, 24)}`;
        if (!rawMetaId) {
          logger.warn("[webhook] message missing id; using deterministic fallback id");
        }

        // Meta Console "Test" button sends a fixed fake payload. Ack 200 but do
        // not enqueue AI/send — that path only produces 401/claim storms.
        if (
          isMetaSampleWhatsAppInbound({
            phone: from,
            messageId,
            phoneNumberId: value?.metadata?.phone_number_id,
            displayPhoneNumber: value?.metadata?.display_phone_number,
          })
        ) {
          logger.info(
            { messageId, from },
            "[webhook] meta sample Test payload acknowledged; not queued"
          );
          void maybeSetWebhookDebug(
            {
              stage: "meta_sample_webhook_ignored",
              at: new Date().toISOString(),
              message_id: messageId,
            },
            true
          );
          continue;
        }

        const receivedAtIso = msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString();
        const traceId = nanoid();
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

        // Idempotency key: Meta redeliveries share message_id. Dedupes Inngest
        // function starts for ~24h so parallel foreign runs don't fight the claim.
        const settled = await Promise.allSettled([
          inngest.send({
            id: `whatsapp-inbound-${messageId}`,
            name: "bot/whatsapp.message.received",
            data: eventData,
          }),
          createMessageProcessingJob({
            traceId,
            provider: "whatsapp",
            messageId,
            tenantId: null,
            customerPhone: from,
            payload: {
              message_type: eventData.message_type,
              raw_ref: eventData.raw_ref,
            },
          }),
        ]);
        if (settled[0].status === "rejected") {
          logger.error("[webhook] inngest.send failed", settled[0].reason);
          throw settled[0].reason;
        }
        if (settled[1].status === "rejected") {
          logger.warn("[webhook] message_processing_job insert failed", settled[1].reason);
        }
        queuedCount += 1;
      }
    }
  }

  await maybeSetWebhookDebug(
    {
      stage: "events_queued",
      at: new Date().toISOString(),
      queued_count: queuedCount,
    },
    true
  );

  return NextResponse.json({ ok: true, queued: queuedCount });
}
