import { describe, expect, it } from "vitest";
import { DELIVERY_STATUS_RANK } from "@/types/conversation.types";

describe("delivery status ordering", () => {
  it("ranks statuses so read cannot regress to delivered", () => {
    expect(DELIVERY_STATUS_RANK.read).toBeGreaterThan(DELIVERY_STATUS_RANK.delivered);
    expect(DELIVERY_STATUS_RANK.delivered).toBeGreaterThan(DELIVERY_STATUS_RANK.sent);
    expect(DELIVERY_STATUS_RANK.sent).toBeGreaterThan(DELIVERY_STATUS_RANK.queued);
  });

  it("rejects out-of-order updates by rank comparison", () => {
    const current = DELIVERY_STATUS_RANK.read;
    const incoming = DELIVERY_STATUS_RANK.delivered;
    expect(incoming <= current).toBe(true);
  });
});
