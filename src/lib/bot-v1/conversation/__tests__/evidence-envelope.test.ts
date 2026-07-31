import { describe, expect, it } from "vitest";
import { validateEvidenceEnvelope } from "../critical-guardrails";

describe("validateEvidenceEnvelope", () => {
  it("blocks price claim without source", () => {
    const verdict = validateEvidenceEnvelope(
      {
        message: "Paket 6500 TL",
        claims: [{ type: "price", value: "6500 TRY" }],
      },
      []
    );
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("claim_missing_source");
    }
  });

  it("blocks claim mismatch against tool result", () => {
    const verdict = validateEvidenceEnvelope(
      {
        message: "Paket 6500 TL",
        claims: [
          {
            type: "price",
            value: "6500 TRY",
            source: { tool: "get_services", recordId: "s1" },
          },
        ],
      },
      [
        {
          name: "get_services",
          ok: true,
          result: { ok: true, services: [{ id: "s1", price: 1200 }] },
        },
      ]
    );
    expect(verdict.action).toBe("rewrite");
    if (verdict.action !== "allow") {
      expect(verdict.reason).toBe("claim_mismatch");
    }
  });

  it("allows grounded price claim", () => {
    const verdict = validateEvidenceEnvelope(
      {
        message: "Paket 6500 TL",
        claims: [
          {
            type: "price",
            value: "6500 TRY",
            source: { tool: "get_services" },
          },
        ],
      },
      [
        {
          name: "get_services",
          ok: true,
          result: { ok: true, services: [{ price: 6500 }] },
        },
      ]
    );
    expect(verdict.action).toBe("allow");
  });
});
