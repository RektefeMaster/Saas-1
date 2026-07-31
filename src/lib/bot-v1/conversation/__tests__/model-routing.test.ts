import { describe, it, expect } from "vitest";
import { classifyModelRouting } from "../intent-detection";
import { MODEL_SIMPLE, MODEL_COMPLEX } from "../constants";

describe("model routing (Luna-only)", () => {
  it("her mesaj Luna (simple) katmanına düşer", () => {
    for (const msg of [
      "yarın 15 boş mu?",
      "ben ve arkadaşım için yarın 3",
      "randevumu başka güne al",
      "her salı 14:00",
      "yer açılırsa haber ver",
    ]) {
      expect(classifyModelRouting(msg)).toEqual({
        tier: "simple",
        reason: "simple",
      });
    }
  });

  it("varsayılan model gpt-5.6-luna", () => {
    expect(MODEL_SIMPLE).toBe("gpt-5.6-luna");
    expect(MODEL_COMPLEX).toBe(MODEL_SIMPLE);
  });
});
