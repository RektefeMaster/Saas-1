import { RetryAfterError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { processWhatsAppInboundEvent } from "@/lib/bot-v1/whatsapp-worker";
import { logBotDlq } from "@/services/botAudit.service";
import type { WhatsAppInboundEventData } from "@/lib/bot-v1/types";
import { updateMessageProcessingJob } from "@/services/messageProcessingJob.service";
import { WEBHOOK_CLAIM_STALE_MS } from "@/lib/redis";

export const processWhatsAppMessageFn = inngest.createFunction(
  {
    id: "process-whatsapp-message-v1",
    retries: 5,
  },
  {
    event: "bot/whatsapp.message.received",
  },
  async ({ event, attempt }) => {
    const data = event.data as WhatsAppInboundEventData;
    // Sağlayıcıdan gelen zaman damgası bozuk olabilir (Meta'nın test webhook'u
    // sabit/sahte bir timestamp gönderiyor). Mantıksız değerleri ölçüme sokma.
    const MAX_PLAUSIBLE_QUEUE_LAG_MS = 24 * 60 * 60 * 1000;
    const rawQueueLagMs = Date.now() - new Date(data.received_at).getTime();
    const queueLagMs =
      Number.isFinite(rawQueueLagMs) &&
      rawQueueLagMs >= 0 &&
      rawQueueLagMs <= MAX_PLAUSIBLE_QUEUE_LAG_MS
        ? rawQueueLagMs
        : 0;
    try {
      await updateMessageProcessingJob({
        traceId: data.trace_id,
        status: "processing",
        attemptCount: attempt,
      });
      await processWhatsAppInboundEvent(data, {
        attempt,
        lockWaitMs: undefined,
        queueLagMs,
      });
      await updateMessageProcessingJob({
        traceId: data.trace_id,
        status: "completed",
        attemptCount: attempt,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (attempt >= 3) {
        await logBotDlq({
          traceId: data.trace_id,
          tenantId: data.tenant_hint,
          customerPhone: data.phone,
          messageId: data.message_id,
          payload: data as unknown as Record<string, unknown>,
          errorCode: "worker_hard_fail",
          errorMessage,
        });
        await updateMessageProcessingJob({
          traceId: data.trace_id,
          status: "dlq",
          attemptCount: attempt,
          errorCode: "worker_hard_fail",
        });
      } else {
        await updateMessageProcessingJob({
          traceId: data.trace_id,
          status: "failed",
          attemptCount: attempt,
          errorCode: "worker_retry_scheduled",
        });
      }

      // Foreign/legacy in_progress claims stay hot for ~3m. Default Inngest backoff
      // would exhaust retries in ~30s and DLQ the message permanently. Space retries
      // to the stale window (or a short delay when Redis is briefly unavailable).
      if (errorMessage === "webhook_message_claim_in_progress") {
        throw new RetryAfterError(errorMessage, WEBHOOK_CLAIM_STALE_MS, {
          cause: err,
        });
      }
      if (errorMessage === "webhook_message_claim_unavailable") {
        throw new RetryAfterError(errorMessage, 30_000, { cause: err });
      }
      throw err;
    }
  }
);
