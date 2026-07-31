import { describe, it, expect } from "vitest";
import {
  sanitizeLeadMemory,
  formatLeadMemoryForPrompt,
  shouldRefreshLeadMemory,
  buildConversationDigest,
  LEAD_MEMORY_REFRESH_EVERY_N_MESSAGES,
} from "@/services/leadMemory.service";

describe("sanitizeLeadMemory", () => {
  it("bilinmeyen alanları atar, uzunlukları kırpar", () => {
    const result = sanitizeLeadMemory({
      summary: "  Saç kesimi için düzenli gelen müşteri.  ",
      preferred_service: "sac-kesimi",
      hacked_field: "DROP TABLE",
      blocker: "x".repeat(500),
    });
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("hacked_field");
    expect(result?.summary).toBe("Saç kesimi için düzenli gelen müşteri.");
    expect(result?.blocker?.length).toBe(120);
  });

  it("tamamen boş girdide null döner", () => {
    expect(sanitizeLeadMemory({})).toBeNull();
    expect(sanitizeLeadMemory({ summary: "   " })).toBeNull();
    expect(sanitizeLeadMemory(null)).toBeNull();
    expect(sanitizeLeadMemory("metin")).toBeNull();
  });
});

describe("formatLeadMemoryForPrompt", () => {
  it("hafıza yoksa boş string döner (prompt şişmez)", () => {
    expect(formatLeadMemoryForPrompt(null)).toBe("");
    expect(formatLeadMemoryForPrompt({})).toBe("");
  });

  it("dolu alanları okunabilir satırlara çevirir", () => {
    const text = formatLeadMemoryForPrompt({
      summary: "Düzenli müşteri.",
      preferred_staff: "Ayşe",
      preferred_time: "hafta içi akşam",
    });
    expect(text).toContain("Düzenli müşteri.");
    expect(text).toContain("Tercih ettiği kişi: Ayşe");
    expect(text).toContain("Tercih ettiği zaman: hafta içi akşam");
    expect(text).not.toContain("undefined");
  });
});

describe("shouldRefreshLeadMemory", () => {
  it("randevu oluştuğunda her zaman yeniler", () => {
    expect(shouldRefreshLeadMemory(1, true)).toBe(true);
  });

  it("belirlenen aralıkta yeniler, her mesajda değil", () => {
    expect(shouldRefreshLeadMemory(1, false)).toBe(false);
    expect(shouldRefreshLeadMemory(LEAD_MEMORY_REFRESH_EVERY_N_MESSAGES, false)).toBe(true);
    expect(shouldRefreshLeadMemory(LEAD_MEMORY_REFRESH_EVERY_N_MESSAGES * 2, false)).toBe(
      true
    );
  });

  it("sıfır/negatif mesaj sayısında çalışmaz", () => {
    expect(shouldRefreshLeadMemory(0, false)).toBe(false);
    expect(shouldRefreshLeadMemory(-1, false)).toBe(false);
  });
});

describe("buildConversationDigest", () => {
  it("son turları rol etiketiyle özetler", () => {
    const digest = buildConversationDigest([
      { role: "user", content: "merhaba" },
      { role: "assistant", content: "hoş geldin" },
    ]);
    expect(digest).toBe("Müşteri: merhaba\nBot: hoş geldin");
  });

  it("uzun geçmişte son turlarla sınırlı kalır", () => {
    const history = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `mesaj-${i}`,
    }));
    const digest = buildConversationDigest(history, 6);
    expect(digest.split("\n")).toHaveLength(6);
    expect(digest).toContain("mesaj-39");
    expect(digest).not.toContain("mesaj-0\n");
  });
});
