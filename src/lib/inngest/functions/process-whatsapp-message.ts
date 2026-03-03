import { inngest } from "@/lib/inngest/client";
import { processWhatsAppInboundEvent } from "@/lib/bot-v1/whatsapp-worker";
import { logBotDlq } from "@/services/botAudit.service";
import type { WhatsAppInboundEventData } from "@/lib/bot-v1/types";
import { updateMessageProcessingJob } from "@/services/messageProcessingJob.service";

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
    const queueLagMs = Math.max(0, Date.now() - new Date(data.received_at).getTime());
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
      if (attempt >= 3) {
        await logBotDlq({
          traceId: data.trace_id,
          tenantId: data.tenant_hint,
          customerPhone: data.phone,
          messageId: data.message_id,
          payload: data as unknown as Record<string, unknown>,
          errorCode: "worker_hard_fail",
          errorMessage: err instanceof Error ? err.message : String(err),
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
      throw err;
    }
  }
);
