import { describe, expect, it } from "vitest";
import { applyCriticalGuardrails } from "../critical-guardrails";

describe("applyCriticalGuardrails", () => {
  it("blocks ungrounded price claims", () => {
    const verdict = applyCriticalGuardrails("Saç kesimi 450 TL'dir.", {
      healthcare: false,
      toolEvidence: [],
      tone: "sen",
    });
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("ungrounded_price");
    }
  });

  it("allows price when grounded in get_services", () => {
    const verdict = applyCriticalGuardrails("Saç kesimi 450 TL'dir.", {
      healthcare: false,
      toolEvidence: [
        {
          name: "get_services",
          ok: true,
          result: { ok: true, services: [{ name: "Saç kesimi", price: 450 }] },
        },
      ],
    });
    expect(verdict.action).toBe("allow");
  });

  it("blocks appointment confirm without successful create tool", () => {
    const verdict = applyCriticalGuardrails(
      "Randevunuz oluşturuldu, yarın 15:00'te bekliyoruz.",
      { healthcare: false, toolEvidence: [] }
    );
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("ungrounded_appointment_confirm");
    }
  });

  it("rewrites tool-failure success claims", () => {
    const verdict = applyCriticalGuardrails("Randevunuz başarıyla oluşturuldu.", {
      healthcare: false,
      toolEvidence: [
        { name: "create_appointment", ok: false, result: { ok: false, error: "slot_taken" } },
      ],
    });
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("tool_failure_success_claim");
    }
  });

  it("blocks healthcare guarantees", () => {
    const verdict = applyCriticalGuardrails("Evet, kesin sonuç verir, kalıcı olur.", {
      healthcare: true,
      toolEvidence: [],
      tone: "siz",
    });
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("healthcare_guarantee");
      expect(verdict.reply.toLowerCase()).toContain("değişebilir");
    }
  });

  it("blocks ungrounded campaign claims", () => {
    const verdict = applyCriticalGuardrails("Bu hafta %20 indirim kampanyamız var.", {
      healthcare: false,
      toolEvidence: [],
    });
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("ungrounded_campaign");
    }
  });
});
