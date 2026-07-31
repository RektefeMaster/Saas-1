import { describe, expect, it } from "vitest";
import {
  computeLeadScore,
  leadTier,
  mergeLeadScoreBreakdown,
} from "../leadScoring.service";

describe("computeLeadScore", () => {
  it("does not award points for phone alone (WhatsApp identity)", () => {
    const { score, breakdown } = computeLeadScore({});
    expect(score).toBe(0);
    expect(breakdown.phoneProvided).toBeUndefined();
  });

  it("scores appointment + service signals", () => {
    const { score, breakdown } = computeLeadScore({
      serviceSelected: true,
      appointmentCompleted: true,
      dateSelected: true,
      nameProvided: true,
    });
    expect(breakdown.serviceSelected).toBe(10);
    expect(breakdown.appointmentCompleted).toBe(25);
    expect(score).toBeGreaterThanOrEqual(50);
    expect(leadTier(score)).not.toBe("cold");
  });

  it("applies spam as hard negative", () => {
    const { score } = computeLeadScore({
      spam: true,
      serviceSelected: true,
      appointmentCompleted: true,
    });
    expect(score).toBe(0);
  });

  it("applies silence decay once in breakdown", () => {
    const { breakdown } = computeLeadScore({ silenceDays: 3 });
    expect(breakdown.silenceDecay).toBe(-10);
  });
});

describe("mergeLeadScoreBreakdown", () => {
  it("does not wipe prior positives when a partial event arrives", () => {
    const existing = { nameProvided: 10, serviceSelected: 10 };
    const { score, breakdown } = mergeLeadScoreBreakdown(existing, {
      appointmentCompleted: 25,
    });
    expect(breakdown.nameProvided).toBe(10);
    expect(breakdown.serviceSelected).toBe(10);
    expect(breakdown.appointmentCompleted).toBe(25);
    expect(score).toBe(45);
  });

  it("keeps silence decay once", () => {
    const { breakdown } = mergeLeadScoreBreakdown(
      { silenceDecay: -10, serviceSelected: 10 },
      { silenceDecay: -10, nameProvided: 10 }
    );
    expect(breakdown.silenceDecay).toBe(-10);
    expect(breakdown.nameProvided).toBe(10);
  });

  it("clears prior spam when a new positive signal arrives", () => {
    const { score, breakdown } = mergeLeadScoreBreakdown(
      { spam: -100, serviceSelected: 10 },
      { appointmentCompleted: 25 }
    );
    expect(breakdown.spam).toBeUndefined();
    expect(score).toBe(35);
  });
});
