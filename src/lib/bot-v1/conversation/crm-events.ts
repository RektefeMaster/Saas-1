/**
 * Best-effort CRM domain events from conversation turns.
 * Keeps processor thin — publish only, consumers own side effects.
 */

import { createHash } from "crypto";
import { publishDomainEvent } from "@/services/domainEvents.service";
import { upsertCrmCustomer } from "@/services/crmCustomer.service";

const PRICE_RE = /\b(fiyat|ücret|ucret|kaç\s*para|ne\s*kadar|₺|tl\b)/i;
const APPOINTMENT_RE =
  /\b(randevu|bugün\s*gelebilir|yarın|müsait|rezerv|saat\s*\d)/i;
const PAYMENT_RE = /\b(kapora|taksit|ödeme|odeme|kart\s*geç)/i;
const BUDGET_RE = /\b(\d{3,6})\s*(tl|₺)|bütçe|butce/i;

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function stableSnippet(text: string): string {
  return createHash("sha256").update(text.trim().toLowerCase()).digest("hex").slice(0, 12);
}

export async function emitTurnCrmEvents(input: {
  tenantId: string;
  customerPhone: string;
  messageText: string;
  customerName?: string | null;
  serviceSelected?: boolean;
  handoffReason?: string | null;
  /** Prefer provider message id for idempotency when available */
  messageId?: string | null;
}): Promise<string | null> {
  const customerId = await upsertCrmCustomer(
    input.tenantId,
    input.customerPhone,
    input.customerName
  );
  if (!customerId) return null;

  const turnKey =
    input.messageId ||
    `${dayKey()}:${stableSnippet(input.messageText || "")}`;

  const base = {
    tenantId: input.tenantId,
    aggregateType: "crm_customer",
    aggregateId: customerId,
    payload: {
      customerId,
      customerPhone: input.customerPhone,
      nameProvided: Boolean(input.customerName),
    },
  };

  await publishDomainEvent({
    ...base,
    eventType: "CUSTOMER_IDENTIFIED",
    idempotencyKey: `customer_identified:${input.tenantId}:${customerId}`,
  }).catch(() => undefined);

  if (input.serviceSelected) {
    await publishDomainEvent({
      ...base,
      eventType: "SERVICE_INTEREST_CAPTURED",
      // Once per customer per calendar day (not per ~100s window).
      idempotencyKey: `service_interest:${input.tenantId}:${customerId}:${dayKey()}`,
      payload: { ...base.payload, serviceSelected: true },
    }).catch(() => undefined);
  }

  if (PRICE_RE.test(input.messageText)) {
    // First successful day-key publish is not a reask. Reask only when that
    // day-key already finished processing (duplicate + processed).
    const priceDayKey = `price_req:${input.tenantId}:${customerId}:${dayKey()}`;
    const firstToday: {
      ok: boolean;
      duplicate?: boolean;
      replayed?: boolean;
    } = await publishDomainEvent({
      ...base,
      eventType: "PRICE_REQUESTED",
      idempotencyKey: priceDayKey,
      payload: { ...base.payload, reask: false },
    }).catch(() => ({ ok: false, duplicate: false, replayed: false }));

    // Reask only when day-key already fully processed (not a crash replay).
    if (firstToday.duplicate && firstToday.ok && !firstToday.replayed) {
      await publishDomainEvent({
        ...base,
        eventType: "PRICE_REQUESTED",
        idempotencyKey: `price_reask:${input.tenantId}:${customerId}:${turnKey}`,
        payload: { ...base.payload, reask: true },
      }).catch(() => undefined);
    }
  }

  if (APPOINTMENT_RE.test(input.messageText)) {
    await publishDomainEvent({
      ...base,
      eventType: "APPOINTMENT_REQUESTED",
      idempotencyKey: `appt_req:${input.tenantId}:${customerId}:${turnKey}`,
      payload: { ...base.payload, dateSelected: false },
    }).catch(() => undefined);
  }

  if (PAYMENT_RE.test(input.messageText) || BUDGET_RE.test(input.messageText)) {
    await publishDomainEvent({
      ...base,
      eventType: "PURCHASE_SIGNAL_DETECTED",
      idempotencyKey: `purchase:${input.tenantId}:${customerId}:${turnKey}`,
      payload: {
        ...base.payload,
        paymentIntent: PAYMENT_RE.test(input.messageText),
        budgetStated: BUDGET_RE.test(input.messageText),
      },
    }).catch(() => undefined);
  }

  if (input.handoffReason) {
    await publishDomainEvent({
      ...base,
      eventType: "HUMAN_HANDOFF_TRIGGERED",
      idempotencyKey: `handoff:${input.tenantId}:${customerId}:${input.handoffReason}:${dayKey()}`,
      payload: { ...base.payload, reason: input.handoffReason },
    }).catch(() => undefined);

    if (/complaint/i.test(input.handoffReason)) {
      await publishDomainEvent({
        ...base,
        eventType: "COMPLAINT_DETECTED",
        idempotencyKey: `complaint:${input.tenantId}:${customerId}:${dayKey()}`,
        payload: { ...base.payload, reason: input.handoffReason },
      }).catch(() => undefined);
    }
  }

  return customerId;
}
