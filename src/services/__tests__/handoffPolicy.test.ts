import { describe, expect, it } from "vitest";
import { evaluateHandoff, detectCrisisSignals } from "../handoffPolicy.service";

describe("evaluateHandoff", () => {
  it("handoffs on human request", () => {
    const d = evaluateHandoff({ humanRequested: true });
    expect(d.shouldHandoff).toBe(true);
    expect(d.primaryReason).toBe("HUMAN_REQUEST");
  });

  it("detects medical risk for dental urgency", () => {
    const crisis = detectCrisisSignals("Dişim çok ağrıyor, yüzüm şişti");
    expect(crisis.medicalRiskLanguage).toBe(true);
    const d = evaluateHandoff({
      healthcare: true,
      messageText: "Dişim çok ağrıyor, yüzüm şişti",
    });
    expect(d.shouldHandoff).toBe(true);
    expect(d.priority).toBe("urgent");
    expect(d.primaryReason).toBe("MEDICAL_RISK");
  });

  it("does not medical-handoff bare 'acil saat' outside healthcare", () => {
    const d = evaluateHandoff({
      healthcare: false,
      messageText: "Acil bir saat var mı bu akşam?",
    });
    expect(d.primaryReason).not.toBe("MEDICAL_RISK");
  });

  it("detects legal threat", () => {
    const d = evaluateHandoff({ messageText: "Avukatıma danışıp dava açacağım" });
    expect(d.shouldHandoff).toBe(true);
    expect(d.primaryReason).toBe("LEGAL_THREAT");
  });

  it("handoffs after repeated misunderstanding", () => {
    const d = evaluateHandoff({ misunderstandingCount: 2 });
    expect(d.shouldHandoff).toBe(true);
    expect(d.primaryReason).toBe("REPEATED_MISUNDERSTANDING");
  });
});
