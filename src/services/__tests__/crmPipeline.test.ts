import { describe, expect, it } from "vitest";
import { canTransitionPipeline } from "../crmPipeline.service";

describe("canTransitionPipeline", () => {
  it("allows forward progress", () => {
    expect(canTransitionPipeline("new_lead", "contacted")).toBe(true);
    expect(canTransitionPipeline("qualified", "appointment_booked")).toBe(true);
  });

  it("blocks stage regression from appointment_booked to need_identified", () => {
    expect(canTransitionPipeline("appointment_booked", "need_identified")).toBe(false);
  });

  it("allows no-show style follow_up after booking", () => {
    expect(canTransitionPipeline("appointment_booked", "follow_up")).toBe(true);
  });

  it("allows same-stage no-op", () => {
    expect(canTransitionPipeline("qualified", "qualified")).toBe(true);
  });
});
