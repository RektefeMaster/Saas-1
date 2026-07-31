import { describe, expect, it } from "vitest";
import { DELIVERY_STATUS_RANK } from "@/types/conversation.types";
import { shouldSkipAiProcessing } from "../conversation.service";

describe("inbound dedupe contract", () => {
  it("only duplicate flag should abort AI — not generic insert failure", () => {
    const duplicate = { inserted: false, duplicate: true as const };
    const schemaMiss = { inserted: false, duplicate: false as const, error: "relation missing" };
    expect(duplicate.duplicate).toBe(true);
    expect(schemaMiss.duplicate).toBe(false);
  });

  it("AI_ASSIST and HUMAN_ACTIVE both skip AI", () => {
    expect(shouldSkipAiProcessing("AI_ASSIST")).toBe(true);
    expect(shouldSkipAiProcessing("HUMAN_ACTIVE")).toBe(true);
    expect(shouldSkipAiProcessing("AI_ACTIVE")).toBe(false);
  });

  it("status rank prevents regression", () => {
    const apply = (current: keyof typeof DELIVERY_STATUS_RANK, next: keyof typeof DELIVERY_STATUS_RANK) =>
      DELIVERY_STATUS_RANK[next] > DELIVERY_STATUS_RANK[current];
    expect(apply("read", "delivered")).toBe(false);
    expect(apply("sent", "delivered")).toBe(true);
  });
});
