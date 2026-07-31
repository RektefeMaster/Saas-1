import { describe, it, expect } from "vitest";
import { formatCrmProfileForPrompt } from "../crmCustomer.service";

describe("formatCrmProfileForPrompt", () => {
  it("boş profilde boş string döner", () => {
    expect(formatCrmProfileForPrompt(null)).toBe("");
    expect(
      formatCrmProfileForPrompt({
        customer_name: "Ayşe",
        total_visits: 0,
        last_visit_at: null,
        notes_summary: null,
        metadata: {},
      })
    ).toBe("");
  });

  it("CRM alanlarını kısa ve etiketli yazar", () => {
    const text = formatCrmProfileForPrompt({
      customer_name: "Ayşe",
      total_visits: 4,
      last_visit_at: "2026-07-01T10:00:00Z",
      notes_summary: "Boya sonrası hassas",
      metadata: {
        hair_type: "İnce",
        preferred_staff: "Elif",
        allergies: "amonyak",
      },
    });
    expect(text).toContain("4 ziyaret");
    expect(text).toContain("saç tipi: İnce");
    expect(text).toContain("tercih uzman: Elif");
    expect(text).toContain("hassasiyet: amonyak");
    expect(text).toContain("özet: Boya sonrası hassas");
    expect(text).toContain("geri okuma");
  });

  it("nesne değerleri ve boş alanları atlar", () => {
    const text = formatCrmProfileForPrompt({
      customer_name: null,
      total_visits: 0,
      last_visit_at: null,
      notes_summary: null,
      metadata: {
        nested: { a: 1 },
        preferred_time: "  ",
        preferred_staff: "Deniz",
      },
    });
    expect(text).toContain("tercih uzman: Deniz");
    expect(text).not.toContain("nested");
    expect(text).not.toContain("tercih zaman");
  });
});
