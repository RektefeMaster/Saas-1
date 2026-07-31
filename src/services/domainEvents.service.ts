/**
 * Lightweight internal domain event dispatcher (DB outbox, no Kafka).
 */

import { supabase } from "@/lib/supabase";
import { extractMissingSchemaTable } from "@/lib/postgrest-schema";
import { transitionPipelineStage } from "@/services/crmPipeline.service";
import { applyLeadScore, type LeadScoreSignals } from "@/services/leadScoring.service";
import { scheduleFollowUp, cancelFollowUpsForCustomer } from "@/services/safeFollowUp.service";
import { emitConversationEvent } from "@/services/conversationObservability.service";

export type DomainEventType =
  | "CUSTOMER_IDENTIFIED"
  | "SERVICE_INTEREST_CAPTURED"
  | "PRICE_REQUESTED"
  | "APPOINTMENT_REQUESTED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_CANCELLED"
  | "NO_SHOW_RECORDED"
  | "OFFER_SENT"
  | "PURCHASE_SIGNAL_DETECTED"
  | "COMPLAINT_DETECTED"
  | "HUMAN_HANDOFF_TRIGGERED";

export async function publishDomainEvent(input: {
  tenantId: string;
  eventType: DomainEventType;
  aggregateType?: string;
  aggregateId?: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; duplicate?: boolean; replayed?: boolean }> {
  const { data, error } = await supabase
    .from("domain_events")
    .insert({
      tenant_id: input.tenantId,
      event_type: input.eventType,
      aggregate_type: input.aggregateType || null,
      aggregate_id: input.aggregateId || null,
      idempotency_key: input.idempotencyKey || null,
      payload: input.payload || {},
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Duplicate insert: re-consume only if previous consume never finished.
      if (input.idempotencyKey) {
        const { data: existing } = await supabase
          .from("domain_events")
          .select("id, processed_at, payload, event_type")
          .eq("tenant_id", input.tenantId)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        if (existing?.id && !existing.processed_at) {
          const ok = await consumeDomainEventSafe({
            tenantId: input.tenantId,
            eventType: (existing.event_type as DomainEventType) || input.eventType,
            payload:
              (existing.payload as Record<string, unknown>) || input.payload || {},
            eventId: existing.id,
          });
          return { ok, duplicate: true, replayed: true };
        }
      }
      return { ok: true, duplicate: true, replayed: false };
    }
    const missing = extractMissingSchemaTable(error);
    if (missing === "domain_events") {
      // Without outbox there is no idempotency — do NOT consume side effects.
      console.warn(
        "[domain-events] domain_events table missing — event dropped (apply migration 041)"
      );
      return { ok: false };
    }
    console.error("[domain-events] publish failed", error.message);
    return { ok: false };
  }

  const ok = await consumeDomainEventSafe({
    tenantId: input.tenantId,
    eventType: input.eventType,
    payload: input.payload || {},
    eventId: data?.id,
  });
  return { ok, duplicate: false };
}

async function consumeDomainEventSafe(input: {
  tenantId: string;
  eventType: DomainEventType;
  payload: Record<string, unknown>;
  eventId?: string | number;
}): Promise<boolean> {
  try {
    await consumeDomainEvent(input);
    return true;
  } catch (err) {
    console.error(
      "[domain-events] consume failed",
      input.eventType,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

async function consumeDomainEvent(input: {
  tenantId: string;
  eventType: DomainEventType;
  payload: Record<string, unknown>;
  eventId?: string | number;
}): Promise<void> {
  const customerId = (input.payload.customerId as string) || null;
  const phone = (input.payload.customerPhone as string) || null;

  if (customerId) {
    const signals = signalsFromEvent(input.eventType, input.payload);
    if (Object.keys(signals).length) {
      await applyLeadScore({
        tenantId: input.tenantId,
        customerId,
        signals,
      });
    }

    switch (input.eventType) {
      case "CUSTOMER_IDENTIFIED":
        await transitionPipelineStage({
          tenantId: input.tenantId,
          customerId,
          targetStage: "contacted",
          sourceEvent: input.eventType,
        });
        break;
      case "SERVICE_INTEREST_CAPTURED":
      case "PRICE_REQUESTED":
        await transitionPipelineStage({
          tenantId: input.tenantId,
          customerId,
          targetStage: "need_identified",
          sourceEvent: input.eventType,
        });
        if (input.eventType === "PRICE_REQUESTED") {
          await scheduleFollowUp({
            tenantId: input.tenantId,
            customerId,
            customerPhoneDigits: phone || "",
            delayHours: 24,
            trigger: "price_no_reply",
            templateName: null,
          });
        }
        break;
      case "APPOINTMENT_REQUESTED":
      case "PURCHASE_SIGNAL_DETECTED":
        await transitionPipelineStage({
          tenantId: input.tenantId,
          customerId,
          targetStage: "qualified",
          sourceEvent: input.eventType,
        });
        break;
      case "APPOINTMENT_CREATED":
        await transitionPipelineStage({
          tenantId: input.tenantId,
          customerId,
          targetStage: "appointment_booked",
          sourceEvent: input.eventType,
        });
        await cancelFollowUpsForCustomer(input.tenantId, customerId, "appointment_created");
        break;
      case "APPOINTMENT_CANCELLED":
      case "NO_SHOW_RECORDED":
        await transitionPipelineStage({
          tenantId: input.tenantId,
          customerId,
          targetStage: "follow_up",
          reason: input.eventType.toLowerCase(),
          sourceEvent: input.eventType,
        });
        await scheduleFollowUp({
          tenantId: input.tenantId,
          customerId,
          customerPhoneDigits: phone || "",
          delayHours: 48,
          trigger: input.eventType === "NO_SHOW_RECORDED" ? "no_show" : "cancelled",
          templateName: null,
        });
        break;
      case "OFFER_SENT":
        await transitionPipelineStage({
          tenantId: input.tenantId,
          customerId,
          targetStage: "offer_sent",
          sourceEvent: input.eventType,
        });
        break;
      case "COMPLAINT_DETECTED":
      case "HUMAN_HANDOFF_TRIGGERED":
        break;
      default: {
        const _exhaustive: never = input.eventType;
        void _exhaustive;
        break;
      }
    }
  }

  // Mark processed only after successful side effects.
  if (input.eventId != null) {
    const { error } = await supabase
      .from("domain_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", input.eventId);
    if (error) throw new Error(error.message);
  }

  emitConversationEvent("crm_event_applied", {
    tenant_id: input.tenantId,
    customer_id: customerId,
    reason: input.eventType,
  });
}

function signalsFromEvent(
  eventType: DomainEventType,
  payload: Record<string, unknown>
): LeadScoreSignals {
  switch (eventType) {
    case "SERVICE_INTEREST_CAPTURED":
      return { serviceSelected: true, nameProvided: Boolean(payload.nameProvided) };
    case "PRICE_REQUESTED":
      return { priceReask: Boolean(payload.reask), serviceSelected: true };
    case "APPOINTMENT_REQUESTED":
      return { nearTermIntent: true, dateSelected: Boolean(payload.dateSelected) };
    case "APPOINTMENT_CREATED":
      return { appointmentCompleted: true, dateSelected: true, serviceSelected: true };
    case "PURCHASE_SIGNAL_DETECTED":
      return {
        paymentIntent: Boolean(payload.paymentIntent),
        budgetStated: Boolean(payload.budgetStated),
        nearTermIntent: true,
      };
    default:
      return {};
  }
}
