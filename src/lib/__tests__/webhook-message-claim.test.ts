import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimWebhookMessageId,
  markWebhookMessageProcessed,
  parseWebhookClaimValue,
  WEBHOOK_CLAIM_STALE_MS,
} from "../redis";

describe("parseWebhookClaimValue", () => {
  it("done / legacy 1 değerlerini done olarak okur", () => {
    expect(parseWebhookClaimValue("done")).toEqual({
      state: "done",
      at: 0,
      owner: null,
    });
    expect(parseWebhookClaimValue("1")).toEqual({
      state: "done",
      at: 0,
      owner: null,
    });
  });

  it("eski processing:<ts> formatını owner olmadan okur", () => {
    expect(parseWebhookClaimValue("processing:1710000000000")).toEqual({
      state: "processing",
      at: 1710000000000,
      owner: null,
    });
  });

  it("processing:<ts>:<owner> formatını okur", () => {
    expect(parseWebhookClaimValue("processing:1710000000000:trace_abc-1")).toEqual({
      state: "processing",
      at: 1710000000000,
      owner: "trace_abc-1",
    });
  });
});

describe("claimWebhookMessageId owner reclaim (memory fallback)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aynı owner token ile claim'i hemen yeniden alır", async () => {
    // Production Redis yoksa memory fallback sadece non-production'da açılır.
    expect(process.env.NODE_ENV).not.toBe("production");

    const messageId = `msg_owner_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const owner = "trace_same_owner_1";

    expect(await claimWebhookMessageId(messageId, { ownerToken: owner })).toBe(
      "acquired"
    );
    // Hata sonrası Inngest retry: aynı trace_id ile tekrar claim.
    expect(await claimWebhookMessageId(messageId, { ownerToken: owner })).toBe(
      "acquired"
    );
  });

  it("farklı owner için stale olmadan in_progress döner", async () => {
    const messageId = `msg_foreign_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    expect(
      await claimWebhookMessageId(messageId, { ownerToken: "owner_a" })
    ).toBe("acquired");
    expect(
      await claimWebhookMessageId(messageId, { ownerToken: "owner_b" })
    ).toBe("in_progress");
  });

  it("stale olduktan sonra farklı owner reclaim edebilir", async () => {
    vi.useFakeTimers();
    const messageId = `msg_stale_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    expect(
      await claimWebhookMessageId(messageId, { ownerToken: "owner_a" })
    ).toBe("acquired");

    vi.advanceTimersByTime(WEBHOOK_CLAIM_STALE_MS + 1);

    expect(
      await claimWebhookMessageId(messageId, { ownerToken: "owner_b" })
    ).toBe("acquired");
  });

  it("done işaretinden sonra already_done döner", async () => {
    const messageId = `msg_done_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const owner = "trace_done_1";

    expect(await claimWebhookMessageId(messageId, { ownerToken: owner })).toBe(
      "acquired"
    );
    await markWebhookMessageProcessed(messageId);
    expect(await claimWebhookMessageId(messageId, { ownerToken: owner })).toBe(
      "already_done"
    );
  });
});
