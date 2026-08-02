import { describe, expect, it } from "vitest";
import {
  BOT_KNOWLEDGE_LIMIT,
  KNOWLEDGE_BODY_PROMPT_CHARS,
  detectPriceLikeContent,
  formatKnowledgeForPrompt,
  type KnowledgeEntry,
} from "../tenantKnowledge.service";

function entry(index: number, bodyLength: number): KnowledgeEntry {
  return {
    id: `id-${index}`,
    title: `Başlık ${index}`,
    body: "x".repeat(bodyLength),
    category: "faq",
    version: 1,
  };
}

describe("formatKnowledgeForPrompt", () => {
  it("returns empty string when there is nothing approved", () => {
    expect(formatKnowledgeForPrompt([])).toBe("");
  });

  it("truncates each body to the prompt budget", () => {
    const output = formatKnowledgeForPrompt([entry(1, 5000)]);
    expect(output).not.toContain("x".repeat(KNOWLEDGE_BODY_PROMPT_CHARS + 1));
    expect(output).toContain("x".repeat(KNOWLEDGE_BODY_PROMPT_CHARS));
  });

  it("keeps one line per entry even when the body is multi-line", () => {
    const multiline: KnowledgeEntry = {
      ...entry(1, 0),
      body: "Otopark var.\n\nPazar günü kapalıyız.\n- Randevu şart",
    };
    const output = formatKnowledgeForPrompt([multiline, entry(2, 10)]);

    expect(output.split("\n")).toHaveLength(3); // başlık + 2 kayıt
    expect(output).toContain("Otopark var. Pazar günü kapalıyız. - Randevu şart");
  });

  it("stays within a predictable prompt budget at the bot limit", () => {
    const entries = Array.from({ length: BOT_KNOWLEDGE_LIMIT }, (_, i) => entry(i, 5000));
    const output = formatKnowledgeForPrompt(entries);

    // Header + per-entry overhead is small; the body cap is what bounds cost.
    const budget = BOT_KNOWLEDGE_LIMIT * (KNOWLEDGE_BODY_PROMPT_CHARS + 100);
    expect(output.length).toBeLessThan(budget);
    expect(output.split("\n")).toHaveLength(BOT_KNOWLEDGE_LIMIT + 1);
  });
});

describe("detectPriceLikeContent", () => {
  it("flags prices so they stay in the services table", () => {
    expect(detectPriceLikeContent("Seans ücreti 1500 TL")).toBe(true);
    expect(detectPriceLikeContent("₺2.500 peşin")).toBe(true);
  });

  it("does not flag ordinary policy text", () => {
    expect(detectPriceLikeContent("Kredi kartına taksit yapıyoruz.")).toBe(false);
    expect(detectPriceLikeContent("18 yaşından küçüklere uygulanmaz.")).toBe(false);
  });
});
